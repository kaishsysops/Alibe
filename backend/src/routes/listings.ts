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
import { cached } from "../cache.js";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 60;
const MAX_PAGE = 50;

export const listingsRouter = safeRouter();

const listQuerySchema = listingFiltersSchema.extend({
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
  viewerId: z.string().optional(),
  // Public "this seller's items" filter (seller profiles). Not `sellerId`:
  // that name means "the caller" to the auth layer.
  seller: z.string().optional(),
  // Home and search ask for iBay items mixed in with Alibe's own.
  mix: z.literal("1").optional(),
  // Paging. Lists are never sent whole: a big marketplace would mean
  // megabytes per screen. X-Has-More says whether another page exists.
  page: z.coerce.number().int().min(0).max(MAX_PAGE).default(0),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  // Specific listings by id (recently viewed), in the order given.
  ids: z.string().max(2000).optional(),
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

const SORTS: Record<string, Prisma.ListingOrderByWithRelationInput[]> = {
  // id breaks ties so pages never repeat or skip an item.
  newest: [{ createdAt: "desc" }, { id: "desc" }],
  price_asc: [{ price: "asc" }, { id: "asc" }],
  price_desc: [{ price: "desc" }, { id: "desc" }],
};

// Feed items leave out the description (often the biggest field): lists only
// draw cards, and the listing page loads the full listing itself.

// Short-lived shared copies of things every feed request needs.
// Ids of listings with an active boost (purchases without a listing ignored).
const boostedIds = () => cached("boosted", 30_000, async () => new Set([...(await boostedListingIds())].filter((id): id is string => !!id)));
const ibayFor = (filters: object, sort?: string) => cached(`ibay:${JSON.stringify(filters)}:${sort ?? ""}`, 60_000, () => mixedIbayListings(filters, sort));

listingsRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const { sort, viewerId, seller, mix, page, limit, ids, ...filters } = parsed.data;
  const hidden = await hiddenSellerIds(viewerId);

  if (ids) {
    const wanted = ids.split(",").filter(Boolean).slice(0, 50);
    const rows = await prisma.listing.findMany({ where: { id: { in: wanted }, hiddenAt: null, sellerId: hidden.length ? { notIn: hidden } : undefined }, include: listingInclude });
    const byId = new Map((await serializeListings(rows)).map((l) => [l.id, l]));
    res.setHeader("X-Has-More", "0");
    return res.json(wanted.map((id) => byId.get(id)).filter(Boolean));
  }

  const where = listingWhere(filters, hidden);
  const scoped: Prisma.ListingWhereInput = seller ? { AND: [where, { sellerId: seller }] } : where;
  const order = sort ?? "newest";
  const withIbay = !!mix && !seller && !!req.userId;
  // A price sort mixed with iBay has to merge both lists before cutting a page,
  // so it reads every row up to the end of this page (capped by MAX_PAGE).
  const mergeByPrice = withIbay && order !== "newest";
  const boosted = await boostedIds();
  // Boosted items lead page one of a newest-first feed. A price sort stays
  // strictly by price, and a seller's own page isn't a place to compete.
  const lead = order === "newest" && !seller && boosted.size;
  const pinned = lead && page === 0 ? await prisma.listing.findMany({ where: { AND: [scoped, { id: { in: [...boosted] } }] }, include: listingInclude, orderBy: SORTS.newest }) : [];
  const rows = await prisma.listing.findMany({
    where: lead ? { AND: [scoped, { id: { notIn: [...boosted] } }] } : scoped,
    include: listingInclude,
    orderBy: SORTS[order],
    skip: mergeByPrice ? 0 : page * limit,
    take: mergeByPrice ? (page + 1) * limit + 1 : limit + 1,
  });
  let hasMore = rows.length > (mergeByPrice ? (page + 1) * limit : limit);
  const ownRows = mergeByPrice ? rows.slice(0, (page + 1) * limit) : rows.slice(0, limit);
  const own = (await serializeListings([...pinned, ...ownRows])).map((l) => ({ ...l, description: undefined, boosted: boosted.has(l.id) }));

  if (!withIbay) {
    res.setHeader("X-Has-More", hasMore ? "1" : "0");
    return res.json(own);
  }
  const ibay = await ibayFor(filters, sort);
  let items: unknown[];
  if (mergeByPrice) {
    const merged = mergeFeeds<{ price: number }>(own, ibay, sort);
    hasMore = hasMore || merged.length > (page + 1) * limit;
    items = merged.slice(page * limit, (page + 1) * limit);
  } else {
    // Each page interleaves this page of Alibe items with the same window of iBay's.
    const window = ibay.slice(page * limit, (page + 1) * limit);
    hasMore = hasMore || ibay.length > (page + 1) * limit;
    items = mergeFeeds<{ price: number }>(own, window, sort);
  }
  res.setHeader("X-Has-More", hasMore ? "1" : "0");
  res.json(items);
});

// Everything Home needs in one small response: the newest items and a row per
// category (12 each, iBay mixed in for signed-in people). Built once and shared
// for 30 seconds; only blocked sellers are filtered per person.
const HOME_RAIL = 12;
const HOME_LATEST = 24;

async function buildHome(signedIn: boolean) {
  const [categories, boosted] = await Promise.all([prisma.category.findMany(), boostedIds()]);
  const active = { status: "ACTIVE" as const, hiddenAt: null };
  const leadBoosted = <T extends { id: string }>(list: T[]) => [...list.filter((l) => boosted.has(l.id)), ...list.filter((l) => !boosted.has(l.id))];
  const [latestRows, ...railRows] = await Promise.all([
    prisma.listing.findMany({ where: active, include: listingInclude, orderBy: SORTS.newest, take: HOME_LATEST }),
    ...categories.map((c) => prisma.listing.findMany({ where: { ...active, categoryId: c.id }, include: listingInclude, orderBy: SORTS.newest, take: HOME_RAIL })),
  ]);
  const serialize = async (rows: typeof latestRows) => leadBoosted((await serializeListings(rows)).map((l) => ({ ...l, description: undefined, boosted: boosted.has(l.id) })));
  const ibay = signedIn ? await ibayFor({}, undefined) : [];
  const ibayBy = (slug: string) => ibay.filter((i) => i.category.slug === slug);
  const rails = (
    await Promise.all(
      categories.map(async (c, i) => ({ category: c, items: mergeFeeds<{ price: number }>(await serialize(railRows[i]), ibayBy(c.slug)).slice(0, HOME_RAIL) }))
    )
  )
    .filter((r) => r.items.length)
    .sort((a, b) => b.items.length - a.items.length);
  const latest = mergeFeeds<{ price: number }>(await serialize(latestRows), ibay).slice(0, HOME_LATEST);
  return { latest, rails };
}

listingsRouter.get("/home", async (req, res) => {
  const home = await cached(`home:${req.userId ? "in" : "out"}`, 30_000, () => buildHome(!!req.userId));
  const hidden = new Set(await hiddenSellerIds(req.userId));
  if (!hidden.size) return res.json(home);
  const visible = <T extends { seller: { id: string } }>(list: T[]) => list.filter((l) => !hidden.has(l.seller.id));
  res.json({ latest: visible(home.latest as any[]), rails: home.rails.map((r) => ({ ...r, items: visible(r.items as any[]) })).filter((r) => r.items.length) });
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
