import { z } from "zod";
import { Prisma, Conversation } from "@prisma/client";
import { prisma } from "../db.js";
import { safeRouter, sendValidationError } from "../http.js";
import { listingInclude, serializeConversation, serializeListing } from "../serializers.js";
import { notifyUser } from "../push.js";
import { createOrder } from "./orders.js";

export const conversationsRouter = safeRouter();

const conversationInclude = {
  listing: { include: listingInclude },
  buyer: true,
  seller: true,
  messages: { orderBy: { createdAt: "desc" as const }, take: 1 },
};

type ConversationWithRelations = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;

function serialize(c: ConversationWithRelations, unreadCount = 0) {
  return { ...serializeConversation(c), listing: serializeListing(c.listing), unreadCount };
}

const lastReadFor = (c: Conversation, userId: string) => (c.buyerId === userId ? c.buyerLastReadAt : c.sellerLastReadAt);
const otherLastReadFor = (c: Conversation, userId: string) => (c.buyerId === userId ? c.sellerLastReadAt : c.buyerLastReadAt);

async function unreadCount(c: Conversation, userId: string) {
  return prisma.message.count({
    where: { conversationId: c.id, senderId: { not: userId }, createdAt: { gt: lastReadFor(c, userId) ?? new Date(0) } },
  });
}

export async function isBlockedBetween(a: string, b: string) {
  return !!(await prisma.block.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } }));
}

// List every conversation the user is party to (as buyer or seller), most
// recently active first, with how many messages they haven't read.
conversationsRouter.get("/mine/:userId", async (req, res) => {
  const { userId } = req.params;
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    include: conversationInclude,
    orderBy: { updatedAt: "desc" },
  });
  const counts = await Promise.all(conversations.map((c) => unreadCount(c, userId)));
  res.json(conversations.map((c, i) => serialize(c, counts[i])));
});

conversationsRouter.get("/:id", async (req, res) => {
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id }, include: conversationInclude });
  if (!conversation) return res.status(404).json({ error: "This conversation no longer exists." });
  res.json(serialize(conversation));
});

const startSchema = z.object({ listingId: z.string(), buyerId: z.string() });

// Starts (or returns the existing) conversation between a buyer and a
// listing's seller.
conversationsRouter.post("/", async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const { listingId, buyerId } = parsed.data;

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return res.status(404).json({ error: "This listing is no longer available." });
  if (listing.sellerId === buyerId) return res.status(400).json({ error: "You can't message yourself about your own listing." });
  if (await isBlockedBetween(buyerId, listing.sellerId)) return res.status(403).json({ error: "You can't message this seller." });

  const where = { listingId_buyerId: { listingId, buyerId } };
  try {
    const conversation = await prisma.conversation.upsert({
      where,
      update: {},
      create: { listingId, buyerId, sellerId: listing.sellerId },
      include: conversationInclude,
    });
    res.status(201).json(serialize(conversation));
  } catch (e) {
    // Two simultaneous taps can both miss the upsert's lookup; the loser
    // just returns the row the winner created.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.conversation.findUniqueOrThrow({ where, include: conversationInclude });
      return res.status(200).json(serialize(existing));
    }
    throw e;
  }
});

conversationsRouter.get("/:id/messages", async (req, res) => {
  const messages = await prisma.message.findMany({ where: { conversationId: req.params.id }, orderBy: { createdAt: "asc" } });
  res.json(messages);
});

// Everything the open chat screen polls for in one call: messages, offers,
// when the other person last read, and it marks the thread read for `userId`.
conversationsRouter.get("/:id/thread", async (req, res) => {
  const userId = String(req.query.userId ?? "");
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conversation) return res.status(404).json({ error: "This conversation no longer exists." });
  if (userId !== conversation.buyerId && userId !== conversation.sellerId) return res.status(403).json({ error: "You're not part of this chat." });

  const now = new Date();
  const [messages, offers, order] = await Promise.all([
    prisma.message.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } }),
    prisma.offer.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } }),
    prisma.order.findFirst({ where: { conversationId: conversation.id, status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, amount: true } }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: conversation.buyerId === userId ? { buyerLastReadAt: now } : { sellerLastReadAt: now },
    }),
  ]);
  res.json({
    messages,
    offers,
    otherLastReadAt: otherLastReadFor(conversation, userId),
    order,
    blocked: await isBlockedBetween(conversation.buyerId, conversation.sellerId),
  });
});

