import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { safeRouter, normalizeEmail } from "../http.js";
import { envStaffEmails, saveStaffInvites, staffInvites } from "../staff.js";
import { notifyUser } from "../push.js";
import { SHOWCASE_KEY, isShowcaseOn } from "./ibay.js";
import { MONEY_KEY, moneySettings } from "../money.js";
import { ratingsFor } from "../serializers.js";
import { signedSlipUrl } from "./slips.js";
import { invalidate } from "../cache.js";
import { Prisma } from "@prisma/client";
import { categoryIndex, clearCategoryCaches, descendants } from "../categories.js";

// Feeds are cached for up to a minute; staff changes show at once on the
// server that handled them (other replicas catch up within the minute).
const clearFeedCaches = () => ["categories", "home:", "ibay:", "boosted"].forEach(invalidate);

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
  clearFeedCaches();
  res.json({ showcaseOn: parsed.data.on });
});

adminRouter.post("/ibay/:id/hide", async (req, res) => {
  const parsed = z.object({ hidden: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please try that again." });
  const { count } = await prisma.ibayItem.updateMany({ where: { id: req.params.id }, data: { hiddenAt: parsed.data.hidden ? new Date() : null } });
  if (!count) return res.status(404).json({ error: "We couldn't find that item." });
  if (!parsed.data.hidden) await prisma.ibayReport.deleteMany({ where: { itemId: req.params.id } });
  clearFeedCaches();
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
  // Slips are private: staff get links that work for an hour.
  res.json({ settings: await moneySettings(), purchases: purchases.map((p) => ({ ...p, slipUrl: signedSlipUrl(p.slipUrl) })) });
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
  const error = await banUser(userId);
  if (error) return res.status(error.status).json({ error: error.message });
  res.status(204).send();
});

// Closes an account: listings come down, sessions end, unsent orders are
// cancelled and the phone/email can't sign up again. Returns an error to send,
// or null on success.
async function banUser(userId: string): Promise<{ status: number; message: string } | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isSystem) return { status: 404, message: "We couldn't find that account." };
  if (user.isAdmin) return { status: 400, message: "Staff accounts can't be banned here." };
  if (user.bannedAt) return null;
  const now = new Date();
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
  return null;
}

// Reopens a banned account. Only listings that came down with the ban go back
// up; ones removed earlier for breaking the rules stay down.
async function unbanUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.bannedAt) return;
  const contacts = [user.phone, user.email].filter((c): c is string => !!c);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { bannedAt: null } }),
    prisma.bannedContact.deleteMany({ where: { value: { in: contacts } } }),
    prisma.listing.updateMany({ where: { sellerId: userId, hiddenAt: user.bannedAt }, data: { hiddenAt: null } }),
  ]);
}

// Every account that has ever listed something, for the staff Sellers screen.
const SELLERS_PAGE_SIZE = 40;

adminRouter.get("/sellers", async (req, res) => {
  const q = String(req.query.q ?? "").trim().replace(/^@/, "").slice(0, 60);
  const page = Math.max(0, Number(req.query.page) || 0);
  const banned = req.query.banned === "1";
  const match = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { username: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q.replace(/[\s-]/g, "") } },
        ],
      }
    : {};
  const where = { isSystem: false, listings: { some: {} }, ...(banned ? { bannedAt: { not: null } } : {}), ...match };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        _count: {
          select: {
            listings: true,
            reportsAgainst: { where: { resolvedAt: null } },
          },
        },
      },
      orderBy: [{ listings: { _count: "desc" } }, { createdAt: "desc" }],
      skip: page * SELLERS_PAGE_SIZE,
      take: SELLERS_PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);
  const ids = users.map((u) => u.id);
  const [active, ratings] = await Promise.all([
    prisma.listing.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids }, status: "ACTIVE", hiddenAt: null }, _count: { _all: true } }),
    ratingsFor(ids),
  ]);
  const activeBy = new Map(active.map((a) => [a.sellerId, a._count._all]));
  res.json({
    total,
    hasMore: (page + 1) * SELLERS_PAGE_SIZE < total,
    sellers: users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      phone: u.phone,
      email: u.email,
      avatarColor: u.avatarColor,
      avatarUrl: u.avatarUrl,
      verified: u.verificationStatus === "VERIFIED",
      isAdmin: u.isAdmin,
      createdAt: u.createdAt,
      bannedAt: u.bannedAt,
      totalListings: u._count.listings,
      activeListings: activeBy.get(u.id) ?? 0,
      openReports: u._count.reportsAgainst,
      rating: ratings.get(u.id) ?? { average: 0, count: 0 },
    })),
  });
});

