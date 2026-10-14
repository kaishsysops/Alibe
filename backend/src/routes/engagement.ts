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

// Everything that wants the user's attention, computed on the fly: unread
// chats, offers waiting on them, and new saved-search matches. The app polls
// this to drive tab badges, the bell and in-app message banners.
notificationsRouter.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    include: { buyer: true, seller: true, listing: { select: { id: true, title: true, images: true } } },
  });

  const chatItems = (
    await Promise.all(
      conversations.map(async (c) => {
        const lastRead = (c.buyerId === userId ? c.buyerLastReadAt : c.sellerLastReadAt) ?? new Date(0);
        const where = { conversationId: c.id, senderId: { not: userId }, createdAt: { gt: lastRead } };
        const [count, latest] = await Promise.all([
          prisma.message.count({ where }),
          prisma.message.findFirst({ where, orderBy: { createdAt: "desc" } }),
        ]);
        if (!count || !latest) return null;
        const other = c.buyerId === userId ? c.seller : c.buyer;
        return {
          type: "message" as const,
          id: `msg-${latest.id}`,
          messageId: latest.id,
          conversationId: c.id,
          fromName: other.name,
          listingTitle: c.listing.title,
          image: c.listing.images[0] ?? null,
          preview: latest.text || (latest.mediaType === "VIDEO" ? "Sent a video" : "Sent a photo"),
          count,
          createdAt: latest.createdAt,
        };
      })
    )
  ).filter((x): x is NonNullable<typeof x> => !!x);

  const pendingOffers = await prisma.offer.findMany({
    where: { status: "PENDING", fromId: { not: userId }, conversationId: { in: conversations.map((c) => c.id) } },
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

  const items = [...chatItems, ...offerItems, ...orderItems, ...searchItems].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  res.json({
    unreadChats: chatItems.reduce((n, c) => n + c.count, 0),
    total: chatItems.length + offerItems.length + orderItems.length + searchItems.length,
    items,
  });
});
