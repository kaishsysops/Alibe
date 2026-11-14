import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../db.js";
import { safeRouter } from "../http.js";
import { listingBlock, prohibitedReason } from "../moderation.js";
import { listingInclude, serializeListing } from "../serializers.js";
import { UPLOAD_DIR } from "./uploads.js";
import { Prisma } from "@prisma/client";
import { NOT_FOR_SALE } from "../ibayCategories.js";
import { categoryIndex, categoriesMatchingQuery, descendants } from "../categories.js";
import { ibayIdsForText, searchWords } from "../filters.js";
import { alibePrice, moneySettings, sellerPriceBound, MoneySettings } from "../money.js";

// iBay items shown to everyone in the app, always labelled as iBay's. These
// sellers aren't on Alibe, so buyers reach them by phone, WhatsApp or Viber, and
// a seller can move their item onto Alibe or take it down.
export const ibayRouter = safeRouter();

export const SHOWCASE_KEY = "ibayShowcase";
const PAGE_SIZE = 24;
const DETAILS_MAX_AGE_MS = 6 * 3600_000;
const REPORTS_TO_HIDE = 3;
const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const unavailable = "This item is no longer available.";

const MIXED_PER_CATEGORY = 12;
const MIXED_MATCHES = 40;

export const isShowcaseOn = async () => (await prisma.appSetting.findUnique({ where: { key: SHOWCASE_KEY } }))?.value === "on";

// Off until staff switch it on, so a fresh deployment never shows these by accident.
ibayRouter.use(async (_req, res, next) => {
  try {
    if (await isShowcaseOn()) return next();
    res.status(404).json({ error: unavailable });
  } catch (e) {
    next(e);
  }
});

// Sellers put their numbers in titles; contact details belong on the buttons.
const cleanTitle = (title: string) =>
  title
    .replace(/\b(call|viber|whatsapp|contact|tel|ph)\b[\s:./-]*(?:\+?\d[\d\s/-]{5,})?/gi, " ")
    // Phone numbers, with or without the +960 / 960 country code.
    .replace(/(?:\+?960[\s-]?)?\b\d{3}[\s-]?\d{4}\b/g, " ")
    .replace(/[|/\s-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const lastSeven = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").slice(-7);

// Listing photos carry the year they were posted in their path; anything older
// than last year has very likely sold already.
function recentPhotoFilter() {
  const year = new Date().getFullYear();
  return [year, year - 1].map((y) => ({ imageUrl: { contains: `/is1/small/${y}/` } }));
}

const summary = (m: MoneySettings, i: { id: string; title: string; imageUrl: string | null; price: number | null; currency: string | null; condition: string | null; category: string; alibeCategory: string | null }) => ({
  id: i.id,
  categorySlug: i.alibeCategory,
  title: cleanTitle(i.title) || i.title,
  imageUrl: i.imageUrl,
  price: i.price ? alibePrice(m, i.price) : null,
  currency: i.currency,
  condition: i.condition,
  category: i.category,
});

// Filters speak in the prices people see; rows store the seller's price.
const priceFilter = (m: MoneySettings, min?: number, max?: number) =>
  min !== undefined || max !== undefined
    ? { gte: min === undefined ? undefined : sellerPriceBound(m, min, Math.floor), lte: max === undefined ? undefined : sellerPriceBound(m, max, Math.ceil) }
    : undefined;

const withinPrice = (m: MoneySettings, sellerPrice: number | null, min?: number, max?: number) => {
  if (min === undefined && max === undefined) return true;
  if (!sellerPrice) return false;
  const shown = alibePrice(m, sellerPrice);
  return (min === undefined || shown >= min) && (max === undefined || shown <= max);
};

// The same filters Alibe's own search uses. iBay's cards give no location or
// delivery options, so those filters don't apply here (the app hides this section).
const itemsQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_SIZE).optional(),
  categorySlug: z.string().optional(),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
});

