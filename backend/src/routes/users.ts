import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { safeRouter, sendValidationError, PHONE_REGEX, normalizePhone, normalizeEmail } from "../http.js";
import { checkCode, respondToCheck, sendCode } from "../otp.js";
import { sendEmailCode, sendSmsCode } from "../messaging.js";
import { publicUser, ratingsFor } from "../serializers.js";
import { deliveredCount, DELIVERIES_TO_VERIFY } from "./orders.js";
import { trustFor } from "../trust.js";
import { CLOSED_ACCOUNT_ERROR, isBannedContact } from "../moderation.js";
import { deleteAccount } from "../accounts.js";

export const usersRouter = safeRouter();

// Seller search for the global Search screen: matches name or @username only
// (never phone or email). Banned and system accounts are left out; sellers with
// more for sale come first.
const SELLER_SEARCH_LIMIT = 12;
usersRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim().replace(/^@/, "").slice(0, 40);
  if (q.length < 2) return res.json([]);
  const users = await prisma.user.findMany({
    where: {
      isSystem: false,
      bannedAt: null,
      OR: [{ name: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }],
    },
    include: { _count: { select: { listings: { where: { status: "ACTIVE" } } } } },
    orderBy: [{ listings: { _count: "desc" } }, { createdAt: "asc" }],
    take: SELLER_SEARCH_LIMIT,
  });
  const ratings = await ratingsFor(users.map((u) => u.id));
  res.json(
    users.map((u) => ({
      ...publicUser(u),
      activeListingsCount: u._count.listings,
      rating: ratings.get(u.id) ?? { average: 0, count: 0 },
    })),
  );
});

usersRouter.get("/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { listings: { where: { status: "ACTIVE" } } } } },
  });
  if (!user || user.isSystem) return res.status(404).json({ error: "We couldn't find that seller." });
  const rating = (await ratingsFor([user.id])).get(user.id) ?? { average: 0, count: 0 };
  res.json({ ...publicUser(user), bio: user.bio, activeListingsCount: user._count.listings, rating, deliveredCount: await deliveredCount(user.id) });
});

// Public trust summary shown on listings, chats and profiles.
usersRouter.get("/:id/trust", async (req, res) => {
  const trust = await trustFor(req.params.id);
  if (!trust) return res.status(404).json({ error: "We couldn't find that seller." });
  res.json(trust);
});

const fullInclude = { island: { include: { atoll: true } } } as const;

// Full profile for the signed-in user (includes private fields).
usersRouter.get("/:id/me", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: fullInclude });
  if (!user) return res.status(404).json({ error: "Your account couldn't be found. Please sign in again." });
  res.json(user);
});

const phoneField = z
  .string()
  .transform(normalizePhone)
  .refine((v) => v === "" || PHONE_REGEX.test(v), { message: "invalid" });

const updateSchema = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/).nullable().optional(),
  bio: z.string().trim().max(160).nullable().optional(),
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  // Only photos uploaded to this server, never outside links.
  interests: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(20).optional(),
  avatarUrl: z.string().regex(/^\/uploads\/[0-9a-f-]+\.(jpg|png|webp|heic|gif)$/).nullable().optional(),
  themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  islandId: z.string().nullable().optional(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER"]).nullable().optional(),
  promoOptIn: z.boolean().optional(),
  showPhone: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  whatsappNumber: phoneField.nullable().optional(),
  viberEnabled: z.boolean().optional(),
  viberNumber: phoneField.nullable().optional(),
});

usersRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    if (field === "whatsappNumber" || field === "viberNumber") {
      return res.status(400).json({ error: `Please enter a valid ${field === "viberNumber" ? "Viber" : "WhatsApp"} number, e.g. +960 7771234.` });
    }
    return sendValidationError(res, parsed.error);
  }
  const data = { ...parsed.data };
  if (data.username?.toLowerCase() === "ibay") return res.status(409).json({ error: "That username is already taken." });
  if (data.whatsappNumber === "") data.whatsappNumber = null;
  if (data.viberNumber === "") data.viberNumber = null;
  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data, include: fullInclude });
    res.json(user);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "That username is already taken." });
    }
    throw e;
  }
});

// Adding or changing a sign-in method: request a code for the new phone/email,
// then verify it. The code only works for this account and this exact value.
const phoneSchema = z.object({ phone: z.string().transform(normalizePhone) });
const emailSchema = z.object({ email: z.string().transform(normalizeEmail).pipe(z.string().email()) });
const phoneTaken = "That number is already linked to another Alibe account.";
const emailTaken = "That email is already linked to another Alibe account.";

