import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { safeRouter, sendValidationError, PHONE_REGEX, normalizePhone } from "../http.js";
import { publicUser, ratingsFor } from "../serializers.js";
import { deliveredCount, DELIVERIES_TO_VERIFY } from "./orders.js";
import { trustFor } from "../trust.js";

export const usersRouter = safeRouter();

usersRouter.get("/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { listings: { where: { status: "ACTIVE" } } } } },
  });
  if (!user) return res.status(404).json({ error: "We couldn't find that seller." });
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
  email: z.string().trim().email().nullable().optional(),
  bio: z.string().trim().max(160).nullable().optional(),
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
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

// Changing the account phone number re-uses the (mock) OTP flow: request a
// code for the new number, then verify it.
const phoneSchema = z.object({ phone: z.string().transform(normalizePhone) });

usersRouter.post("/:id/phone/request", async (req, res) => {
  const parsed = phoneSchema.safeParse(req.body);
  if (!parsed.success || !PHONE_REGEX.test(parsed.data.phone)) {
    return res.status(400).json({ error: "Please enter a valid phone number, e.g. +960 7771234." });
  }
  const owner = await prisma.user.findUnique({ where: { phone: parsed.data.phone } });
  if (owner && owner.id !== req.params.id) {
    return res.status(409).json({ error: "That number is already linked to another Alibe account." });
  }
  if (owner?.id === req.params.id) {
    return res.status(400).json({ error: "That's already your current number." });
  }
  console.log(`[mock-sms] Phone-change OTP for ${parsed.data.phone}: 1234`);
  res.json({ sent: true });
});

const verifyPhoneSchema = z.object({ phone: z.string().transform(normalizePhone), code: z.string() });

usersRouter.post("/:id/phone/verify", async (req, res) => {
  const parsed = verifyPhoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter the code we sent you." });
  if (parsed.data.code !== "1234") return res.status(401).json({ error: "That code isn't right. Please try again." });
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { phone: parsed.data.phone },
      include: fullInclude,
    });
    res.json(user);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "That number is already linked to another Alibe account." });
    }
    throw e;
  }
});

// Permanently deletes the account and everything that hangs off it: the
// user's listings (and chats/favourites on those listings), their own
// favourites, and every conversation they took part in.
usersRouter.delete("/:id", async (req, res) => {
  const userId = req.params.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(204).send();

  const listingIds = (await prisma.listing.findMany({ where: { sellerId: userId }, select: { id: true } })).map((l) => l.id);
  const conversationWhere = {
    OR: [{ buyerId: userId }, { sellerId: userId }, { listingId: { in: listingIds } }],
  };
  const conversationIds = (await prisma.conversation.findMany({ where: conversationWhere, select: { id: true } })).map((c) => c.id);

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { OR: [{ conversationId: { in: conversationIds } }, { senderId: userId }] } }),
    prisma.order.deleteMany({ where: { OR: [{ conversationId: { in: conversationIds } }, { buyerId: userId }, { sellerId: userId }, { listingId: { in: listingIds } }] } }),
    prisma.offer.deleteMany({ where: { OR: [{ conversationId: { in: conversationIds } }, { fromId: userId }, { listingId: { in: listingIds } }] } }),
    prisma.review.deleteMany({ where: { OR: [{ reviewerId: userId }, { sellerId: userId }, { listingId: { in: listingIds } }] } }),
    prisma.report.deleteMany({ where: { OR: [{ reporterId: userId }, { reportedUserId: userId }, { listingId: { in: listingIds } }] } }),
    prisma.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } }),
    prisma.savedSearch.deleteMany({ where: { userId } }),
    prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } }),
    prisma.favorite.deleteMany({ where: { OR: [{ userId }, { listingId: { in: listingIds } }] } }),
    prisma.listing.deleteMany({ where: { sellerId: userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
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
