import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { safeRouter, sendValidationError } from "../http.js";
import { listingInclude, serializeListing, serializeListings, ratingsFor } from "../serializers.js";
import { listingFiltersSchema, listingWhere, hiddenSellerIds } from "../filters.js";
import { listingBlock, prohibitedReason } from "../moderation.js";
import { notifyUser } from "../push.js";
import { mixedIbayListings } from "./ibay.js";
import { boostedListingIds } from "./purchases.js";

export const listingsRouter = safeRouter();

const listQuerySchema = listingFiltersSchema.extend({
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
  viewerId: z.string().optional(),
  // Public "this seller's items" filter (seller profiles). Not `sellerId`:
  // that name means "the caller" to the auth layer.
  seller: z.string().optional(),
  // Home and search ask for iBay items mixed in with Alibe's own.
  mix: z.literal("1").optional(),
});

// Alibe and iBay take turns, so neither crowds the other out; a price sort
// orders them together.
function mergeFeeds<T extends { price: number }>(own: T[], ibay: T[], sort?: string) {
  if (sort === "price_asc") return [...own, ...ibay].sort((a, b) => a.price - b.price);
  if (sort === "price_desc") return [...own, ...ibay].sort((a, b) => b.price - a.price);
  const mixed: T[] = [];
  for (let i = 0; i < Math.max(own.length, ibay.length); i++) {
    if (own[i]) mixed.push(own[i]);
    if (ibay[i]) mixed.push(ibay[i]);
  }
  return mixed;
}

const SORTS: Record<string, Prisma.ListingOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
};

listingsRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const { sort, viewerId, seller, mix, ...filters } = parsed.data;
  const where = listingWhere(filters, await hiddenSellerIds(viewerId));
  const listings = await prisma.listing.findMany({
    where: seller ? { AND: [where, { sellerId: seller }] } : where,
    include: listingInclude,
    orderBy: SORTS[sort ?? "newest"],
  });
  const boosted = await boostedListingIds();
  const serialized = (await serializeListings(listings)).map((l) => ({ ...l, boosted: boosted.has(l.id) }));
  // Boosted items lead a newest-first feed. A price sort stays strictly by price,
  // and a seller's own page isn't a place to compete for attention.
  const own = (sort && sort !== "newest") || seller ? serialized : [...serialized.filter((l) => l.boosted), ...serialized.filter((l) => !l.boosted)];
  // Only signed-in people can open an iBay item, so only they get them in a feed.
  if (!mix || seller || !req.userId) return res.json(own);
  res.json(mergeFeeds<{ price: number }>(own, await mixedIbayListings(filters, sort), sort));
});

listingsRouter.get("/:id", async (req, res) => {
  const listing = await prisma.listing.findUnique({ where: { id: req.params.id }, include: listingInclude });
  if (!listing) return res.status(404).json({ error: "This listing is no longer available." });
  // Hidden listings stay visible to their seller, who can still manage them.
  if (listing.hiddenAt && listing.sellerId !== req.userId) return res.status(404).json({ error: "This listing is no longer available." });
  res.json(serializeListing(listing, await ratingsFor([listing.sellerId])));
});

const prohibitedMessage = (what: string) => `Alibe can't list ${what}. Please remove it to continue.`;

// A price drop only counts if the price wasn't pushed up first to fake one.
const RAISE_COOLDOWN_MS = 7 * 86_400_000;
const ALERT_EVERY_MS = 86_400_000;

function priceChange(old: { price: number; previousPrice: number | null; priceDroppedAt: Date | null; priceRaisedAt: Date | null }, price: number | undefined, now: Date) {
  if (price === undefined || price === old.price) return { fields: {}, alert: false };
  if (price > old.price) return { fields: { previousPrice: null, priceDroppedAt: null, priceRaisedAt: now }, alert: false };
  if (old.priceRaisedAt && now.getTime() - old.priceRaisedAt.getTime() < RAISE_COOLDOWN_MS) return { fields: {}, alert: false };
  return {
    fields: { previousPrice: Math.max(old.previousPrice ?? 0, old.price), priceDroppedAt: now },
    alert: !old.priceDroppedAt || now.getTime() - old.priceDroppedAt.getTime() >= ALERT_EVERY_MS,
  };
}

const deliveryField = z.array(z.enum(["PICKUP", "FERRY", "COURIER"])).min(1, "delivery");

const createListingSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(1).max(2000),
  price: z.number().int().nonnegative(),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]),
  categoryId: z.string(),
  islandId: z.string(),
  sellerId: z.string(),
  images: z.array(z.string()).default([]),
  deliveryOptions: deliveryField.default(["PICKUP"]),
  deliveryNote: z.string().trim().max(200).nullable().optional(),
  clientRequestId: z.string().max(64).optional(),
});

listingsRouter.post("/", async (req, res) => {
  const parsed = createListingSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const { clientRequestId } = parsed.data;
  const banned = prohibitedReason(`${parsed.data.title} ${parsed.data.description}`);
  if (banned) return res.status(400).json({ error: prohibitedMessage(banned) });

  // Idempotent publish: a retried/double-tapped request with the same key
  // returns the listing that was already created instead of a duplicate.
  if (clientRequestId) {
    const existing = await prisma.listing.findUnique({ where: { clientRequestId }, include: listingInclude });
    if (existing) return res.status(200).json(serializeListing(existing));
  }
  const block = await listingBlock(parsed.data.sellerId);
  if (block) return res.status(block.status).json({ error: block.error, code: block.code });
  try {
    const listing = await prisma.listing.create({ data: parsed.data, include: listingInclude });
    res.status(201).json(serializeListing(listing));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && clientRequestId) {
      const existing = await prisma.listing.findUniqueOrThrow({ where: { clientRequestId }, include: listingInclude });
      return res.status(200).json(serializeListing(existing));
    }
    throw e;
  }
});

const statusQuerySchema = z.object({ status: z.enum(["ACTIVE", "RESERVED", "SOLD", "DRAFT"]).optional() });

listingsRouter.get("/mine/:sellerId", async (req, res) => {
  const parsed = statusQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const listings = await prisma.listing.findMany({
    where: { sellerId: req.params.sellerId, status: parsed.data.status ?? undefined },
    include: listingInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json(await serializeListings(listings));
});

// Edits require the caller to name the seller; without real auth this is
// the guard that stops one account editing another's listing.
const updateListingSchema = createListingSchema
  .omit({ clientRequestId: true, sellerId: true })
  .partial()
  .extend({
    sellerId: z.string(),
    status: z.enum(["ACTIVE", "RESERVED", "SOLD", "DRAFT"]).optional(),
  });

listingsRouter.patch("/:id", async (req, res) => {
  const parsed = updateListingSchema.safeParse(req.body);
  if (!parsed.success) {
    if (parsed.error.issues[0]?.message === "delivery") return res.status(400).json({ error: "Pick at least one way buyers can get the item." });
    return sendValidationError(res, parsed.error);
  }
  const { sellerId, ...data } = parsed.data;
  const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "This listing is no longer available." });
  if (existing.sellerId !== sellerId) return res.status(403).json({ error: "You can only edit your own listings." });
  const banned = prohibitedReason(`${data.title ?? ""} ${data.description ?? ""}`);
  if (banned) return res.status(400).json({ error: prohibitedMessage(banned) });
  const { fields, alert } = priceChange(existing, data.price, new Date());
  const listing = await prisma.listing.update({ where: { id: req.params.id }, data: { ...data, ...fields }, include: listingInclude });
  if (alert && listing.status === "ACTIVE" && !listing.hiddenAt) {
    const savers = await prisma.favorite.findMany({ where: { listingId: listing.id }, select: { userId: true } });
    for (const { userId } of savers) {
      notifyUser(userId, "Price drop on something you saved", `${listing.title} is now MVR ${listing.price.toLocaleString()}.`, { type: "price_drop", listingId: listing.id });
    }
  }
  res.json(serializeListing(listing));
});

listingsRouter.delete("/:id", async (req, res) => {
  const sellerId = String(req.query.sellerId ?? "");
  const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
  // Already gone (e.g. a second tap on Delete): treat as success.
  if (!existing) return res.status(204).send();
  if (existing.sellerId !== sellerId) return res.status(403).json({ error: "You can only delete your own listings." });

  const conversationIds = (await prisma.conversation.findMany({ where: { listingId: existing.id }, select: { id: true } })).map((c) => c.id);
  await prisma.$transaction([
    prisma.message.deleteMany({ where: { conversationId: { in: conversationIds } } }),
    prisma.order.deleteMany({ where: { listingId: existing.id } }),
    prisma.offer.deleteMany({ where: { listingId: existing.id } }),
    prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } }),
    prisma.favorite.deleteMany({ where: { listingId: existing.id } }),
    prisma.review.deleteMany({ where: { listingId: existing.id } }),
    prisma.report.deleteMany({ where: { listingId: existing.id } }),
    prisma.listing.delete({ where: { id: existing.id } }),
  ]);
  res.status(204).send();
});