usersRouter.post("/:id/phone/request", async (req, res) => {
  const parsed = phoneSchema.safeParse(req.body);
  if (!parsed.success || !PHONE_REGEX.test(parsed.data.phone)) {
    return res.status(400).json({ error: "Please enter a valid phone number, e.g. +960 7771234." });
  }
  const { phone } = parsed.data;
  const owner = await prisma.user.findUnique({ where: { phone } });
  if (owner && owner.id !== req.params.id) return res.status(409).json({ error: phoneTaken });
  if (owner?.id === req.params.id) return res.status(400).json({ error: "That's already your current number." });
  if (await isBannedContact(phone)) return res.status(403).json({ error: CLOSED_ACCOUNT_ERROR });
  await sendCode(res, `change:${req.params.id}:phone:${phone}`, (code) => sendSmsCode(phone, code));
});

const verifyPhoneSchema = z.object({ phone: z.string().transform(normalizePhone), code: z.string() });

usersRouter.post("/:id/phone/verify", async (req, res) => {
  const parsed = verifyPhoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter the code we sent you." });
  const { phone, code } = parsed.data;
  if (!respondToCheck(res, await checkCode(`change:${req.params.id}:phone:${phone}`, code))) return;
  try {
    res.json(await prisma.user.update({ where: { id: req.params.id }, data: { phone }, include: fullInclude }));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return res.status(409).json({ error: phoneTaken });
    throw e;
  }
});

usersRouter.post("/:id/email/request", async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter a valid email address." });
  const { email } = parsed.data;
  const owner = await prisma.user.findUnique({ where: { email } });
  if (owner && owner.id !== req.params.id) return res.status(409).json({ error: emailTaken });
  if (owner?.id === req.params.id) return res.status(400).json({ error: "That's already your current email." });
  if (await isBannedContact(email)) return res.status(403).json({ error: CLOSED_ACCOUNT_ERROR });
  await sendCode(res, `change:${req.params.id}:email:${email}`, (code) => sendEmailCode(email, code));
});

const verifyEmailSchema = z.object({ email: z.string().transform(normalizeEmail), code: z.string() });

usersRouter.post("/:id/email/verify", async (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter the code we sent you." });
  const { email, code } = parsed.data;
  if (!respondToCheck(res, await checkCode(`change:${req.params.id}:email:${email}`, code))) return;
  try {
    res.json(await prisma.user.update({ where: { id: req.params.id }, data: { email }, include: fullInclude }));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return res.status(409).json({ error: emailTaken });
    throw e;
  }
});

// Permanently deletes the account and everything that hangs off it: the
// user's listings (and chats/favourites on those listings), their own
// favourites, and every conversation they took part in.
usersRouter.delete("/:id", async (req, res) => {
  await deleteAccount(req.params.id);
  res.status(204).send();
});

// Verification is earned, not requested: a seller becomes verified after
// DELIVERIES_TO_VERIFY buyer-verified deliveries (see routes/orders.ts).
usersRouter.get("/:id/verification", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { verificationStatus: true, verifiedAt: true } });
  if (!user) return res.status(404).json({ error: "Your account couldn't be found. Please sign in again." });
  res.json({ ...user, delivered: await deliveredCount(req.params.id), required: DELIVERIES_TO_VERIFY });
});

const pushTokenSchema = z.object({ token: z.string().min(10).max(200) });

usersRouter.post("/:id/push-tokens", async (req, res) => {
  const parsed = pushTokenSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { pushTokens: true } });
  if (!user) return res.status(404).json({ error: "Your account couldn't be found. Please sign in again." });
  // A token belongs to one account at a time (shared device, new sign-in).
  await prisma.$executeRaw`UPDATE "User" SET "pushTokens" = array_remove("pushTokens", ${parsed.data.token}) WHERE id <> ${req.params.id}`;
  if (!user.pushTokens.includes(parsed.data.token)) {
    await prisma.user.update({ where: { id: req.params.id }, data: { pushTokens: { push: parsed.data.token } } });
  }
  res.status(204).send();
});

usersRouter.delete("/:id/push-tokens", async (req, res) => {
  const token = String(req.query.token ?? "");
  await prisma.$executeRaw`UPDATE "User" SET "pushTokens" = array_remove("pushTokens", ${token}) WHERE id = ${req.params.id}`;
  res.status(204).send();
});
