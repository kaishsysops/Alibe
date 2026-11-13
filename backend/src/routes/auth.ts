import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { safeRouter, PHONE_REGEX, normalizePhone, normalizeEmail } from "../http.js";
import { createSession, deleteSession } from "../auth.js";
import { checkCode, respondToCheck, sendCode } from "../otp.js";
import { deliveryMethods, sendEmailCode, sendSmsCode } from "../messaging.js";
import { CLOSED_ACCOUNT_ERROR, isBannedContact } from "../moderation.js";
import { DECOY_HASH, verifyPassword } from "../password.js";
import { isStaffCode } from "../staffEntry.js";
import crypto from "node:crypto";

export const authRouter = safeRouter();

// ---- new phone/email: new account, or link it to one they already have ----
// A verified code for a contact Alibe doesn't know yet doesn't create an
// account straight away (that's how people ended up with a second, empty one).
// It returns a link token instead: signed proof, for 15 minutes, that this
// person owns that phone/email. The app then either creates the account with
// it (/auth/create), or the person signs in with the contact they used before
// and passes the token, which links the new contact to that account.
const LINK_SECRET = process.env.SLIP_LINK_SECRET || crypto.randomBytes(32).toString("hex");
const LINK_TTL_MS = 15 * 60_000;
type Contact = { kind: "phone" | "email"; value: string };

function linkToken(c: Contact) {
  const body = Buffer.from(JSON.stringify({ ...c, exp: Date.now() + LINK_TTL_MS })).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", LINK_SECRET).update(body).digest("base64url")}`;
}

function readLinkToken(token: string | undefined): Contact | null {
  const [body, sig] = (token ?? "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", LINK_SECRET).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString());
    return c.exp > Date.now() && (c.kind === "phone" || c.kind === "email") && typeof c.value === "string" ? { kind: c.kind, value: c.value } : null;
  } catch {
    return null;
  }
}

// After a sign-in, attach the contact from a link token if this account has
// none of that kind and nobody else uses it. Returns which kind was linked.
async function linkContact(userId: string, token: string | undefined) {
  const c = readLinkToken(token);
  if (!c) return undefined;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user[c.kind]) return undefined;
  if (await prisma.user.findFirst({ where: { [c.kind]: c.value } })) return undefined;
  if (await isBannedContact(c.value)) return undefined;
  await prisma.user.update({ where: { id: userId }, data: { [c.kind]: c.value } });
  return c.kind;
}

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
  linkToken: z.string().max(1000).optional(),
});

authRouter.post("/otp/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter the code we sent you." });
  const { phone, code, linkToken: token } = parsed.data;
  if (await isBannedContact(phone)) return res.status(403).json({ error: CLOSED_ACCOUNT_ERROR });
  if (!respondToCheck(res, await checkCode(`signin:phone:${phone}`, code))) return;
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return res.json({ newContact: true, linkToken: linkToken({ kind: "phone", value: phone }) });
  const linked = await linkContact(user.id, token);
  res.json({ ...(await signedIn(linked ? (await prisma.user.findUnique({ where: { id: user.id } }))! : user)), linked });
});

// What the sign-in screen should offer.
authRouter.get("/methods", (_req, res) => {
  res.json(deliveryMethods());
});

const emailRequestSchema = z.object({ email: z.string().transform(normalizeEmail).pipe(z.string().email()) });

authRouter.post("/email/request", async (req, res) => {
  // Staff sign-in also opens from the email field (for when phone sign-in is
  // switched off): the secret number typed in place of an address.
  const raw = String(req.body?.email ?? "").trim();
  if (/^\d{8}$/.test(raw) && (await isStaffCode(raw))) return res.json({ staffEntry: true });
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
  linkToken: z.string().max(1000).optional(),
});

authRouter.post("/email/verify", async (req, res) => {
  const parsed = emailVerifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter the code we sent you." });
  const { email, code, linkToken: token } = parsed.data;
  if (await isBannedContact(email)) return res.status(403).json({ error: CLOSED_ACCOUNT_ERROR });
  if (!respondToCheck(res, await checkCode(`signin:email:${email}`, code))) return;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json({ newContact: true, linkToken: linkToken({ kind: "email", value: email }) });
  const linked = await linkContact(user.id, token);
  res.json({ ...(await signedIn(linked ? (await prisma.user.findUnique({ where: { id: user.id } }))! : user)), linked });
});

// "I'm new": create the account for a contact proven by a link token.
const createSchema = z.object({ linkToken: z.string().max(1000), themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional() });

authRouter.post("/create", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  const c = parsed.success ? readLinkToken(parsed.data.linkToken) : null;
  if (!c) return res.status(400).json({ error: "That took a little too long. Please ask for a new code." });
  if (await isBannedContact(c.value)) return res.status(403).json({ error: CLOSED_ACCOUNT_ERROR });
  // Upsert: a double tap, or someone who created it a moment ago, just signs in.
  const user = await prisma.user.upsert({
    where: c.kind === "phone" ? { phone: c.value } : { email: c.value },
    // Returning users keep the colour they saved; the device's colour only seeds new accounts.
    update: {},
    create: { [c.kind]: c.value, name: DEFAULT_NAME, themeColor: parsed.data!.themeColor },
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