ibayRouter.get("/items", async (req, res) => {
  const parsed = itemsQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Please check your filters and try again." });
  const { q, page = 0, limit: take = PAGE_SIZE, categorySlug, condition, minPrice, maxPrice } = parsed.data;
  const [m, index] = await Promise.all([moneySettings(), categoryIndex()]);
  const rows = await prisma.ibayItem.findMany({
    where: {
      hiddenAt: null,
      claimedListingId: null,
      OR: recentPhotoFilter(),
      alibeCategory: categorySlug && categorySlug !== NOT_FOR_SALE ? { in: descendants(index, categorySlug).map((c) => c.slug) } : { notIn: [NOT_FOR_SALE] },
      conditionKey: condition,
      price: priceFilter(m, minPrice, maxPrice),
      id: q ? { in: await ibayIdsForText(searchWords(q).length ? searchWords(q) : [q.toLowerCase()], 2000) } : undefined,
    },
    orderBy: { id: "desc" },
    skip: page * take,
    take,
  });
  res.json({ items: rows.filter((r) => !prohibitedReason(r.title) && withinPrice(m, r.price, minPrice, maxPrice)).map((r) => summary(m, r)), hasMore: rows.length === take });
});

type MixFilters = { attrs?: object; postedWithin?: number; reduced?: string; alibeOnly?: string; q?: string; categorySlug?: string; condition?: "NEW" | "LIKE_NEW" | "GOOD" | "FAIR"; minPrice?: number; maxPrice?: number; islandId?: string; atollId?: string; delivery?: string };

// iBay items in the shape the app's listing cards use, for feeds that mix them
// with Alibe's own, at Alibe's price. `ibayItemId` is what keeps them identifiable:
// cards badge them "From iBay" and open the iBay item page. Location and delivery filters leave
// them out, because iBay's cards don't say where an item is or how it ships.
export async function mixedIbayListings(f: MixFilters, sort?: string) {
  // iBay's cards don't say where an item is, how it ships, or its details.
  // Nor do they have price-drop history; and some searches ask for Alibe sellers only.
  if (f.islandId || f.atollId || f.delivery || f.reduced || f.alibeOnly || (f.attrs && Object.keys(f.attrs).length) || !(await isShowcaseOn())) return [];
  const [m, index] = await Promise.all([moneySettings(), categoryIndex()]);
  const bySlug = new Map(index.rows.map((c) => [c.slug, { id: c.id, name: c.name, slug: c.slug, icon: c.icon, parentId: c.parentId }]));
  const under = (slug: string) => descendants(index, slug).map((c) => c.slug);
  // A search matches iBay titles (typos allowed) or the categories it names.
  let textMatch: Prisma.IbayItemWhereInput | undefined;
  if (f.q) {
    const words = searchWords(f.q);
    const named = categoriesMatchingQuery(index, f.q).flatMap((c) => under(c.slug));
    textMatch = { OR: [{ id: { in: await ibayIdsForText(words.length ? words : [f.q.toLowerCase()], MIXED_MATCHES * 4) } }, ...(named.length ? [{ alibeCategory: { in: named } }] : [])] };
  }
  const base: Prisma.IbayItemWhereInput = {
    hiddenAt: null,
    claimedListingId: null,
    AND: [{ OR: recentPhotoFilter() }, ...(textMatch ? [textMatch] : [])],
    conditionKey: f.condition,
    firstSeenAt: f.postedWithin ? { gte: new Date(Date.now() - f.postedWithin * 86_400_000) } : undefined,
    // A price sort or filter has nothing to go on without a price.
    price: priceFilter(m, f.minPrice, f.maxPrice) ?? (sort?.startsWith("price") ? { not: null } : undefined),
  };
  const find = (slugs: string[], take: number) => prisma.ibayItem.findMany({ where: { ...base, alibeCategory: { in: slugs } }, orderBy: { id: "desc" }, take });
  const tops = (index.children.get(null) ?? []).filter((c) => !c.hidden);
  // Without a search, every top category gets its share so Home's rows all fill up.
  const rows = f.categorySlug
    ? await find(under(f.categorySlug), MIXED_MATCHES)
    : f.q
    ? await prisma.ibayItem.findMany({ where: { ...base, alibeCategory: { notIn: [NOT_FOR_SALE] } }, orderBy: { id: "desc" }, take: MIXED_MATCHES })
    : (await Promise.all(tops.map((c) => find(under(c.slug), MIXED_PER_CATEGORY)))).flat();
  return rows
    .filter((r) => !prohibitedReason(r.title) && r.alibeCategory && bySlug.has(r.alibeCategory) && withinPrice(m, r.price, f.minPrice, f.maxPrice))
    .map((r) => ({
      id: `ibay-${r.id}`,
      ibayItemId: r.id,
      title: cleanTitle(r.title) || r.title,
      description: "",
      price: r.price ? alibePrice(m, r.price) : 0,
      condition: r.conditionKey ?? "GOOD",
      status: "ACTIVE" as const,
      images: r.imageUrl ? [r.imageUrl] : [],
      deliveryOptions: [],
      deliveryNote: null,
      category: bySlug.get(r.alibeCategory!)!,
      island: { id: "", name: "iBay seller", atollId: "" },
      seller: { id: "ibay-seller", name: "iBay seller", username: null, avatarColor: null, createdAt: r.firstSeenAt, verified: false, phone: null, whatsapp: null, viber: null, rating: { average: 0, count: 0 } },
      createdAt: r.firstSeenAt,
    }));
}