adminRouter.post("/users/:id/ban", async (req, res) => {
  const error = await banUser(req.params.id);
  if (error) return res.status(error.status).json({ error: error.message });
  res.status(204).send();
});

adminRouter.post("/users/:id/unban", async (req, res) => {
  await unbanUser(req.params.id);
  res.status(204).send();
});

// Open disputes, oldest first, with each side's evidence count.
adminRouter.get("/disputes", async (_req, res) => {
  const orders = await prisma.order.findMany({
    where: { status: "DISPUTED" },
    include: {
      listing: { select: { id: true, title: true, images: true } },
      buyer: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
      _count: { select: { evidence: true } },
    },
    orderBy: { updatedAt: "asc" },
  });
  res.json(orders.map((o) => ({ id: o.id, amount: o.amount, problem: o.problem, updatedAt: o.updatedAt, conversationId: o.conversationId, deliveryMethod: o.deliveryMethod, cargoReceiptUrl: o.cargoReceiptUrl, listing: o.listing, buyer: o.buyer, seller: o.seller, evidenceCount: o._count.evidence })));
});

// ---- staff -----------------------------------------------------------------
// Staff are ordinary accounts with isAdmin. Adding an email that has an account
// makes it staff now; otherwise it waits as an invite until that email signs in.

adminRouter.get("/staff", async (_req, res) => {
  const fromEnv = envStaffEmails();
  const [staff, invites] = await Promise.all([
    prisma.user.findMany({
      where: { isAdmin: true, isSystem: false },
      select: { id: true, name: true, email: true, username: true, avatarColor: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
    staffInvites(),
  ]);
  res.json({
    // fixed: listed in the server's STAFF_EMAILS, so removing them here wouldn't stick.
    staff: staff.map((s) => ({ ...s, fixed: !!s.email && fromEnv.includes(s.email.toLowerCase()) })),
    invites,
  });
});

const staffEmailSchema = z.object({ email: z.string().transform(normalizeEmail).pipe(z.string().email()) });

adminRouter.post("/staff", async (req, res) => {
  const parsed = staffEmailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter a valid email address." });
  const { email } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.bannedAt) return res.status(400).json({ error: "That account is banned. Unban it first." });
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
    return res.json({ added: "now", name: user.name });
  }
  await saveStaffInvites([...(await staffInvites()), email]);
  res.json({ added: "invite" });
});

adminRouter.delete("/staff/invites/:email", async (req, res) => {
  const email = normalizeEmail(String(req.params.email));
  await saveStaffInvites((await staffInvites()).filter((e) => e !== email));
  res.json({ ok: true });
});

adminRouter.delete("/staff/:id", async (req, res) => {
  if (req.params.id === req.userId) return res.status(400).json({ error: "You can't remove yourself. Ask another staff member." });
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user?.isAdmin) return res.status(404).json({ error: "That person isn't staff." });
  if (user.email && envStaffEmails().includes(user.email.toLowerCase())) {
    return res.status(400).json({ error: "This email is set as staff on the server (STAFF_EMAILS). Remove it there." });
  }
  const others = await prisma.user.count({ where: { isAdmin: true, isSystem: false, id: { not: user.id } } });
  if (others === 0) return res.status(400).json({ error: "Alibe needs at least one staff member." });
  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: false } });
  res.json({ ok: true });
});

// ---- categories ---------------------------------------------------------------
// Staff own the tree after the first seed (src/categoryTree.ts is only the
// starting set). Depth is unlimited; order is whatever staff set.

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "category";

async function uniqueSlug(name: string) {
  const base = slugify(name);
  for (let i = 0; ; i++) {
    const slug = i ? `${base}-${i + 1}` : base;
    if (!(await prisma.category.findUnique({ where: { slug } }))) return slug;
  }
}

