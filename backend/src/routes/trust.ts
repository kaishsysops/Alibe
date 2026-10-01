import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { safeRouter, sendValidationError } from "../http.js";
import { publicUser } from "../serializers.js";

// Reviews, reports and blocks: the trust & safety endpoints.
export const reviewsRouter = safeRouter();
export const reportsRouter = safeRouter();
export const blocksRouter = safeRouter();

// ---- Reviews -----------------------------------------------------------------

reviewsRouter.get("/seller/:sellerId", async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { sellerId: req.params.sellerId },
    include: { reviewer: true, listing: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(reviews.map((r) => ({ ...r, reviewer: publicUser(r.reviewer) })));
});

// A buyer may review a seller once per item, and only for an item they
// actually discussed with that seller (a chat with at least one message).
reviewsRouter.get("/eligibility", async (req, res) => {
  const reviewerId = String(req.query.reviewerId ?? "");
  const listingId = String(req.query.listingId ?? "");
  const conversation = await prisma.conversation.findUnique({
    where: { listingId_buyerId: { listingId, buyerId: reviewerId } },
    include: { _count: { select: { messages: true } } },
  });
  const existing = await prisma.review.findUnique({ where: { reviewerId_listingId: { reviewerId, listingId } } });
  res.json({ eligible: !!conversation && conversation._count.messages > 0, existing });
});

const reviewSchema = z.object({
  reviewerId: z.string(),
  listingId: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().max(500).nullable().optional(),
});

reviewsRouter.post("/", async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    if (parsed.error.issues[0]?.path[0] === "rating") return res.status(400).json({ error: "Pick a rating from 1 to 5 stars." });
    return sendValidationError(res, parsed.error);
  }
  const { reviewerId, listingId, rating, text } = parsed.data;
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return res.status(404).json({ error: "This listing is no longer available." });
  if (listing.sellerId === reviewerId) return res.status(400).json({ error: "You can't review yourself." });
  const conversation = await prisma.conversation.findUnique({
    where: { listingId_buyerId: { listingId, buyerId: reviewerId } },
    include: { _count: { select: { messages: true } } },
  });
  if (!conversation || conversation._count.messages === 0) {
    return res.status(403).json({ error: "You can review a seller after chatting with them about an item." });
  }
  // Upsert: submitting twice edits the same review rather than adding another.
  const review = await prisma.review.upsert({
    where: { reviewerId_listingId: { reviewerId, listingId } },
    update: { rating, text: text || null },
    create: { reviewerId, listingId, sellerId: listing.sellerId, rating, text: text || null },
  });
  res.status(201).json(review);
});

// ---- Reports -----------------------------------------------------------------

const reportSchema = z
  .object({
    reporterId: z.string(),
    listingId: z.string().optional(),
    reportedUserId: z.string().optional(),
    reason: z.enum(["SCAM", "PROHIBITED", "WRONG_CATEGORY", "OFFENSIVE", "OTHER"]),
    details: z.string().trim().max(500).optional(),
  })
  .refine((r) => !!r.listingId !== !!r.reportedUserId, { message: "target" });

reportsRouter.post("/", async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please choose a reason for the report." });
  const { reporterId, listingId, reportedUserId, reason, details } = parsed.data;
  if (reportedUserId === reporterId) return res.status(400).json({ error: "You can't report yourself." });
  const data = { reason, details: details || null };
  const where = listingId ? { reporterId_listingId: { reporterId, listingId } } : { reporterId_reportedUserId: { reporterId, reportedUserId: reportedUserId! } };
  try {
    // Reporting the same thing again updates the earlier report.
    const report = await prisma.report.upsert({ where: where as any, update: data, create: { reporterId, listingId, reportedUserId, ...data } });
    res.status(201).json(report);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return res.status(200).json({ ok: true });
    throw e;
  }
});

// ---- Blocks ------------------------------------------------------------------

blocksRouter.get("/:userId", async (req, res) => {
  const blocks = await prisma.block.findMany({ where: { blockerId: req.params.userId }, include: { blocked: true }, orderBy: { createdAt: "desc" } });
  res.json(blocks.map((b) => ({ id: b.id, createdAt: b.createdAt, user: publicUser(b.blocked) })));
});

const blockSchema = z.object({ blockerId: z.string(), blockedId: z.string() });

blocksRouter.post("/", async (req, res) => {
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  if (parsed.data.blockerId === parsed.data.blockedId) return res.status(400).json({ error: "You can't block yourself." });
  try {
    const block = await prisma.block.upsert({ where: { blockerId_blockedId: parsed.data }, update: {}, create: parsed.data });
    res.status(201).json(block);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return res.status(200).json({ ok: true });
    throw e;
  }
});

blocksRouter.delete("/:blockerId/:blockedId", async (req, res) => {
  await prisma.block.deleteMany({ where: { blockerId: req.params.blockerId, blockedId: req.params.blockedId } });
  res.status(204).send();
});