export async function ibayCountsByCategory() {
  if (!(await isShowcaseOn())) return new Map<string, number>();
  const groups = await prisma.ibayItem.groupBy({
    by: ["alibeCategory"],
    where: { hiddenAt: null, claimedListingId: null, OR: recentPhotoFilter(), alibeCategory: { notIn: [NOT_FOR_SALE] } },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.alibeCategory ?? "", g._count._all]));
}

// Reads the extra details off the item's public page. Returns null if iBay can't
// be reached, and "gone" once the listing has been taken down there.
async function fetchDetails(item: { id: string; url: string }) {
  let html: string;
  try {
    const res = await fetch(item.url, { headers: { "User-Agent": "AlibeImporter/1.0 (admin catalogue)" }, signal: AbortSignal.timeout(6000) });
    if (res.status === 404 || res.status === 410) return "gone" as const;
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }
  if (!html.includes("Listing ID")) return "gone" as const;
  const contactBlock = html.split("i-contact-btn-div")[1] ?? "";
  const description = html.match(/Description(?:&nbsp;|\s|<[^>]+>)*([\s\S]*?)Listing ID/)?.[1] ?? "";
  return {
    description: description.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").trim().slice(0, 4000) || null,
    phone: contactBlock.match(/href="tel:([\d+\s-]+)"/)?.[1].trim() ?? null,
    whatsapp: html.match(/wa\.me\/(\d{7,15})/)?.[1] ?? null,
    images: [...new Set([...html.matchAll(new RegExp(`https://img\\d\\.ibay\\.com\\.mv/is1/full/[^"' )]*item_${item.id}_[^"' )]+`, "g"))].map((m) => m[0]))].slice(0, MAX_PHOTOS),
    lastUpdated: html.match(/Last Updated\s*:\s*([0-9A-Za-z-]+)/)?.[1] ?? null,
    detailsFetchedAt: new Date(),
  };
}

async function loadItem(id: string) {
  const item = await prisma.ibayItem.findUnique({ where: { id } });
  if (!item || item.hiddenAt || item.claimedListingId || item.alibeCategory === NOT_FOR_SALE || prohibitedReason(item.title)) return null;
  if (item.detailsFetchedAt && Date.now() - item.detailsFetchedAt.getTime() < DETAILS_MAX_AGE_MS) return item;
  const details = await fetchDetails(item);
  if (details === "gone") {
    await prisma.ibayItem.update({ where: { id }, data: { hiddenAt: new Date() } });
    return null;
  }
  return details ? prisma.ibayItem.update({ where: { id }, data: details }) : item;
}

ibayRouter.get("/items/:id", async (req, res) => {
  const item = await loadItem(req.params.id);
  if (!item || prohibitedReason(item.description ?? "")) return res.status(404).json({ error: unavailable });
  const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { phone: true } });
  res.json({
    ...summary(await moneySettings(), item),
    url: item.url,
    description: item.description,
    images: item.images.length ? item.images : item.imageUrl ? [item.imageUrl] : [],
    lastUpdated: item.lastUpdated,
    contact: {
      phone: item.phone,
      whatsapp: item.whatsapp ?? item.phone,
      viber: item.phone,
    },
    isMine: !!item.phone && lastSeven(me?.phone) === lastSeven(item.phone),
    myPhoneMissing: !me?.phone,
  });
});

