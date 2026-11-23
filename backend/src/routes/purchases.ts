import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../db.js";
import { bmlPaid, cardMode, createBmlTransaction, finishSimTransaction, getBmlTransaction, getSimTransaction, SIM_PREFIX } from "../bml.js";
import { activatePurchase } from "../purchaseActivation.js";
import { applyDiscount, discountFor } from "../promotions.js";
import { safeRouter } from "../http.js";
import { prohibitedReason } from "../moderation.js";
import { notifyUser } from "../push.js";
import { isShowcaseOn } from "./ibay.js";
import { alibePrice, isReady, moneySettings } from "../money.js";
import { makeSlipPrivate } from "./slips.js";
import { standing } from "../sellers.js";
import { invalidate } from "../cache.js";

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
// The price after any discount an admin is running (src/promotions.ts).
async function priced(kind: "BOOST" | "AD" | "STORE_PLAN" | "PREMIUM_PLAN", amount: number) {
  const d = await discountFor(kind);
  return d ? applyDiscount(amount, d.percent) : amount;
}

purchasesRouter.get("/config", async (_req, res) => {
  const m = await moneySettings();
  res.json({ boostPrices: m.boostPrices, adPrices: m.adPrices, sellerPlans: m.sellerPlans, premiumFreeBoosts: m.premiumFreeBoosts, ready: isReady(m), cardPayments: (await cardMode()) !== "off", cardMode: await cardMode() });
});

// The seller's price stays on staff screens.
const forBuyer = <T extends { itemPrice: number | null }>({ itemPrice: _hidden, ...purchase }: T) => purchase;

purchasesRouter.get("/mine", async (req, res) => {
  const m = await moneySettings();
  const purchases = await prisma.purchase.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ purchases: purchases.map(forBuyer), bank: { bankName: m.bankName, accountName: m.accountName, accountNumber: m.accountNumber }, cardPayments: (await cardMode()) !== "off", cardMode: await cardMode() });
});

const planField = z.union([z.literal(3), z.literal(7), z.literal(30)]);
const uploadPath = z.string().regex(/^\/uploads\/[\w.-]+$/);