const sendSchema = z
  .object({
    senderId: z.string(),
    text: z.string().trim().max(2000).default(""),
    mediaUrl: z.string().regex(/^\/uploads\/[\w-]+\.\w+$/).optional(),
    mediaType: z.enum(["IMAGE", "VIDEO"]).optional(),
    clientId: z.string().max(64).optional(),
  })
  .refine((m) => m.text.length > 0 || (m.mediaUrl && m.mediaType), { message: "empty", path: ["text"] });

conversationsRouter.post("/:id/messages", async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const { senderId, text, clientId, mediaUrl, mediaType } = parsed.data;

  if (clientId) {
    const existing = await prisma.message.findUnique({ where: { clientId } });
    if (existing) return res.status(200).json(existing);
  }
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conversation) return res.status(404).json({ error: "This conversation no longer exists." });
  if (await isBlockedBetween(conversation.buyerId, conversation.sellerId)) {
    return res.status(403).json({ error: "You can't send messages in this chat." });
  }
  try {
    const message = await prisma.message.create({ data: { conversationId: conversation.id, senderId, text, clientId, mediaUrl, mediaType } });
    const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { name: true } });
    notifyUser(
      senderId === conversation.buyerId ? conversation.sellerId : conversation.buyerId,
      sender?.name ?? "New message",
      text || (mediaType === "VIDEO" ? "Sent a video" : "Sent a photo"),
      { type: "message", conversationId: conversation.id }
    );
    // Sending implies you've read everything up to now.
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date(), ...(conversation.buyerId === senderId ? { buyerLastReadAt: new Date() } : { sellerLastReadAt: new Date() }) },
    });
    res.status(201).json(message);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && clientId) {
      return res.status(200).json(await prisma.message.findUniqueOrThrow({ where: { clientId } }));
    }
    throw e;
  }
});

// ---- Offers ----------------------------------------------------------------

const offerSchema = z.object({ fromId: z.string(), amount: z.number().int().positive().max(100_000_000), clientId: z.string().max(64).optional() });

const formatMvr = (n: number) => `MVR ${n.toLocaleString("en-US")}`;

conversationsRouter.post("/:id/offers", async (req, res) => {
  const parsed = offerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter an offer amount above zero." });
  const { fromId, amount, clientId } = parsed.data;

  if (clientId) {
    const existing = await prisma.offer.findUnique({ where: { clientId } });
    if (existing) return res.status(200).json(existing);
  }
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id }, include: { listing: true } });
  if (!conversation) return res.status(404).json({ error: "This conversation no longer exists." });
  if (fromId !== conversation.buyerId && fromId !== conversation.sellerId) return res.status(403).json({ error: "You're not part of this chat." });
  if (conversation.listing.status !== "ACTIVE") return res.status(409).json({ error: "This item isn't available for offers any more." });
  if (await isBlockedBetween(conversation.buyerId, conversation.sellerId)) return res.status(403).json({ error: "You can't send offers in this chat." });

  const offer = await prisma.$transaction(async (tx) => {
    // A new offer from either side replaces whatever was still pending.
    await tx.offer.updateMany({ where: { conversationId: conversation.id, status: "PENDING" }, data: { status: "COUNTERED" } });
    const created = await tx.offer.create({ data: { conversationId: conversation.id, listingId: conversation.listingId, fromId, amount, clientId } });
    const isCounter = fromId === conversation.sellerId;
    await tx.message.create({
      data: { conversationId: conversation.id, senderId: fromId, offerId: created.id, text: `${isCounter ? "Counter-offer" : "Offer"}: ${formatMvr(amount)}` },
    });
    await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    return created;
  });
  const from = await prisma.user.findUnique({ where: { id: fromId }, select: { name: true } });
  notifyUser(
    fromId === conversation.buyerId ? conversation.sellerId : conversation.buyerId,
    `${from?.name ?? "Someone"} made an offer`,
    `${formatMvr(amount)} for ${conversation.listing.title}`,
    { type: "offer", conversationId: conversation.id }
  );
  res.status(201).json(offer);
});

const respondSchema = z.object({ userId: z.string(), action: z.enum(["ACCEPT", "DECLINE", "WITHDRAW"]) });

