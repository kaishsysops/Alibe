import { safeRouter } from "../http.js";
import { prisma } from "../db.js";

export const atollsRouter = safeRouter();

atollsRouter.get("/", async (_req, res) => {
  const atolls = await prisma.atoll.findMany({
    orderBy: { name: "asc" },
    include: { islands: { orderBy: { name: "asc" } } },
  });
  res.json(atolls);
});
