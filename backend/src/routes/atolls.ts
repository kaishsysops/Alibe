import { safeRouter } from "../http.js";
import { prisma } from "../db.js";
import { cached } from "../cache.js";

export const atollsRouter = safeRouter();

// Atolls and islands almost never change: shared for 5 minutes.
atollsRouter.get("/", async (_req, res) => {
  const atolls = await cached("atolls", 300_000, () =>
    prisma.atoll.findMany({
      orderBy: { name: "asc" },
      include: { islands: { orderBy: { name: "asc" } } },
    })
  );
  res.json(atolls);
});
