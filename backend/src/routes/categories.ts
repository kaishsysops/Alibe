import { prisma } from "../db.js";
import { safeRouter } from "../http.js";
import { ibayCountsByCategory } from "./ibay.js";

export const categoriesRouter = safeRouter();

categoriesRouter.get("/", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { listings: { where: { status: "ACTIVE", hiddenAt: null } } } } },
  });
  const ibay = await ibayCountsByCategory();
  res.json(categories.map(({ _count, ...c }) => ({ ...c, listingCount: _count.listings + (ibay.get(c.slug) ?? 0) })));
});
