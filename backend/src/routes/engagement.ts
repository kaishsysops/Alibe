import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { safeRouter, sendValidationError } from "../http.js";
import { listingFiltersSchema, listingWhere, normaliseFilters, filtersKey, hiddenSellerIds, ListingFilters } from "../filters.js";

export const savedSearchesRouter = safeRouter();
export const notificationsRouter = safeRouter();

async function newMatchCount(userId: string, params: ListingFilters, since: Date, hidden: string[]) {
  return prisma.listing.count({
    where: { ...listingWhere(params, hidden), createdAt: { gt: since }, sellerId: { notIn: [...hidden, userId] } },
  });
}

// ---- Saved searches ------------------------------------------------------------

savedSearchesRouter.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  const [searches, hidden] = await Promise.all([
    prisma.savedSearch.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    hiddenSellerIds(userId),
  ]);
  const counts = await Promise.all(searches.map((s) => newMatchCount(userId, s.params as ListingFilters, s.lastSeenAt, hidden)));
  res.json(searches.map((s, i) => ({ ...s, newCount: counts[i] })));
});

const createSchema = z.object({ userId: z.string(), label: z.string().trim().min(1).max(80), params: listingFiltersSchema });

savedSearchesRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const params = normaliseFilters(parsed.data.params);
  if (!Object.keys(params).length) return res.status(400).json({ error: "Search for something or pick a filter before saving." });
  const key = filtersKey(params);
  const where = { userId_paramsKey: { userId: parsed.data.userId, paramsKey: key } };
  try {
    // Saving the same search twice keeps one entry.
    const saved = await prisma.savedSearch.upsert({
      where,
      update: {},
      create: { userId: parsed.data.userId, label: parsed.data.label, params, paramsKey: key },
    });
    res.status(201).json({ ...saved, newCount: 0 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(200).json({ ...(await prisma.savedSearch.findUniqueOrThrow({ where })), newCount: 0 });
    }
    throw e;
  }
});

savedSearchesRouter.post("/:id/seen", async (req, res) => {
  await prisma.savedSearch.updateMany({ where: { id: req.params.id, userId: req.userId }, data: { lastSeenAt: new Date() } });
  res.status(204).send();
});

savedSearchesRouter.delete("/:id", async (req, res) => {
  await prisma.savedSearch.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.status(204).send();
});

// ---- Notifications ---------------------------------------------------------------

notificationsRouter.post("/:userId/price-drops/:listingId/seen", async (req, res) => {
  await prisma.favorite.updateMany({ where: { userId: req.params.userId, listingId: req.params.listingId }, data: { priceSeenAt: new Date() } });
  res.status(204).send();
});

