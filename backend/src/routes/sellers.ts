import { z } from "zod";
import { prisma } from "../db.js";
import { safeRouter } from "../http.js";
import { moneySettings } from "../money.js";
import { serializeListings, listingInclude, publicUser, ratingsFor } from "../serializers.js";
import { sellerBadges, standing, uniqueStoreSlug } from "../sellers.js";
import { makeIdPrivate } from "./slips.js";

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
  idFront: uploadPath,
  idBack: uploadPath.optional(),
  selfie: uploadPath,
});

// Moves the photos out of public uploads into private ID storage.
async function storeIdPhotos(p: { idFront: string; idBack?: string; selfie: string }) {
  const [idFront, idBack, selfie] = await Promise.all([makeIdPrivate(p.idFront), p.idBack ? makeIdPrivate(p.idBack) : null, makeIdPrivate(p.selfie)]);
  if (!idFront || !selfie) return null;
  return { idFront, idBack, selfie };
}

const pendingOf = (userId: string, kind: "VERIFY" | "STORE") => prisma.sellerApplication.findFirst({ where: { userId, kind, status: "PENDING" } });

sellersRouter.post("/apply/verify", async (req, res) => {
  const parsed = idSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Add your ID card number, a photo of the card and a selfie holding it." });
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
  selfie: uploadPath.optional(),
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
  let photos: { idFront: string; idBack: string | null; selfie: string } | null = null;
  if (!verified) {
    if (!body.idNumber || !body.idFront || !body.selfie) return res.status(400).json({ error: "Add the owner's ID card number, a photo of the card and a selfie holding it." });
    photos = await storeIdPhotos({ idFront: body.idFront, idBack: body.idBack, selfie: body.selfie });
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
    prisma.listing.findMany({ where: { sellerId: store.userId, status: "ACTIVE", hiddenAt: null }, include: listingInclude, orderBy: { createdAt: "desc" }, take: 60 }),
    ratingsFor([store.userId]),
    prisma.listing.count({ where: { sellerId: store.userId, status: "ACTIVE", hiddenAt: null } }),
  ]);
  res.json({
    store: { name: store.name, slug: store.slug, logoUrl: store.logoUrl, since: store.approvedAt ?? store.createdAt },
    owner: { ...publicUser(store.user), badge: badges!.get(store.userId)!.badge, rating: ratings.get(store.userId) ?? { average: 0, count: 0 } },
    listingCount: count,
    listings: await serializeListings(listings),
  });
});
