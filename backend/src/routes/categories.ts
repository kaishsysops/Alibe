import { prisma } from "../db.js";
import { safeRouter } from "../http.js";
import { cached } from "../cache.js";
import { ibayCountsByCategory } from "./ibay.js";

export const categoriesRouter = safeRouter();

// Read on every Home and Search visit: shared for 30 seconds. Each category
// carries how many items it has and the newest item's photo for its tile.
async function loadCategories() {
  const [categories, counts, photos, ibay] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.listing.groupBy({ by: ["categoryId"], where: { status: "ACTIVE", hiddenAt: null }, _count: { _all: true } }),
    prisma.$queryRaw<{ categoryId: string; photo: string }[]>`
      SELECT DISTINCT ON ("categoryId") "categoryId", images[1] AS photo
      FROM "Listing"
      WHERE status = 'ACTIVE' AND "hiddenAt" IS NULL AND cardinality(images) > 0
      ORDER BY "categoryId", "createdAt" DESC`,
    ibayCountsByCategory(),
  ]);
  const countBy = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  const photoBy = new Map(photos.map((p) => [p.categoryId, p.photo]));
  return categories.map((c) => ({ ...c, listingCount: (countBy.get(c.id) ?? 0) + (ibay.get(c.slug) ?? 0), photo: photoBy.get(c.id) ?? null }));
}

categoriesRouter.get("/", async (_req, res) => {
  res.json(await cached("categories", 30_000, loadCategories));
});
