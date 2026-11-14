import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { categoryIndex, categoriesMatchingQuery, descendants, CategoryIndex } from "./categories.js";

// One definition of "which listings match these filters", shared by search,
// saved searches and their new-match alerts so they can never disagree.

// Category filters: {"brand":["Apple","Samsung"],"year":{"min":2015,"max":2020}}
const attrValue = z.union([z.array(z.string().max(60)).max(20), z.object({ min: z.number().optional(), max: z.number().optional() })]);
const attrsField = z
  .string()
  .max(2000)
  .transform((s, ctx) => {
    try {
      return z.record(z.string().max(40), attrValue).parse(JSON.parse(s));
    } catch {
      ctx.addIssue({ code: "custom", message: "attrs" });
      return z.NEVER;
    }
  });

export const listingFiltersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  categorySlug: z.string().optional(),
  islandId: z.string().optional(),
  atollId: z.string().optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]).optional(),
  delivery: z.enum(["PICKUP", "FERRY", "COURIER"]).optional(),
  // Only things posted in the last N days.
  postedWithin: z.coerce.number().int().refine((d) => [1, 7, 30].includes(d)).optional(),
  // Only listings whose price has come down.
  reduced: z.enum(["1"]).optional(),
  // Alibe's own sellers only (leaves iBay items out of mixed feeds).
  alibeOnly: z.enum(["1"]).optional(),
  // Saved searches keep the parsed object; requests send it as a JSON string.
  attrs: z.union([attrsField, z.record(z.string().max(40), attrValue)]).optional(),
});

export type ListingFilters = z.infer<typeof listingFiltersSchema>;
export type AttrFilters = NonNullable<ListingFilters["attrs"]>;

export function normaliseFilters(f: ListingFilters): ListingFilters {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === "") continue;
    if (k === "attrs" && (typeof v !== "object" || !Object.keys(v as object).length)) continue;
    out[k] = v;
  }
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

// ---- text search ---------------------------------------------------------------

const STOP_WORDS = new Set(["a", "an", "the", "and", "or", "for", "in", "on", "at", "of", "to", "with", "my", "i", "want", "need", "looking", "sale", "selling", "buy", "cheap", "good", "best"]);
const MAX_TEXT_MATCHES = 3000;

export const searchWords = (q: string) =>
  q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .slice(0, 6);

// Every word has to appear: in the title or description, or close enough to a
// title word to be a typo ("iphon", "samsng"; pg_trgm's <% operator).
function wordsMatch(words: string[], table: "l" | "i") {
  return Prisma.join(
    words.map((w) => {
      const like = `%${w.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      return table === "l"
        ? Prisma.sql`(l.title ILIKE ${like} OR l.description ILIKE ${like} OR ${w} <% l.title)`
        : Prisma.sql`(i.title ILIKE ${like} OR ${w} <% i.title)`;
    }),
    " AND "
  );
}

// How close a typo has to be (pg_trgm's default 0.6 misses "samsng").
const TYPO_THRESHOLD = 0.5;

// The threshold is a session setting: set it and query on the same connection.
async function withTypoThreshold<T>(query: Prisma.PrismaPromise<T>) {
  const [, rows] = await prisma.$transaction([prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = ${TYPO_THRESHOLD}`), query]);
  return rows;
}

async function listingIdsForText(words: string[]) {
  if (!words.length) return [];
  const rows = await withTypoThreshold(prisma.$queryRaw<{ id: string }[]>`
    SELECT l.id FROM "Listing" l
    WHERE l.status = 'ACTIVE' AND l."hiddenAt" IS NULL AND ${wordsMatch(words, "l")}
    ORDER BY l."createdAt" DESC
    LIMIT ${MAX_TEXT_MATCHES}`);
  return rows.map((r) => r.id);
}

export async function ibayIdsForText(words: string[], limit: number) {
  if (!words.length) return [];
  const rows = await withTypoThreshold(prisma.$queryRaw<{ id: string }[]>`
    SELECT i.id FROM "IbayItem" i
    WHERE i."hiddenAt" IS NULL AND i."claimedListingId" IS NULL AND ${wordsMatch(words, "i")}
    ORDER BY i.id DESC
    LIMIT ${limit}`);
  return rows.map((r) => r.id);
}

// Categories a search names ("phones", "mobile", "sofa"), with everything under them.
export function categoryIdsForQuery(index: CategoryIndex, q: string) {
  return [...new Set(categoriesMatchingQuery(index, q).flatMap((c) => descendants(index, c.slug).map((d) => d.id)))];
}

// ---- category details ----------------------------------------------------------

export function attributeWhere(attrs: AttrFilters | undefined): Prisma.ListingWhereInput[] {
  if (!attrs) return [];
  return Object.entries(attrs).flatMap(([key, v]): Prisma.ListingWhereInput[] => {
    if (Array.isArray(v)) return v.length ? [{ OR: v.map((option) => ({ attributes: { path: [key], equals: option } })) }] : [];
    const range: Prisma.ListingWhereInput[] = [];
    if (v.min !== undefined) range.push({ attributes: { path: [key], gte: v.min } });
    if (v.max !== undefined) range.push({ attributes: { path: [key], lte: v.max } });
    return range;
  });
}

export async function listingWhere(f: ListingFilters, hidden: string[] = []): Promise<Prisma.ListingWhereInput> {
  const index = await categoryIndex();
  const categoryIds = f.categorySlug ? descendants(index, f.categorySlug).map((c) => c.id) : undefined;
  let text: Prisma.ListingWhereInput | undefined;
  if (f.q) {
    const words = searchWords(f.q);
    const [ids, fromCategories] = [await listingIdsForText(words.length ? words : [f.q.toLowerCase()]), categoryIdsForQuery(index, f.q)];
    text = { OR: [{ id: { in: ids } }, ...(fromCategories.length ? [{ categoryId: { in: fromCategories } }] : [])] };
  }
  const and = [...attributeWhere(f.attrs), ...(text ? [text] : [])];
  return {
    status: "ACTIVE",
    hiddenAt: null,
    sellerId: hidden.length ? { notIn: hidden } : undefined,
    // An unknown slug matches nothing rather than everything.
    categoryId: categoryIds ? { in: categoryIds } : undefined,
    islandId: f.islandId ?? undefined,
    island: f.atollId ? { atollId: f.atollId } : undefined,
    condition: f.condition ?? undefined,
    deliveryOptions: f.delivery ? { has: f.delivery } : undefined,
    price: { gte: f.minPrice ?? undefined, lte: f.maxPrice ?? undefined },
    createdAt: f.postedWithin ? { gte: new Date(Date.now() - f.postedWithin * 86_400_000) } : undefined,
    priceDroppedAt: f.reduced ? { not: null } : undefined,
    AND: and.length ? and : undefined,
  };
}
