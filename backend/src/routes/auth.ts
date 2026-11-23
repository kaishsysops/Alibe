import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { safeRouter, PHONE_REGEX, normalizePhone, normalizeEmail } from "../http.js";
import { createSession, deleteSession } from "../auth.js";
import { checkCode, respondToCheck, sendCode } from "../otp.js";
import { deliveryMethods, sendEmailCode, sendSmsCode } from "../messaging.js";
import { CLOSED_ACCOUNT_ERROR, isBannedContact } from "../moderation.js";
import { DECOY_HASH, hashPassword, verifyPassword } from "../password.js";
import { findStaffInvite } from "../staffInvites.js";
import crypto from "node:crypto";
import { googleClientIds, verifyGoogleToken } from "../google.js";

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

// Marketplace sign-in. Staff access never comes from here: the admin and
// portal sites use their own username + password sign-in (/auth/staff).
const signedIn = async (user: Prisma.UserGetPayload<object>) => {
  return { token: await createSession(user.id), user, needsName: user.name === DEFAULT_NAME };
};

const requestSchema = z.object({ phone: z.string().transform(normalizePhone) });

authRouter.post("/otp/request", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success || !PHONE_REGEX.test(parsed.data.phone)) {
    return res.status(400).json({ error: "Please enter a valid phone number, e.g. +960 7771234." });
  }
  const { phone } = parsed.data;
  if (!deliveryMethods().phone) return res.status(403).json({ error: "Phone sign-in isn't available yet. Please sign in with your email." });
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

// What the sign-in screen should offer. The Google client id is public (it's
// in every Google sign-in page); the app needs it to show the button.
authRouter.get("/methods", (_req, res) => {
  res.json({ ...deliveryMethods(), googleClientId: googleClientIds()[0] ?? null });
});

// "Sign in with Google": the browser sends Google's ID token. The same person
// is matched by Google account first, then by email (Google has verified it),
// so someone who signed up with an emailed code gets the same account.
const googleSchema = z.object({ credential: z.string().min(20).max(5000), themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional() });

authRouter.post("/google", async (req, res) => {
  if (!googleClientIds().length) return res.status(404).json({ error: "Google sign-in isn't set up." });
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Google sign-in didn't work. Please try again." });
  const google = await verifyGoogleToken(parsed.data.credential).catch((e) => {
    console.error("Google sign-in:", e);
    return null;
  });
  if (!google) return res.status(401).json({ error: "Google sign-in didn't work. Please try again." });
  if (await isBannedContact(google.email)) return res.status(403).json({ error: CLOSED_ACCOUNT_ERROR });

  let user = (await prisma.user.findUnique({ where: { googleId: google.sub } })) ?? (await prisma.user.findUnique({ where: { email: google.email } }));
  const isNew = !user;
  if (user) {
    if (user.bannedAt) return res.status(403).json({ error: CLOSED_ACCOUNT_ERROR });
    if (!user.googleId) user = await prisma.user.update({ where: { id: user.id }, data: { googleId: google.sub } });
  } else {
    try {
      user = await prisma.user.create({ data: { email: google.email, googleId: google.sub, name: google.name, themeColor: parsed.data.themeColor } });
    } catch (e) {
      // Double tap: the first request already created it.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      user = await prisma.user.findUniqueOrThrow({ where: { googleId: google.sub } });
    }
  }
  res.json({ ...(await signedIn(user)), isNew });
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

// Staff sign in to admin.alibe.online / portal.alibe.online with a username
// and password an admin gave them. Only these sessions reach staff APIs.
const staffSchema = z.object({ username: z.string().trim().toLowerCase().max(40), password: z.string().max(200) });
const MAX_PASSWORD_FAILURES = 5;
const LOCK_MS = 15 * 60_000;
const WRONG = "That username or password isn't right.";

authRouter.post("/staff", async (req, res) => {
  const parsed = staffSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.username || !parsed.data.password) return res.status(400).json({ error: "Please enter your username and password." });
  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username }, include: { adminCredential: true } });
  const isStaff = !!user && !user.bannedAt && (user.isAdmin || user.staffRoles.length > 0);
  const credential = isStaff ? user!.adminCredential : null;
  // Always hash something, so a wrong username takes as long as a wrong password.
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
    return res.status(401).json({ error: WRONG });
  }
  await prisma.adminCredential.update({ where: { userId: credential.userId }, data: { failures: 0, lockedUntil: null } });
  const { adminCredential: _hidden, ...safeUser } = user!;
  res.json({ token: await createSession(safeUser.id, true), user: safeUser, needsName: false });
});

export const STAFF_PASSWORD_MIN = 10;

// One-time sign-in link: who it's for (the page greets them by name).
authRouter.get("/staff/invite/:token", async (req, res) => {
  const invite = await findStaffInvite(req.params.token);
  if (!invite) return res.status(410).json({ error: "This sign-in link has expired or was already used. Ask an admin for a new one." });
  res.json({ name: invite.user.name, username: invite.user.username, site: invite.user.isAdmin ? "admin" : "portal", expiresAt: invite.expiresAt });
});

const acceptSchema = z.object({ token: z.string().max(200), password: z.string().min(STAFF_PASSWORD_MIN).max(200) });

// They choose their password; the link is used up and they're signed in.
// Any other staff sign-ins of theirs end (this doubles as a password reset).
authRouter.post("/staff/invite", async (req, res) => {
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: `Choose a password with at least ${STAFF_PASSWORD_MIN} characters.` });
  const invite = await findStaffInvite(parsed.data.token);
  if (!invite) return res.status(410).json({ error: "This sign-in link has expired or was already used. Ask an admin for a new one." });
  const passwordHash = await hashPassword(parsed.data.password);
  // Deleting the invite first makes a double submit fail instead of signing in twice.
  const used = await prisma.staffInvite.deleteMany({ where: { tokenHash: invite.tokenHash } });
  if (!used.count) return res.status(410).json({ error: "This sign-in link was already used." });
  await prisma.$transaction([
    prisma.adminCredential.upsert({
      where: { userId: invite.userId },
      update: { passwordHash, failures: 0, lockedUntil: null },
      create: { userId: invite.userId, passwordHash },
    }),
    prisma.staffInvite.deleteMany({ where: { userId: invite.userId } }),
    prisma.session.deleteMany({ where: { userId: invite.userId, staff: true } }),
  ]);
  const { user } = invite;
  res.json({ token: await createSession(user.id, true), user, needsName: false });
});
const changePasswordSchema = z.object({ current: z.string().max(200), next: z.string().min(STAFF_PASSWORD_MIN).max(200) });

// Staff change their own password (signed in on the staff sites). Other staff
// sessions of theirs are signed out.
authRouter.post("/staff/password", async (req, res) => {
  if (!req.userId || !req.staffSession) return res.status(403).json({ error: "Sign in on the staff site first." });
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: `The new password needs at least ${STAFF_PASSWORD_MIN} characters.` });
  const credential = await prisma.adminCredential.findUnique({ where: { userId: req.userId } });
  if (!credential || !(await verifyPassword(parsed.data.current, credential.passwordHash))) return res.status(400).json({ error: "Your current password isn't right." });
  await prisma.adminCredential.update({ where: { userId: req.userId }, data: { passwordHash: await hashPassword(parsed.data.next), failures: 0, lockedUntil: null } });
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  await prisma.session.deleteMany({ where: { userId: req.userId, staff: true, NOT: { tokenHash: crypto.createHash("sha256").update(token).digest("hex") } } });
  res.status(204).send();
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
