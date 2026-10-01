import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { safeRouter, sendValidationError } from "../http.js";
import { listingInclude, serializeListing } from "../serializers.js";

export const favoritesRouter = safeRouter();

favoritesRouter.get("/:userId", async (req, res) => {
  const favorites = await prisma.favorite.findMany({
    where: { userId: req.params.userId },
    include: { listing: { include: listingInclude } },
    orderBy: { createdAt: "desc" },
  });
  res.json(favorites.map((f) => serializeListing(f.listing)));
});

const toggleSchema = z.object({ userId: z.string(), listingId: z.string() });

favoritesRouter.post("/", async (req, res) => {
  const parsed = toggleSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  try {
    const favorite = await prisma.favorite.upsert({
      where: { userId_listingId: parsed.data },
      update: {},
      create: parsed.data,
    });
    res.status(201).json(favorite);
  } catch (e) {
    // Rapid double-tap race: the favourite already exists, which is the goal.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(200).json(await prisma.favorite.findUnique({ where: { userId_listingId: parsed.data } }));
    }
    throw e;
  }
});

favoritesRouter.delete("/:userId/:listingId", async (req, res) => {
  await prisma.favorite
    .delete({ where: { userId_listingId: { userId: req.params.userId, listingId: req.params.listingId } } })
    .catch(() => null);
  res.status(204).send();
});
