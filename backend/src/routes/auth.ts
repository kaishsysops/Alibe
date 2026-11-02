import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { safeRouter, PHONE_REGEX, normalizePhone, normalizeEmail } from "../http.js";
import { createSession, deleteSession } from "../auth.js";
import { checkCode, respondToCheck, sendCode } from "../otp.js";
import { sendEmailCode, sendSmsCode } from "../messaging.js";
import { CLOSED_ACCOUNT_ERROR, isBannedContact } from "../moderation.js";
import { DECOY_HASH, verifyPassword } from "../password.js";
import { isStaffCode } from "../staffEntry.js";

export const authRouter = safeRouter();

// New accounts start with this name until the welcome flow asks for a real one.
const DEFAULT_NAME = "New Seller";

const signedIn = async (user: Prisma.UserGetPayload<object>) => ({
  token: await createSession(user.id),
  user,
  needsName: user.name === DEFAULT_NAME,
});

const requestSchema = z.object({ phone: z.string().transform(normalizePhone) });

authRouter.post("/otp/request", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success || !PHONE_REGEX.test(parsed.data.phone)) {
    return res.status(400).json({ error: "Please enter a valid phone number, e.g. +960 7771234." });
  }
  const { phone } = parsed.data;
  if (await isStaffCode(phone)) return res.json({ staffEntry: true });
  if (await isBannedContact(phone)) return res.status(403).json({ error: CLOSED_ACCOUNT_ERROR });
  await sendCode(res, `signin:phone:${phone}`, (code) => sendSmsCode(phone, code));
});

const verifySchema = z.object({
  phone: z.string().transform(normalizePhone),
  code: z.string(),
  name: z.string().optional(),
  themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

authRouter.post("/otp/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter the code we sent you." });
  const { phone, code, name, themeColor } = parsed.data;
  if (await isBannedContact(phone)) return res.status(403).json({ error: CLOSED_ACCOUNT_ERROR });
  if (!respondToCheck(res, await checkCode(`signin:phone:${phone}`, code))) return;
  const user = await prisma.user.upsert({
    where: { phone },
    // Returning users keep the colour they saved; the device's colour only seeds new accounts.
    update: {},
    create: { phone, name: name ?? DEFAULT_NAME, themeColor },
  });
  res.json(await signedIn(user));
});

const emailRequestSchema = z.object({ email: z.string().transform(normalizeEmail).pipe(z.string().email()) });

authRouter.post("/email/request", async (req, res) => {
  const parsed = emailRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter a valid email address." });
  const { email } = parsed.data;
  if (await isBannedContact(email)) return res.status(403).json({ error: CLOSED_ACCOUNT_ERROR });
  await sendCode(res, `signin:email:${email}`, (code) => sendEmailCode(email, code));
});

const emailVerifySchema = z.object({
  email: z.string().transform(normalizeEmail),
  code: z.string(),
  themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

authRouter.post("/email/verify", async (req, res) => {
  const parsed = emailVerifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter the code we sent you." });
  const { email, code, themeColor } = parsed.data;
  if (await isBannedContact(email)) return res.status(403).json({ error: CLOSED_ACCOUNT_ERROR });
  if (!respondToCheck(res, await checkCode(`signin:email:${email}`, code))) return;
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: DEFAULT_NAME, themeColor },
  });
  res.json(await signedIn(user));
});

// Staff sign in with a username and password. Customers never do: accounts only
// get a credential from prisma/set-admin.ts.
const staffSchema = z.object({ entryCode: z.string().max(20), username: z.string().trim().toLowerCase().max(40), password: z.string().max(200) });
const MAX_PASSWORD_FAILURES = 5;
const LOCK_MS = 15 * 60_000;

authRouter.post("/staff", async (req, res) => {
  const parsed = staffSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter your username and password." });
  const { entryCode, username, password } = parsed.data;
  // Without the staff number a guess isn't even tried, so it can't lock anyone out.
  if (!(await isStaffCode(entryCode))) return res.status(401).json({ error: "That username or password isn't right." });
  const user = await prisma.user.findUnique({ where: { username }, include: { adminCredential: true } });
  const credential = user?.isAdmin && !user.bannedAt ? user.adminCredential : null;
  const correct = await verifyPassword(password, credential?.passwordHash ?? DECOY_HASH);

  if (credential?.lockedUntil && credential.lockedUntil > new Date()) {
    return res.status(423).json({ error: "Too many wrong tries. Please wait 15 minutes and try again." });
  }
  if (!credential || !correct) {
    if (credential) {
      const failures = credential.failures + 1;
      const locked = failures >= MAX_PASSWORD_FAILURES;
      await prisma.adminCredential.update({
        where: { userId: credential.userId },
        data: { failures: locked ? 0 : failures, lockedUntil: locked ? new Date(Date.now() + LOCK_MS) : null },
      });
    }
    return res.status(401).json({ error: "That username or password isn't right." });
  }
  await prisma.adminCredential.update({ where: { userId: credential.userId }, data: { failures: 0, lockedUntil: null } });
  const { adminCredential: _hidden, ...safeUser } = user!;
  res.json({ token: await createSession(safeUser.id), user: safeUser, needsName: false });
});

// Signs this device out: its token stops working immediately, and its push
// token is dropped so the next person on the phone doesn't get our pushes.
authRouter.post("/logout", async (req, res) => {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  const pushToken = typeof req.body?.pushToken === "string" ? req.body.pushToken : null;
  if (pushToken && req.userId) {
    await prisma.$executeRaw`UPDATE "User" SET "pushTokens" = array_remove("pushTokens", ${pushToken}) WHERE id = ${req.userId}`;
  }
  if (token) await deleteSession(token);
  res.status(204).send();
});
