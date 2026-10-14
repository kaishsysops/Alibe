import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { safeRouter, sendValidationError } from "../http.js";
import { listingInclude, serializeListing, serializeListings, ratingsFor } from "../serializers.js";
import { listingFiltersSchema, listingWhere, hiddenSellerIds } from "../filters.js";

export const listingsRouter = safeRouter();

const listQuerySchema = listingFiltersSchema.extend({
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
  viewerId: z.string().optional(),
  // Public "this seller's items" filter (seller profiles). Not `sellerId`:
  // that name means "the caller" to the auth layer.
  seller: z.string().optional(),
});

const SORTS: Record<string, Prisma.ListingOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
};

listingsRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const { sort, viewerId, seller, ...filters } = parsed.data;
  const where = listingWhere(filters, await hiddenSellerIds(viewerId));
  const listings = await prisma.listing.findMany({
    where: seller ? { AND: [where, { sellerId: seller }] } : where,
    include: listingInclude,
    orderBy: SORTS[sort ?? "newest"],
  });
  res.json(await serializeListings(listings));
});

listingsRouter.get("/:id", async (req, res) => {
  const listing = await prisma.listing.findUnique({ where: { id: req.params.id }, include: listingInclude });
  if (!listing) return res.status(404).json({ error: "This listing is no longer available." });
  res.json(serializeListing(listing, await ratingsFor([listing.sellerId])));
});

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

  // Idempotent publish: a retried/double-tapped request with the same key
  // returns the listing that was already created instead of a duplicate.
  if (clientRequestId) {
    const existing = await prisma.listing.findUnique({ where: { clientRequestId }, include: listingInclude });
    if (existing) return res.status(200).json(serializeListing(existing));
  }
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
  const listing = await prisma.listing.update({ where: { id: req.params.id }, data, include: listingInclude });
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
