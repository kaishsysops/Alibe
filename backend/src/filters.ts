import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

// One definition of "which listings match these filters", shared by search,
// saved searches and their new-match alerts so they can never disagree.
export const listingFiltersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  categorySlug: z.string().optional(),
  islandId: z.string().optional(),
  atollId: z.string().optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]).optional(),
  delivery: z.enum(["PICKUP", "FERRY", "COURIER"]).optional(),
});

export type ListingFilters = z.infer<typeof listingFiltersSchema>;

export function normaliseFilters(f: ListingFilters): ListingFilters {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "") out[k] = v;
  return out as ListingFilters;
}

export const filtersKey = (f: ListingFilters) =>
  JSON.stringify(Object.fromEntries(Object.entries(normaliseFilters(f)).sort(([a], [b]) => a.localeCompare(b))));

// Users the viewer has blocked, or who blocked the viewer: their listings
// are hidden from each other.
export async function hiddenSellerIds(viewerId?: string) {
  if (!viewerId) return [];
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  return blocks.map((b) => (b.blockerId === viewerId ? b.blockedId : b.blockerId));
}

export function listingWhere(f: ListingFilters, hidden: string[] = []): Prisma.ListingWhereInput {
  return {
    status: "ACTIVE",
    sellerId: hidden.length ? { notIn: hidden } : undefined,
    category: f.categorySlug ? { slug: f.categorySlug } : undefined,
    islandId: f.islandId ?? undefined,
    island: f.atollId ? { atollId: f.atollId } : undefined,
    condition: f.condition ?? undefined,
    deliveryOptions: f.delivery ? { has: f.delivery } : undefined,
    price: { gte: f.minPrice ?? undefined, lte: f.maxPrice ?? undefined },
    OR: f.q
      ? [
          { title: { contains: f.q, mode: "insensitive" } },
          { description: { contains: f.q, mode: "insensitive" } },
          { category: { name: { contains: f.q, mode: "insensitive" } } },
        ]
      : undefined,
  };
}
