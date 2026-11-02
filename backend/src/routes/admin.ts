import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { safeRouter } from "../http.js";
import { notifyUser } from "../push.js";
import { SHOWCASE_KEY, isShowcaseOn } from "./ibay.js";
import { MONEY_KEY, moneySettings } from "../money.js";

// The report queue: what people have flagged, and what staff did about it.
export const adminRouter = safeRouter();

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.userId ? await prisma.user.findUnique({ where: { id: req.userId }, select: { isAdmin: true } }) : null;
    if (!user?.isAdmin) return res.status(403).json({ error: "You can't do that from this account." });
    next();
  } catch (e) {
    next(e);
  }
}
adminRouter.use(requireAdmin);

// Open reports grouped by what they're about, most-reported first.
adminRouter.get("/reports", async (_req, res) => {
  const reports = await prisma.report.findMany({
    where: { resolvedAt: null },
    include: {
      listing: { select: { id: true, title: true, images: true, price: true, hiddenAt: true, seller: { select: { id: true, name: true, createdAt: true } } } },
      reportedUser: { select: { id: true, name: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const groups = new Map<string, any>();
  for (const r of reports) {
    const key = r.listingId ? `listing:${r.listingId}` : `user:${r.reportedUserId}`;
    if (!groups.has(key)) {
      groups.set(key, { key, listing: r.listing, user: r.listing ? r.listing.seller : r.reportedUser, reports: [], latestAt: r.createdAt });
    }
    groups.get(key).reports.push({ id: r.id, reason: r.reason, details: r.details, createdAt: r.createdAt });
  }
  res.json([...groups.values()].sort((a, b) => b.reports.length - a.reports.length));
});

// The private iBay catalogue, newest first.
const IBAY_PAGE_SIZE = 40;

adminRouter.get("/ibay", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const page = Math.max(0, Number(req.query.page) || 0);
  const where = q ? { title: { contains: q, mode: "insensitive" as const } } : {};
  const [items, total] = await Promise.all([
    prisma.ibayItem.findMany({ where, orderBy: { firstSeenAt: "desc" }, skip: page * IBAY_PAGE_SIZE, take: IBAY_PAGE_SIZE }),
    prisma.ibayItem.count({ where }),
  ]);
  res.json({ items, total, hasMore: (page + 1) * IBAY_PAGE_SIZE < total, showcaseOn: await isShowcaseOn() });
});

const showcaseSchema = z.object({ on: z.boolean() });

// The one switch for showing iBay items to everyone in the app.
adminRouter.post("/ibay/showcase", async (req, res) => {
  const parsed = showcaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please try that again." });
  const value = parsed.data.on ? "on" : "off";
  await prisma.appSetting.upsert({ where: { key: SHOWCASE_KEY }, update: { value }, create: { key: SHOWCASE_KEY, value } });
  res.json({ showcaseOn: parsed.data.on });
});

adminRouter.post("/ibay/:id/hide", async (req, res) => {
  const parsed = z.object({ hidden: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please try that again." });
  const { count } = await prisma.ibayItem.updateMany({ where: { id: req.params.id }, data: { hiddenAt: parsed.data.hidden ? new Date() : null } });
  if (!count) return res.status(404).json({ error: "We couldn't find that item." });
  if (!parsed.data.hidden) await prisma.ibayReport.deleteMany({ where: { itemId: req.params.id } });
  res.status(204).send();
});

// ---- Money ----------------------------------------------------------------------

const money = z.coerce.number().int().min(0).max(1_000_000);
const planPrices = z.object({ "3": money, "7": money, "30": money });
const settingsSchema = z.object({
  bankName: z.string().trim().max(60),
  accountName: z.string().trim().max(80),
  accountNumber: z.string().trim().max(40),
  feePercent: z.coerce.number().int().min(0).max(100),
  feeMinimum: money,
  boostPrices: planPrices,
  adPrices: planPrices,
});

adminRouter.get("/money", async (_req, res) => {
  const purchases = await prisma.purchase.findMany({
    where: { OR: [{ status: { in: ["REQUESTED", "AWAITING_PAYMENT", "SUBMITTED"] } }, { status: "ACTIVE", OR: [{ kind: "BUY_FOR_YOU" }, { endsAt: { gt: new Date() } }] }] },
    include: { user: { select: { id: true, name: true, phone: true, email: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ settings: await moneySettings(), purchases });
});

adminRouter.put("/money/settings", async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the amounts and try again." });
  const value = JSON.stringify(parsed.data);
  await prisma.appSetting.upsert({ where: { key: MONEY_KEY }, update: { value }, create: { key: MONEY_KEY, value } });
  res.json(parsed.data);
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("QUOTE"), amount: money.refine((a) => a > 0) }),
  z.object({ action: z.literal("APPROVE") }),
  z.object({ action: z.literal("COMPLETE") }),
  z.object({ action: z.literal("REJECT"), note: z.string().trim().min(3).max(200) }),
]);

const DAY_MS = 86_400_000;

// Every step only applies from the status before it, so a double tap does nothing.
adminRouter.post("/purchases/:id", async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the details and try again." });
  const body = parsed.data;
  const purchase = await prisma.purchase.findUnique({ where: { id: req.params.id } });
  if (!purchase) return res.status(404).json({ error: "We couldn't find that purchase." });
  const now = new Date();
  const move = (from: Array<typeof purchase.status>, data: Parameters<typeof prisma.purchase.updateMany>[0]["data"]) =>
    prisma.purchase.updateMany({ where: { id: purchase.id, status: { in: from } }, data });
  const label = purchase.itemTitle ?? purchase.adTitle ?? "your purchase";
  let changed = 0;
  let message: [string, string] | null = null;

  if (body.action === "QUOTE") {
    if (purchase.kind !== "BUY_FOR_YOU") return res.status(400).json({ error: "Only buy-for-you requests need a total." });
    changed = (await move(["REQUESTED"], { status: "AWAITING_PAYMENT", amount: body.amount })).count;
    message = ["It's available", `${label}: pay MVR ${body.amount.toLocaleString()} and we'll get it for you.`];
  } else if (body.action === "APPROVE") {
    const timed = purchase.kind !== "BUY_FOR_YOU";
    changed = (await move(["SUBMITTED"], { status: "ACTIVE", ...(timed ? { startsAt: now, endsAt: new Date(now.getTime() + (purchase.days ?? 0) * DAY_MS) } : {}) })).count;
    message = ["Payment confirmed", timed ? `${label} is live now.` : `We're getting ${label} for you.`];
  } else if (body.action === "COMPLETE") {
    changed = (await move(["ACTIVE"], { status: "COMPLETED" })).count;
    message = ["All done", `${label} is complete. Thanks for using Alibe.`];
  } else {
    changed = (await move(["REQUESTED", "AWAITING_PAYMENT", "SUBMITTED", "ACTIVE"], { status: "REJECTED", note: body.note })).count;
    message = ["Update on your purchase", `${label}: ${body.note}`];
  }
  if (!changed) return res.status(409).json({ error: "This purchase has already moved on. Please refresh." });
  if (message) notifyUser(purchase.userId, message[0], message[1], { type: "purchase", purchaseId: purchase.id });
  res.status(204).send();
});

const resolveSchema = z
  .object({
    listingId: z.string().optional(),
    reportedUserId: z.string().optional(),
    action: z.enum(["DISMISS", "REMOVE_LISTING", "BAN"]),
  })
  .refine((r) => !!r.listingId !== !!r.reportedUserId, { message: "target" })
  .refine((r) => r.action !== "REMOVE_LISTING" || !!r.listingId, { message: "target" });

adminRouter.post("/reports/resolve", async (req, res) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please choose what to do with this report." });
  const { listingId, reportedUserId, action } = parsed.data;
  const now = new Date();
  const listing = listingId ? await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, title: true, sellerId: true } }) : null;
  if (listingId && !listing) return res.status(404).json({ error: "This listing is no longer available." });
  const targetReports = listingId ? { listingId } : { reportedUserId };

  if (action === "DISMISS") {
    await prisma.$transaction([
      prisma.report.updateMany({ where: { ...targetReports, resolvedAt: null }, data: { resolvedAt: now } }),
      // Back on sale if the reports had auto-hidden it.
      ...(listingId ? [prisma.listing.update({ where: { id: listingId }, data: { hiddenAt: null } })] : []),
    ]);
    return res.status(204).send();
  }

  if (action === "REMOVE_LISTING") {
    await prisma.$transaction([
      prisma.report.updateMany({ where: { listingId, resolvedAt: null }, data: { resolvedAt: now } }),
      prisma.listing.update({ where: { id: listingId! }, data: { hiddenAt: now } }),
    ]);
    notifyUser(listing!.sellerId, "Your listing was removed", `"${listing!.title}" broke Alibe's rules.`, { type: "listing_removed" });
    return res.status(204).send();
  }

  const userId = listing ? listing.sellerId : reportedUserId!;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "We couldn't find that account." });
  if (user.isAdmin) return res.status(400).json({ error: "Staff accounts can't be banned here." });
  const contacts = [user.phone, user.email].filter((c): c is string => !!c);
  // Orders not sent yet can't happen now. One already on its way stays open so
  // the buyer can still confirm it or report a problem.
  const stranded = await prisma.order.findMany({
    where: { status: "AWAITING_DISPATCH", OR: [{ sellerId: userId }, { buyerId: userId }] },
    select: { id: true, sellerId: true, buyerId: true },
  });
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { bannedAt: now } }),
    prisma.bannedContact.createMany({ data: contacts.map((value) => ({ value })), skipDuplicates: true }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.listing.updateMany({ where: { sellerId: userId, hiddenAt: null }, data: { hiddenAt: now } }),
    prisma.order.updateMany({ where: { id: { in: stranded.map((o) => o.id) } }, data: { status: "CANCELLED" } }),
    prisma.report.updateMany({ where: { resolvedAt: null, OR: [{ reportedUserId: userId }, { listing: { sellerId: userId } }] }, data: { resolvedAt: now } }),
  ]);
  for (const o of stranded) {
    const other = o.sellerId === userId ? o.buyerId : o.sellerId;
    notifyUser(other, "Your order was cancelled", "The other person's account was closed for breaking Alibe's rules. Please don't send them any money.", { type: "order", orderId: o.id });
  }
  res.status(204).send();
});
