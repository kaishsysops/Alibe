import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const listingsRouter = Router();

const listQuerySchema = z.object({
  categorySlug: z.string().optional(),
  islandId: z.string().optional(),
  atollId: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]).optional(),
  q: z.string().optional(),
});

listingsRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { categorySlug, islandId, atollId, minPrice, maxPrice, condition, q } = parsed.data;

  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      category: categorySlug ? { slug: categorySlug } : undefined,
      islandId: islandId ?? undefined,
      island: atollId ? { atollId } : undefined,
      condition: condition ?? undefined,
      price: {
        gte: minPrice ?? undefined,
        lte: maxPrice ?? undefined,
      },
      title: q ? { contains: q, mode: "insensitive" } : undefined,
    },
    include: { category: true, island: { include: { atoll: true } }, seller: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(listings);
});

listingsRouter.get("/:id", async (req, res) => {
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: { category: true, island: { include: { atoll: true } }, seller: true },
  });
  if (!listing) return res.status(404).json({ error: "Not found" });
  res.json(listing);
});

const createListingSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(1),
  price: z.number().int().nonnegative(),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]),
  categoryId: z.string(),
  islandId: z.string(),
  sellerId: z.string(),
  images: z.array(z.string()).default([]),
});

listingsRouter.post("/", async (req, res) => {
  const parsed = createListingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const listing = await prisma.listing.create({
    data: parsed.data,
    include: { category: true, island: { include: { atoll: true } }, seller: true },
  });
  res.status(201).json(listing);
});

listingsRouter.get("/mine/:sellerId", async (req, res) => {
  const listings = await prisma.listing.findMany({
    where: { sellerId: req.params.sellerId },
    include: { category: true, island: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(listings);
});