// Staff see hidden ones too, with how many items sit directly in each.
adminRouter.get("/categories", async (_req, res) => {
  const [rows, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.listing.groupBy({ by: ["categoryId"], where: { status: "ACTIVE", hiddenAt: null }, _count: { _all: true } }),
  ]);
  const countBy = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  res.json(rows.map((c) => ({ ...c, ownCount: countBy.get(c.id) ?? 0 })));
});

const categoryNameField = z.string().trim().min(2, "name").max(60);
const keywordsField = z.array(z.string().trim().toLowerCase().min(2).max(40)).max(60);

adminRouter.post("/categories", async (req, res) => {
  const parsed = z.object({ name: categoryNameField, parentId: z.string().nullable() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Give the category a name (2 to 60 letters)." });
  const { name, parentId } = parsed.data;
  if (parentId && !(await prisma.category.findUnique({ where: { id: parentId } }))) return res.status(404).json({ error: "That category no longer exists." });
  const last = await prisma.category.findFirst({ where: { parentId }, orderBy: { sortOrder: "desc" } });
  const created = await prisma.category.create({ data: { name, parentId, slug: await uniqueSlug(name), sortOrder: (last?.sortOrder ?? -1) + 1 } });
  clearCategoryCaches();
  res.status(201).json(created);
});

adminRouter.patch("/categories/:id", async (req, res) => {
  const parsed = z
    .object({ name: categoryNameField.optional(), keywords: keywordsField.optional(), hidden: z.boolean().optional(), icon: z.string().max(40).nullable().optional(), parentId: z.string().nullable().optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the name and search words." });
  const category = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!category) return res.status(404).json({ error: "That category no longer exists." });
  const data: Prisma.CategoryUncheckedUpdateInput = { ...parsed.data };
  if (parsed.data.parentId !== undefined && parsed.data.parentId !== category.parentId) {
    // Moving under itself or one of its own subcategories would make a loop.
    const index = await categoryIndex();
    if (parsed.data.parentId && descendants(index, category.slug).some((c) => c.id === parsed.data.parentId)) {
      return res.status(400).json({ error: "A category can't go inside one of its own subcategories." });
    }
    const last = await prisma.category.findFirst({ where: { parentId: parsed.data.parentId }, orderBy: { sortOrder: "desc" } });
    data.sortOrder = (last?.sortOrder ?? -1) + 1;
  }
  const updated = await prisma.category.update({ where: { id: category.id }, data });
  clearCategoryCaches();
  res.json(updated);
});

// Swaps with the neighbour above or below, after making the order 0..n-1.
adminRouter.post("/categories/:id/move", async (req, res) => {
  const direction = req.body?.direction === "up" ? -1 : 1;
  const category = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!category) return res.status(404).json({ error: "That category no longer exists." });
  const siblings = await prisma.category.findMany({ where: { parentId: category.parentId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const i = siblings.findIndex((s) => s.id === category.id);
  const j = i + direction;
  if (j < 0 || j >= siblings.length) return res.json({ ok: true });
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  await prisma.$transaction(siblings.map((s, order) => prisma.category.update({ where: { id: s.id }, data: { sortOrder: order } })));
  clearCategoryCaches();
  res.json({ ok: true });
});

// Only categories without subcategories. Their items move up to the parent,
// so nothing disappears; a top category with items can't be deleted (hide it).
adminRouter.delete("/categories/:id", async (req, res) => {
  const category = await prisma.category.findUnique({ where: { id: req.params.id }, include: { _count: { select: { children: true, listings: true } } } });
  if (!category) return res.json({ ok: true });
  if (category._count.children) return res.status(400).json({ error: "Delete or move its subcategories first." });
  const parent = category.parentId ? await prisma.category.findUnique({ where: { id: category.parentId } }) : null;
  if (!parent && category._count.listings) return res.status(400).json({ error: "This top category still has listings. Hide it instead." });
  await prisma.$transaction([
    ...(parent
      ? [
          prisma.listing.updateMany({ where: { categoryId: category.id }, data: { categoryId: parent.id } }),
          prisma.ibayItem.updateMany({ where: { alibeCategory: category.slug }, data: { alibeCategory: parent.slug } }),
        ]
      : []),
    prisma.category.delete({ where: { id: category.id } }),
  ]);
  clearCategoryCaches();
  res.json({ ok: true, movedTo: parent?.name ?? null });
});
