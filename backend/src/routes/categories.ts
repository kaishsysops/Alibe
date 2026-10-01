import { prisma } from "../db.js";
import { safeRouter } from "../http.js";

export const categoriesRouter = safeRouter();

categoriesRouter.get("/", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { listings: { where: { status: "ACTIVE" } } } } },
  });
  res.json(categories.map(({ _count, ...c }) => ({ ...c, listingCount: _count.listings })));
});