// Only someone signed in with the number on the listing counts as its seller.
async function requireSeller(id: string, userId: string | undefined) {
  const item = await loadItem(id);
  if (!item) return { status: 404, error: unavailable } as const;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (!item.phone || lastSeven(me?.phone) !== lastSeven(item.phone)) {
    return { status: 403, error: "Please sign in with the phone number shown on this listing." } as const;
  }
  return { item };
}

// The seller's own photos come across so the listing survives leaving iBay.
async function copyPhotos(urls: string[]) {
  const saved: string[] = [];
  for (const url of urls) {
    if (!/^https:\/\/img\d\.ibay\.com\.mv\//.test(url)) continue;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const body = res.ok && res.headers.get("content-type")?.startsWith("image/jpeg") ? Buffer.from(await res.arrayBuffer()) : null;
      if (!body || body.length > MAX_PHOTO_BYTES) continue;
      const name = `${crypto.randomUUID()}.jpg`;
      await fs.promises.writeFile(path.join(UPLOAD_DIR, name), body);
      saved.push(`/uploads/${name}`);
    } catch (e) {
      console.error("Couldn't copy an iBay photo:", e);
    }
  }
  return saved;
}

// Moves an item onto the seller's Alibe account. Pressing twice can't make two.
ibayRouter.post("/items/:id/claim", async (req, res) => {
  const clientRequestId = `ibay-${req.params.id}`;
  const already = await prisma.listing.findUnique({ where: { clientRequestId }, include: listingInclude });
  if (already) return already.sellerId === req.userId ? res.json(serializeListing(already)) : res.status(404).json({ error: unavailable });

  const seller = await requireSeller(req.params.id, req.userId);
  if ("error" in seller) return res.status(seller.status!).json({ error: seller.error });
  const { item } = seller;
  const block = await listingBlock(req.userId!);
  if (block) return res.status(block.status).json({ error: block.error, code: block.code });

  const [category, island] = await Promise.all([
    prisma.category.findUniqueOrThrow({ where: { slug: item.alibeCategory ?? "other" } }),
    prisma.island.findFirstOrThrow({ where: { name: { startsWith: "Mal" } } }),
  ]);
  const title = (cleanTitle(item.title) || item.title).slice(0, 80);
  const listing = await prisma.listing.create({
    data: {
      title,
      description: item.description || title,
      // Other currencies need the seller's own MVR price on the next screen.
      price: item.currency === "MVR" ? (item.price ?? 0) : 0,
      condition: item.conditionKey ?? "GOOD",
      images: await copyPhotos(item.images.length ? item.images : item.imageUrl ? [item.imageUrl] : []),
      categoryId: category.id,
      islandId: island.id,
      sellerId: req.userId!,
      clientRequestId,
    },
    include: listingInclude,
  });
  await prisma.ibayItem.update({ where: { id: item.id }, data: { claimedListingId: listing.id } });
  res.status(201).json(serializeListing(listing));
});

ibayRouter.post("/items/:id/remove", async (req, res) => {
  const seller = await requireSeller(req.params.id, req.userId);
  if ("error" in seller) return res.status(seller.status!).json({ error: seller.error });
  await prisma.ibayItem.update({ where: { id: seller.item.id }, data: { hiddenAt: new Date() } });
  res.status(204).send();
});

ibayRouter.post("/items/:id/report", async (req, res) => {
  const itemId = req.params.id;
  const parsed = z.string().safeParse(req.userId);
  if (!parsed.success) return res.status(401).json({ error: "Please sign in again." });
  if (!(await prisma.ibayItem.findUnique({ where: { id: itemId }, select: { id: true } }))) return res.status(404).json({ error: unavailable });
  await prisma.ibayReport.upsert({ where: { itemId_userId: { itemId, userId: parsed.data } }, update: {}, create: { itemId, userId: parsed.data } });
  if ((await prisma.ibayReport.count({ where: { itemId } })) >= REPORTS_TO_HIDE) {
    await prisma.ibayItem.updateMany({ where: { id: itemId, hiddenAt: null }, data: { hiddenAt: new Date() } });
  }
  res.status(204).send();
});