// Everything that wants the user's attention, computed on the fly: unread
// chats, offers waiting on them, and new saved-search matches. The app polls
// this to drive tab badges, the bell and in-app message banners.
notificationsRouter.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  // Polled by every signed-in app, so it must stay cheap however many chats
  // someone has: one query finds every conversation with unread messages, its
  // unread count and the newest unread message.
  const unread = await prisma.$queryRaw<{ conversationId: string; messageId: string; text: string; mediaType: string | null; createdAt: Date; count: bigint }[]>`
    SELECT DISTINCT ON (m."conversationId")
      m."conversationId", m.id AS "messageId", m.text, m."mediaType", m."createdAt",
      COUNT(*) OVER (PARTITION BY m."conversationId") AS count
    FROM "Message" m
    JOIN "Conversation" c ON c.id = m."conversationId"
    WHERE (c."buyerId" = ${userId} OR c."sellerId" = ${userId})
      AND m."senderId" <> ${userId}
      AND m."createdAt" > COALESCE(CASE WHEN c."buyerId" = ${userId} THEN c."buyerLastReadAt" ELSE c."sellerLastReadAt" END, 'epoch'::timestamp)
    ORDER BY m."conversationId", m."createdAt" DESC`;
  const unreadConversations = unread.length
    ? await prisma.conversation.findMany({
        where: { id: { in: unread.map((u) => u.conversationId) } },
        include: { buyer: true, seller: true, listing: { select: { id: true, title: true, images: true } } },
      })
    : [];
  const conversationBy = new Map(unreadConversations.map((c) => [c.id, c]));
  const chatItems = unread.flatMap((u) => {
    const c = conversationBy.get(u.conversationId);
    if (!c) return [];
    const other = c.buyerId === userId ? c.seller : c.buyer;
    return [
      {
        type: "message" as const,
        id: `msg-${u.messageId}`,
        messageId: u.messageId,
        conversationId: c.id,
        fromName: other.name,
        listingTitle: c.listing.title,
        image: c.listing.images[0] ?? null,
        preview: u.text || (u.mediaType === "VIDEO" ? "Sent a video" : "Sent a photo"),
        count: Number(u.count),
        createdAt: u.createdAt,
      },
    ];
  });

  const pendingOffers = await prisma.offer.findMany({
    where: { status: "PENDING", fromId: { not: userId }, conversation: { OR: [{ buyerId: userId }, { sellerId: userId }] } },
    include: { from: true, listing: { select: { title: true, images: true } } },
    orderBy: { createdAt: "desc" },
  });
  const offerItems = pendingOffers.map((o) => ({
    type: "offer" as const,
    id: `offer-${o.id}`,
    offerId: o.id,
    conversationId: o.conversationId,
    fromName: o.from.name,
    listingTitle: o.listing.title,
    image: o.listing.images[0] ?? null,
    amount: o.amount,
    createdAt: o.createdAt,
  }));

  // Orders waiting on this user: sellers must send, buyers must confirm receipt.
  const orders = await prisma.order.findMany({
    where: { OR: [{ sellerId: userId, status: "AWAITING_DISPATCH" }, { buyerId: userId, status: "DISPATCHED" }] },
    include: { listing: { select: { title: true, images: true } }, buyer: true, seller: true },
    orderBy: { updatedAt: "desc" },
  });
  const orderItems = orders.map((o) => ({
    type: "order" as const,
    id: `order-${o.id}-${o.status}`,
    orderId: o.id,
    conversationId: o.conversationId,
    role: o.sellerId === userId ? ("SELLER" as const) : ("BUYER" as const),
    status: o.status,
    fromName: o.sellerId === userId ? o.buyer.name : o.seller.name,
    listingTitle: o.listing.title,
    image: o.listing.images[0] ?? null,
    createdAt: o.updatedAt,
  }));

  const [searches, hidden] = await Promise.all([prisma.savedSearch.findMany({ where: { userId } }), hiddenSellerIds(userId)]);
  const searchItems = (
    await Promise.all(
      searches.map(async (s) => {
        const newCount = await newMatchCount(userId, s.params as ListingFilters, s.lastSeenAt, hidden);
        return newCount ? { type: "saved_search" as const, id: `search-${s.id}`, savedSearchId: s.id, label: s.label, params: s.params, newCount, createdAt: s.lastSeenAt } : null;
      })
    )
  ).filter((x): x is NonNullable<typeof x> => !!x);

  // Price drops on saved items, until they've been opened.
  const savedWithDrop = await prisma.favorite.findMany({
    where: { userId, listing: { status: "ACTIVE", hiddenAt: null, priceDroppedAt: { not: null }, previousPrice: { not: null }, sellerId: hidden.length ? { notIn: hidden } : undefined } },
    include: { listing: { select: { id: true, title: true, images: true, price: true, previousPrice: true, priceDroppedAt: true } } },
  });
  const priceItems = savedWithDrop
    .filter((f) => f.listing.priceDroppedAt! > f.createdAt && (!f.priceSeenAt || f.listing.priceDroppedAt! > f.priceSeenAt))
    .map((f) => ({
      type: "price_drop" as const,
      id: `price-${f.listingId}-${f.listing.priceDroppedAt!.getTime()}`,
      listingId: f.listingId,
      listingTitle: f.listing.title,
      image: f.listing.images[0] ?? null,
      price: f.listing.price,
      previousPrice: f.listing.previousPrice!,
      createdAt: f.listing.priceDroppedAt!,
    }));

  // Purchases waiting on this person's payment.
  const unpaid = await prisma.purchase.findMany({ where: { userId, status: "AWAITING_PAYMENT" }, select: { id: true, kind: true, amount: true, adTitle: true, itemTitle: true, updatedAt: true } });
  const purchaseItems = unpaid.map((p) => ({
    type: "purchase" as const,
    id: `purchase-${p.id}`,
    purchaseId: p.id,
    label: p.itemTitle ?? p.adTitle ?? "Your purchase",
    amount: p.amount,
    createdAt: p.updatedAt,
  }));

  const items = [...chatItems, ...offerItems, ...orderItems, ...searchItems, ...priceItems, ...purchaseItems].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  res.json({
    unreadChats: chatItems.reduce((n, c) => n + c.count, 0),
    total: chatItems.length + offerItems.length + orderItems.length + searchItems.length + priceItems.length + purchaseItems.length,
    items,
  });
});