conversationsRouter.post("/offers/:offerId/respond", async (req, res) => {
  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const { userId, action } = parsed.data;
  const offer = await prisma.offer.findUnique({ where: { id: req.params.offerId }, include: { conversation: true } });
  if (!offer) return res.status(404).json({ error: "This offer no longer exists." });

  const { conversation } = offer;
  const isRecipient = userId !== offer.fromId && (userId === conversation.buyerId || userId === conversation.sellerId);
  if (action === "WITHDRAW" ? userId !== offer.fromId : !isRecipient) return res.status(403).json({ error: "You can't do that with this offer." });

  const nextStatus = action === "ACCEPT" ? "ACCEPTED" : action === "DECLINE" ? "DECLINED" : "WITHDRAWN";
  // Validation gate: only a pending offer can change. A repeated tap (or a
  // stale screen) gets the current state back instead of a second action.
  const result = await prisma.$transaction(async (tx) => {
    // An item can only be sold once: if it's already reserved for someone
    // else, this offer can't be accepted.
    // (A repeat tap on an already-accepted offer skips this and falls through
    // to the "nothing changed" path below.)
    if (action === "ACCEPT") {
      const [fresh, listing] = await Promise.all([
        tx.offer.findUniqueOrThrow({ where: { id: offer.id }, select: { status: true } }),
        tx.listing.findUniqueOrThrow({ where: { id: offer.listingId }, select: { status: true } }),
      ]);
      if (fresh.status === "PENDING" && listing.status !== "ACTIVE") return "UNAVAILABLE" as const;
    }
    const changed = await tx.offer.updateMany({ where: { id: offer.id, status: "PENDING" }, data: { status: nextStatus } });
    if (changed.count === 0) return null;
    const text =
      action === "ACCEPT"
        ? `Accepted the offer of ${formatMvr(offer.amount)}. The item is now reserved for you.`
        : action === "DECLINE"
        ? `Declined the offer of ${formatMvr(offer.amount)}.`
        : `Withdrew the offer of ${formatMvr(offer.amount)}.`;
    await tx.message.create({ data: { conversationId: conversation.id, senderId: userId, text } });
    await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    if (action !== "ACCEPT") return { orderId: "", closed: [] as Array<{ conversationId: string; buyerId: string; sellerId: string; amount: number }> };

    // Accepting turns the offer into an order the seller must deliver.
    const { order } = await createOrder(tx, {
      listingId: offer.listingId,
      conversationId: conversation.id,
      buyerId: conversation.buyerId,
      sellerId: conversation.sellerId,
      amount: offer.amount,
      offerId: offer.id,
    });
    // Every other open offer on this item is closed, and those buyers are told.
    const others = await tx.offer.findMany({
      where: { listingId: offer.listingId, status: "PENDING", id: { not: offer.id } },
      include: { conversation: true },
    });
    if (others.length) {
      await tx.offer.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { status: "DECLINED" } });
      for (const o of others) {
        await tx.message.create({
          data: { conversationId: o.conversationId, senderId: o.conversation.sellerId, text: "Sorry, this item has been sold to someone else, so your offer was closed." },
        });
        await tx.conversation.update({ where: { id: o.conversationId }, data: { updatedAt: new Date() } });
      }
    }
    return { orderId: order.id, closed: others.map((o) => ({ conversationId: o.conversationId, buyerId: o.conversation.buyerId, sellerId: o.conversation.sellerId, amount: o.amount })) };
  });
  if (result === "UNAVAILABLE") {
    return res.status(409).json({ error: "This item is already reserved for another buyer, so this offer can't be accepted." });
  }
  if (result) {
    const responder = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const name = responder?.name ?? "Someone";
    const otherId = userId === conversation.buyerId ? conversation.sellerId : conversation.buyerId;
    if (action === "ACCEPT") {
      notifyUser(otherId, `${name} accepted your offer`, `${formatMvr(offer.amount)}. Open the order to see what happens next.`, {
        type: "order",
        orderId: result.orderId,
        conversationId: conversation.id,
      });
      for (const c of result.closed) {
        notifyUser(c.buyerId, "This item was sold", "Your offer was closed because the seller sold it to someone else.", { type: "offer", conversationId: c.conversationId });
      }
    } else {
      const verb = action === "DECLINE" ? "declined" : "withdrew";
      notifyUser(otherId, `${name} ${verb} the offer`, formatMvr(offer.amount), { type: "offer", conversationId: conversation.id });
    }
  }
  const current = await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } });
  if (!result && current.status !== nextStatus) {
    return res.status(409).json({ error: "This offer was already answered.", offer: current });
  }
  // Accepting hands back the order so the app can open it straight away.
  const order = current.status === "ACCEPTED" ? await prisma.order.findUnique({ where: { offerId: offer.id }, select: { id: true } }) : null;
  res.json({ ...current, orderId: order?.id ?? null });
});
