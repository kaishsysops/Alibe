import { z } from "zod";
import { prisma } from "../db.js";
import { safeRouter } from "../http.js";
import { moneySettings } from "../money.js";
import { serializeListings, listingInclude, publicUser, ratingsFor } from "../serializers.js";
import { sellerBadges, standing, uniqueStoreSlug } from "../sellers.js";
import { makeIdPrivate } from "./slips.js";
import { sellerCardState } from "../orderCard.js";
import { cardMode } from "../bml.js";
import { notifyUser } from "../push.js";
import { sendNoticeEmail } from "../messaging.js";

// A seller's own side: their standing, choosing individual or store, the ID
// check, and the store application. Plus public store pages.
export const sellersRouter = safeRouter();
export const storesRouter = safeRouter();

const uploadPath = z.string().regex(/^\/uploads\/[\w.-]+$/);

// Everything the Profile "Seller account" card and the plans screen need.
sellersRouter.get("/me", async (req, res) => {
  const st = await standing(req.userId!);
  if (!st) return res.status(404).json({ error: "Your account couldn't be found. Please sign in again." });
  const [applications, m] = await Promise.all([
    prisma.sellerApplication.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, kind: true, status: true, note: true, createdAt: true, decidedAt: true },
    }),
    moneySettings(),
  ]);
  const latest = (kind: "VERIFY" | "STORE") => applications.find((a) => a.kind === kind) ?? null;
  res.json({
    ...st,
    verifyApplication: latest("VERIFY"),
    storeApplication: latest("STORE"),
    prices: m.sellerPlans,
    premiumFreeBoosts: m.premiumFreeBoosts,
  });
});

// ---- card payments for item sales (Premium sellers and stores; src/orderCard.ts) ----

const maskAccount = (n: string) => `•••• ${n.slice(-4)}`;

// The seller's card switch, payout account (masked) and their card sales so far.
sellersRouter.get("/card-payments", async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: "Please sign in again." });
  const [state, account, m, mode, sums] = await Promise.all([
    sellerCardState(req.userId),
    prisma.payoutAccount.findUnique({ where: { userId: req.userId } }),
    moneySettings(),
    cardMode(),
    prisma.cardPayment.groupBy({ by: ["status"], where: { sellerId: req.userId, status: { in: ["HELD", "PAYOUT_DUE", "PAID_OUT"] } }, _sum: { amount: true, fee: true }, _count: true }),
  ]);
  const total = (status: string) => {
    const r = sums.find((x) => x.status === status);
    return { count: r?._count ?? 0, payout: (r?._sum.amount ?? 0) - (r?._sum.fee ?? 0) };
  };
  res.json({
    ...state,
    mode,
    feePercent: m.cardFeePercent,
    holdDays: m.cardHoldDays,
    account: account ? { bankName: account.bankName, accountName: account.accountName, accountNumber: maskAccount(account.accountNumber), changedAt: account.detailsChangedAt } : null,
    held: total("HELD"),
    payoutDue: total("PAYOUT_DUE"),
    paidOut: total("PAID_OUT"),
  });
});

const cardSettingsSchema = z.object({
  on: z.boolean(),
  // Only when adding or changing the payout account (always the full details).
  account: z
    .object({
      bankName: z.string().trim().min(2).max(60),
      accountName: z.string().trim().min(2).max(80),
      accountNumber: z.string().trim().transform((v) => v.replace(/[\s-]/g, "")).pipe(z.string().regex(/^\d{6,20}$/)),
    })
    .optional(),
});

sellersRouter.put("/card-payments", async (req, res) => {
  if (!req.userId) return res.status(401).json({ error: "Please sign in again." });
  const parsed = cardSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path.at(-1) ?? "");
    return res.status(400).json({ error: field === "accountNumber" ? "Enter the account number: digits only, as on your bank card or statement." : field === "accountName" ? "Enter the name on the bank account." : "Choose your bank." });
  }
  const { on, account } = parsed.data;
  const [state, existing] = await Promise.all([sellerCardState(req.userId), prisma.payoutAccount.findUnique({ where: { userId: req.userId } })]);
  if (on && !state.eligible) return res.status(403).json({ error: "Card payments come with Premium or a Store plan.", code: "NEEDS_PLAN" });
  if (on && !existing && !account) return res.status(400).json({ error: "Add the bank account you want to be paid to first." });

  const changed = !!account && !!existing && (account.accountNumber !== existing.accountNumber || account.accountName !== existing.accountName || account.bankName !== existing.bankName);
  const now = new Date();
  if (account) {
    await prisma.payoutAccount.upsert({
      where: { userId: req.userId },
      create: { userId: req.userId, cardPaymentsOn: on, ...account, detailsChangedAt: now },
      update: { cardPaymentsOn: on, ...account, ...(changed ? { detailsChangedAt: now } : {}) },
    });
  } else if (existing) {
    await prisma.payoutAccount.update({ where: { userId: req.userId }, data: { cardPaymentsOn: on } });
  }
  // A new payout account is what someone in a stolen account would change:
  // tell the owner everywhere, so they can stop it.
  if (changed) {
    const title = "Your payout bank account was changed";
    const body = `Card sales will now be paid to ${account!.bankName} ${maskAccount(account!.accountNumber)}. If this wasn't you, contact help@alibe.online right away.`;
    notifyUser(req.userId, title, body, { type: "seller-account" });
    const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } });
    void sendNoticeEmail(u?.email, title, body);
  }
  res.json({ ok: true });
});

