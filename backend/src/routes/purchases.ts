import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../db.js";
import { safeRouter } from "../http.js";
import { prohibitedReason } from "../moderation.js";
import { notifyUser } from "../push.js";
import { isShowcaseOn } from "./ibay.js";
import { alibePrice, isReady, moneySettings } from "../money.js";
import { makeSlipPrivate } from "./slips.js";

// Boosts, ads and buy-for-you: what people buy from Alibe. Payment is a bank
// transfer with a reference and a slip; staff check the bank and approve, and only
// then does anything go live.
export const purchasesRouter = safeRouter();
export const adsRouter = safeRouter();

export const PLAN_DAYS = [3, 7, 30] as const;
type Plan = "3" | "7" | "30";

const newReference = () => `AL-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

// What customers need to buy something. Bank details come with an actual purchase,
// and the buy-for-you margin isn't theirs to see.
purchasesRouter.get("/config", async (_req, res) => {
  const m = await moneySettings();
  res.json({ boostPrices: m.boostPrices, adPrices: m.adPrices, ready: isReady(m) });
});

// The seller's price stays on staff screens.
const forBuyer = <T extends { itemPrice: number | null }>({ itemPrice: _hidden, ...purchase }: T) => purchase;

purchasesRouter.get("/mine", async (req, res) => {
  const m = await moneySettings();
  const purchases = await prisma.purchase.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ purchases: purchases.map(forBuyer), bank: { bankName: m.bankName, accountName: m.accountName, accountNumber: m.accountNumber } });
});

const planField = z.union([z.literal(3), z.literal(7), z.literal(30)]);
const uploadPath = z.string().regex(/^\/uploads\/[\w.-]+$/);

const createSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("BOOST"), clientRequestId: z.string().min(6).max(64), listingId: z.string(), days: planField }),
  z.object({
    kind: z.literal("AD"),
    clientRequestId: z.string().min(6).max(64),
    days: planField,
    adTitle: z.string().trim().min(3).max(60),
    adImage: uploadPath,
    listingId: z.string().optional(),
    adUrl: z.string().trim().url().startsWith("https://").max(300).optional(),
  }),
  z.object({
    kind: z.literal("BUY_FOR_YOU"),
    clientRequestId: z.string().min(6).max(64),
    ibayItemId: z.string(),
    deliveryNote: z.string().trim().min(5).max(300),
    contactPhone: z.string().trim().min(7).max(20),
  }),
]);

purchasesRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const messages: Record<string, string> = {
      adTitle: "Your ad needs a headline of 3 to 60 characters.",
      adImage: "Please add a photo for your ad.",
      adUrl: "Web links need to start with https://",
      deliveryNote: "Please tell us where to deliver it.",
      contactPhone: "Please enter a phone number we can reach you on.",
    };
    return res.status(400).json({ error: messages[field] ?? "Please check the details and try again." });
  }
  const body = parsed.data;
  const userId = req.userId!;
  // A retried tap gets the purchase it already made.
  const existing = await prisma.purchase.findUnique({ where: { clientRequestId: body.clientRequestId } });
  if (existing) return existing.userId === userId ? res.json(forBuyer(existing)) : res.status(409).json({ error: "Please try again." });

  const m = await moneySettings();
  if (!isReady(m)) return res.status(503).json({ error: "Alibe isn't taking payments just yet. Please try again soon." });
  const base = { userId, clientRequestId: body.clientRequestId, reference: newReference() };

  if (body.kind === "BOOST") {
    const listing = await prisma.listing.findUnique({ where: { id: body.listingId } });
    if (!listing || listing.sellerId !== userId) return res.status(403).json({ error: "You can only boost your own listings." });
    if (listing.status !== "ACTIVE" || listing.hiddenAt) return res.status(400).json({ error: "Only items on sale right now can be boosted." });
    const purchase = await prisma.purchase.create({
      data: { ...base, kind: "BOOST", status: "AWAITING_PAYMENT", listingId: listing.id, adTitle: listing.title, days: body.days, amount: m.boostPrices[String(body.days) as Plan] },
    });
    return res.status(201).json(forBuyer(purchase));
  }

  if (body.kind === "AD") {
    if (!!body.listingId === !!body.adUrl) return res.status(400).json({ error: "Choose where your ad should lead: one of your items, or a web link." });
    if (prohibitedReason(body.adTitle)) return res.status(400).json({ error: "Alibe can't run ads for that." });
    if (body.listingId) {
      const listing = await prisma.listing.findUnique({ where: { id: body.listingId }, select: { sellerId: true } });
      if (listing?.sellerId !== userId) return res.status(403).json({ error: "Ads can only lead to your own items." });
    }
    const purchase = await prisma.purchase.create({
      data: { ...base, kind: "AD", status: "AWAITING_PAYMENT", days: body.days, amount: m.adPrices[String(body.days) as Plan], adTitle: body.adTitle, adImage: body.adImage, listingId: body.listingId, adUrl: body.adUrl },
    });
    return res.status(201).json(forBuyer(purchase));
  }

  const item = (await isShowcaseOn()) ? await prisma.ibayItem.findUnique({ where: { id: body.ibayItemId } }) : null;
  if (!item || item.hiddenAt || item.claimedListingId) return res.status(404).json({ error: "This item is no longer available." });
  // A starting figure: staff confirm the final total, with delivery, before any payment.
  const estimate = item.price ? alibePrice(m, item.price) : 0;
  const purchase = await prisma.purchase.create({
    data: {
      ...base,
      kind: "BUY_FOR_YOU",
      status: "REQUESTED",
      amount: estimate,
      ibayItemId: item.id,
      itemTitle: item.title.slice(0, 200),
      itemUrl: item.url,
      itemPrice: item.price,
      deliveryNote: body.deliveryNote,
      contactPhone: body.contactPhone,
    },
  });
  res.status(201).json(forBuyer(purchase));
});

const slipSchema = z.object({ slipUrl: uploadPath });

purchasesRouter.post("/:id/slip", async (req, res) => {
  const parsed = slipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please add a photo of your payment slip." });
  const where = { id: req.params.id, userId: req.userId, status: { in: ["AWAITING_PAYMENT" as const, "SUBMITTED" as const] } };
  if (!(await prisma.purchase.count({ where }))) return res.status(409).json({ error: "This purchase can't take a slip right now." });
  // Slips show bank details: move the photo out of the public uploads folder.
  const slipUrl = await makeSlipPrivate(parsed.data.slipUrl);
  if (!slipUrl) return res.status(400).json({ error: "Please add the photo of your slip again." });
  const { count } = await prisma.purchase.updateMany({ where, data: { slipUrl, status: "SUBMITTED" } });
  if (!count) return res.status(409).json({ error: "This purchase can't take a slip right now." });
  res.status(204).send();
});

purchasesRouter.post("/:id/cancel", async (req, res) => {
  const { count } = await prisma.purchase.updateMany({
    where: { id: req.params.id, userId: req.userId, status: { in: ["REQUESTED", "AWAITING_PAYMENT"] } },
    data: { status: "CANCELLED" },
  });
  if (!count) return res.status(409).json({ error: "This can't be cancelled now. Please contact Alibe." });
  res.status(204).send();
});

// ---- Ads shown in the app ---------------------------------------------------------

const ADS_PER_REQUEST = 3;

adsRouter.get("/", async (_req, res) => {
  const running = await prisma.purchase.findMany({ where: { kind: "AD", status: "ACTIVE", endsAt: { gt: new Date() } }, select: { id: true, adTitle: true, adImage: true, adUrl: true, listingId: true } });
  // Everyone paying gets a fair turn.
  const ads = running.sort(() => Math.random() - 0.5).slice(0, ADS_PER_REQUEST);
  if (ads.length) await prisma.purchase.updateMany({ where: { id: { in: ads.map((a) => a.id) } }, data: { impressions: { increment: 1 } } });
  res.json(ads);
});

adsRouter.post("/:id/click", async (req, res) => {
  await prisma.purchase.updateMany({ where: { id: req.params.id, kind: "AD" }, data: { clicks: { increment: 1 } } });
  res.status(204).send();
});

export async function boostedListingIds() {
  const rows = await prisma.purchase.findMany({ where: { kind: "BOOST", status: "ACTIVE", endsAt: { gt: new Date() } }, select: { listingId: true } });
  return new Set(rows.map((r) => r.listingId));
}