const createSchema = z.discriminatedUnion("kind", [
  // useFree: one of Premium's free monthly boosts (always 7 days).
  z.object({ kind: z.literal("BOOST"), clientRequestId: z.string().min(6).max(64), listingId: z.string(), days: planField, useFree: z.boolean().optional() }),
  // Seller plans: a month or a year of Store or Premium.
  z.object({ kind: z.enum(["STORE_PLAN", "PREMIUM_PLAN"]), clientRequestId: z.string().min(6).max(64), period: z.enum(["MONTHLY", "YEARLY"]) }),
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
  const base = { userId, clientRequestId: body.clientRequestId, reference: newReference() };
  const st = await standing(userId);
  if (!st) return res.status(404).json({ error: "Your account couldn't be found. Please sign in again." });

  // A free Premium boost needs no payment: live at once for 7 days.
  if (body.kind === "BOOST" && body.useFree) {
    const listing = await prisma.listing.findUnique({ where: { id: body.listingId } });
    if (!listing || listing.sellerId !== userId) return res.status(403).json({ error: "You can only boost your own listings." });
    if (listing.status !== "ACTIVE" || listing.hiddenAt) return res.status(400).json({ error: "Only items on sale right now can be boosted." });
    if (st.freeBoosts.left < 1) return res.status(400).json({ error: "You've used this month's free boosts. They come back on the 1st." });
    const now = new Date();
    const purchase = await prisma.purchase.create({
      data: { ...base, kind: "BOOST", status: "ACTIVE", listingId: listing.id, adTitle: listing.title, days: 7, amount: 0, startsAt: now, endsAt: new Date(now.getTime() + 7 * 86_400_000) },
    });
    invalidate("boosted");
    return res.status(201).json(forBuyer(purchase));
  }

  if (!isReady(m)) return res.status(503).json({ error: "Alibe isn't taking payments just yet. Please try again soon." });

  if (body.kind === "STORE_PLAN" || body.kind === "PREMIUM_PLAN") {
    if (body.kind === "STORE_PLAN" && st.store?.status !== "APPROVED") {
      return res.status(400).json({ error: "Your store needs to be approved first. Apply in Profile > Seller account." });
    }
    if (body.kind === "PREMIUM_PLAN" && !st.approved) {
      return res.status(400).json({ error: "Premium is for verified sellers and approved stores. Get verified first (it's free)." });
    }
    const yearly = body.period === "YEARLY";
    const p = m.sellerPlans;
    const amount = await priced(body.kind, body.kind === "STORE_PLAN" ? (yearly ? p.storeYearly : p.storeMonthly) : yearly ? p.premiumYearly : p.premiumMonthly);
    const label = `${body.kind === "STORE_PLAN" ? "Store" : "Premium"} plan, ${yearly ? "1 year" : "1 month"}`;
    const purchase = await prisma.purchase.create({ data: { ...base, kind: body.kind, status: "AWAITING_PAYMENT", days: yearly ? 365 : 30, amount, adTitle: label } });
    return res.status(201).json(forBuyer(purchase));
  }

  if (body.kind === "BOOST") {
    const listing = await prisma.listing.findUnique({ where: { id: body.listingId } });
    if (!listing || listing.sellerId !== userId) return res.status(403).json({ error: "You can only boost your own listings." });
    if (listing.status !== "ACTIVE" || listing.hiddenAt) return res.status(400).json({ error: "Only items on sale right now can be boosted." });
    if (!st.canBoost) return res.status(403).json({ error: "Boosts are for verified sellers and stores. Get verified (it's free) to boost.", code: "VERIFY_TO_BOOST" });
    const purchase = await prisma.purchase.create({
      data: { ...base, kind: "BOOST", status: "AWAITING_PAYMENT", listingId: listing.id, adTitle: listing.title, days: body.days, amount: await priced("BOOST", m.boostPrices[String(body.days) as Plan]) },
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
      data: { ...base, kind: "AD", status: "AWAITING_PAYMENT", days: body.days, amount: await priced("AD", m.adPrices[String(body.days) as Plan]), adTitle: body.adTitle, adImage: body.adImage, listingId: body.listingId, adUrl: body.adUrl },
    });
    return res.status(201).json(forBuyer(purchase));
  }

  if (body.kind !== "BUY_FOR_YOU") return res.status(400).json({ error: "Please check the details and try again." });
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

// ---- card payments (BML Connect, src/bml.ts; untested until a key is set) ----

const publicUrl = () => process.env.PUBLIC_URL ?? "https://alibe.online";

// Starts paying a purchase by card: returns BML's payment page to open.
purchasesRouter.post("/:id/pay-card", async (req, res) => {
  if ((await cardMode()) === "off") return res.status(503).json({ error: "Card payments aren't set up yet. Please pay by bank transfer.", code: "CARD_NOT_SET_UP" });
  const purchase = await prisma.purchase.findUnique({ where: { id: req.params.id } });
  if (!purchase || purchase.userId !== req.userId) return res.status(404).json({ error: "We couldn't find that purchase." });
  if (purchase.status !== "AWAITING_PAYMENT") return res.status(409).json({ error: "This purchase isn't waiting for payment." });
  try {
    const tx = await createBmlTransaction({ amountMvr: purchase.amount, reference: purchase.reference, redirectUrl: `${publicUrl()}/purchases?paid=${purchase.id}`, purchaseId: purchase.id, site: publicUrl() });
    if (!tx.id || !tx.url) throw new Error(`BML returned no transaction: ${JSON.stringify(tx).slice(0, 200)}`);
    await prisma.purchase.update({ where: { id: purchase.id }, data: { gatewayRef: tx.id } });
    res.json({ url: tx.url });
  } catch (e) {
    console.error("[bml] create", e);
    res.status(502).json({ error: "Card payment isn't working right now. Please pay by bank transfer." });
  }
});

// Back from BML's page: ask BML whether it was paid, and start it if so.
async function settleCardPayment(purchaseId: string) {
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase?.gatewayRef) return purchase?.status ?? null;
  const simulated = purchase.gatewayRef.startsWith(SIM_PREFIX);
  // A live transaction needs the key; a test one is ours to look up.
  if (!simulated && (await cardMode()) !== "live") return purchase.status;
  if (purchase.status !== "AWAITING_PAYMENT" && purchase.status !== "SUBMITTED") return purchase.status;
  const tx = await getBmlTransaction(purchase.gatewayRef);
  if (bmlPaid(tx, { amountMvr: purchase.amount, reference: purchase.reference })) {
    if (await activatePurchase(purchase.id, ["AWAITING_PAYMENT", "SUBMITTED"])) {
      // Staff can see at a glance which ones were test payments.
      if (simulated) await prisma.purchase.update({ where: { id: purchase.id }, data: { note: "Test card payment (simulated): no money was taken." } });
    }
    return "ACTIVE";
  }
  return purchase.status;
}

purchasesRouter.post("/:id/check-card", async (req, res) => {
  const purchase = await prisma.purchase.findUnique({ where: { id: req.params.id }, select: { userId: true } });
  if (!purchase || purchase.userId !== req.userId) return res.status(404).json({ error: "We couldn't find that purchase." });
  try {
    res.json({ status: await settleCardPayment(req.params.id) });
  } catch (e) {
    console.error("[bml] check", e);
    res.status(502).json({ error: "We couldn't check the card payment yet. Pull down to refresh in a minute." });
  }
});

// BML's notification that a transaction changed. Its body isn't trusted: we
// look the transaction up ourselves. Always answers 200 so BML doesn't retry
// forever on a purchase we don't know.
export async function bmlWebhook(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const id = String(b.transactionId ?? b.id ?? (b.transaction as Record<string, unknown> | undefined)?.id ?? "");
  if (!id || (await cardMode()) === "off") return;
  const purchase = await prisma.purchase.findUnique({ where: { gatewayRef: id }, select: { id: true } });
  if (purchase) await settleCardPayment(purchase.id).catch((e) => console.error("[bml] webhook", e));
}

// ---- the test checkout (simulated mode; stands in for BML's payment page) ----

// What the checkout page shows. Only the buyer can open it.
purchasesRouter.get("/test-checkout/:tx", async (req, res) => {
  const tx = await getSimTransaction(req.params.tx);
  const purchase = tx ? await prisma.purchase.findUnique({ where: { id: tx.purchaseId }, select: { userId: true, kind: true, adTitle: true, itemTitle: true } }) : null;
  if (!tx || !purchase || purchase.userId !== req.userId) return res.status(404).json({ error: "This payment link isn't valid." });
  res.json({ id: tx.id, amount: (tx.amount ?? 0) / 100, currency: tx.currency, reference: tx.localId, state: tx.state, what: purchase.itemTitle ?? purchase.adTitle ?? "Alibe purchase", returnTo: `/purchases?paid=${tx.purchaseId}` });
});

// Pay or decline on the test checkout. Then, like BML, it notifies us; the
// app also checks when it comes back.
purchasesRouter.post("/test-checkout/:tx", async (req, res) => {
  const approve = req.body?.approve === true;
  const tx = await getSimTransaction(req.params.tx);
  const purchase = tx ? await prisma.purchase.findUnique({ where: { id: tx.purchaseId }, select: { userId: true } }) : null;
  if (!tx || !purchase || purchase.userId !== req.userId) return res.status(404).json({ error: "This payment link isn't valid." });
  if ((await cardMode()) !== "simulated") return res.status(409).json({ error: "Test card payments have been switched off." });
  const done = await finishSimTransaction(tx.id, approve);
  if (done?.state === "CONFIRMED") await bmlWebhook({ transactionId: tx.id });
  res.json({ state: done?.state, returnTo: `/purchases?paid=${tx.purchaseId}` });
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