// Picked during sign-up, changeable later. Stores still need an approved
// application (and a plan) before they show as a store.
sellersRouter.post("/kind", async (req, res) => {
  const parsed = z.object({ kind: z.enum(["INDIVIDUAL", "STORE"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose individual or store." });
  await prisma.user.update({ where: { id: req.userId! }, data: { sellerKind: parsed.data.kind } });
  res.json({ kind: parsed.data.kind });
});

const idSchema = z.object({
  idNumber: z.string().trim().regex(/^[A-Za-z0-9-]{5,20}$/, "id"),
  // Both sides of the ID card. No selfies: Alibe doesn't collect faces.
  idFront: uploadPath,
  idBack: uploadPath,
});

// Moves the photos out of public uploads into private ID storage.
async function storeIdPhotos(p: { idFront: string; idBack: string }) {
  const [idFront, idBack] = await Promise.all([makeIdPrivate(p.idFront), makeIdPrivate(p.idBack)]);
  if (!idFront || !idBack) return null;
  return { idFront, idBack };
}

const pendingOf = (userId: string, kind: "VERIFY" | "STORE") => prisma.sellerApplication.findFirst({ where: { userId, kind, status: "PENDING" } });

sellersRouter.post("/apply/verify", async (req, res) => {
  const parsed = idSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Add your ID card number and photos of both sides of the card." });
  const userId = req.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { verificationStatus: true } });
  if (user?.verificationStatus === "VERIFIED") return res.status(400).json({ error: "You're already verified." });
  if (await pendingOf(userId, "VERIFY")) return res.status(409).json({ error: "Your ID check is already waiting. We'll let you know soon." });
  const photos = await storeIdPhotos(parsed.data);
  if (!photos) return res.status(400).json({ error: "Please add the photos again." });
  const app = await prisma.sellerApplication.create({
    data: { userId, kind: "VERIFY", idNumberLast4: parsed.data.idNumber.slice(-4), ...photos },
    select: { id: true, kind: true, status: true, createdAt: true },
  });
  res.status(201).json(app);
});

const storeSchema = z.object({
  name: z.string().trim().min(2).max(60),
  logoUrl: uploadPath.optional(),
  registrationNumber: z.string().trim().min(3).max(40),
  // The owner's ID check; not needed if they're already verified.
  idNumber: z.string().trim().regex(/^[A-Za-z0-9-]{5,20}$/).optional(),
  idFront: uploadPath.optional(),
  idBack: uploadPath.optional(),
});

sellersRouter.post("/apply/store", async (req, res) => {
  const parsed = storeSchema.safeParse(req.body);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const messages: Record<string, string> = {
      name: "Your store's name needs 2 to 60 characters.",
      registrationNumber: "Add your business registration number.",
      idNumber: "Check your ID card number.",
    };
    return res.status(400).json({ error: messages[field] ?? "Please check the details and try again." });
  }
  const userId = req.userId!;
  const body = parsed.data;
  const [user, existingStore] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { verificationStatus: true } }),
    prisma.store.findUnique({ where: { userId } }),
  ]);
  if (existingStore?.status === "APPROVED") return res.status(400).json({ error: "Your store is already approved." });
  if (await pendingOf(userId, "STORE")) return res.status(409).json({ error: "Your store application is already waiting. We'll let you know soon." });
  const verified = user?.verificationStatus === "VERIFIED";
  let photos: { idFront: string; idBack: string } | null = null;
  if (!verified) {
    if (!body.idNumber || !body.idFront || !body.idBack) return res.status(400).json({ error: "Add the owner's ID card number and photos of both sides of the card." });
    photos = await storeIdPhotos({ idFront: body.idFront, idBack: body.idBack });
    if (!photos) return res.status(400).json({ error: "Please add the ID photos again." });
  }
  const slug = await uniqueStoreSlug(body.name, existingStore?.id);
  const storeData = { name: body.name, slug, logoUrl: body.logoUrl ?? existingStore?.logoUrl ?? null, registrationNumber: body.registrationNumber, status: "PENDING" as const, rejectReason: null };
  await prisma.$transaction([
    existingStore ? prisma.store.update({ where: { userId }, data: storeData }) : prisma.store.create({ data: { userId, ...storeData } }),
    prisma.user.update({ where: { id: userId }, data: { sellerKind: "STORE" } }),
    prisma.sellerApplication.create({ data: { userId, kind: "STORE", idNumberLast4: body.idNumber?.slice(-4) ?? null, ...(photos ?? {}) } }),
  ]);
  res.status(201).json({ ok: true, slug });
});

// ---- public store pages: alibe.online/store/<slug> ----------------------------

storesRouter.get("/:slug", async (req, res) => {
  const store = await prisma.store.findUnique({ where: { slug: req.params.slug }, include: { user: true } });
  const badges = store ? await sellerBadges([store.userId]) : null;
  const live = !!store && store.status === "APPROVED" && !!badges?.get(store.userId)?.store && !store.user.bannedAt;
  if (!store || !live) return res.status(404).json({ error: "We couldn't find that store." });
  const [listings, ratings, count] = await Promise.all([
    // Only what's posted under the store (the owner's personal items aren't).
    prisma.listing.findMany({ where: { storeId: store.id, status: "ACTIVE", hiddenAt: null }, include: listingInclude, orderBy: { createdAt: "desc" }, take: 60 }),
    ratingsFor([store.userId]),
    prisma.listing.count({ where: { storeId: store.id, status: "ACTIVE", hiddenAt: null } }),
  ]);
  res.json({
    store: { name: store.name, slug: store.slug, logoUrl: store.logoUrl, since: store.approvedAt ?? store.createdAt },
    owner: { ...publicUser(store.user), badge: badges!.get(store.userId)!.badge, rating: ratings.get(store.userId) ?? { average: 0, count: 0 } },
    listingCount: count,
    listings: await serializeListings(listings),
  });
});
