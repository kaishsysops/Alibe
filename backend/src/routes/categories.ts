import { z } from "zod";
import { prisma } from "../db.js";
import { safeRouter } from "../http.js";
import { cached } from "../cache.js";
import { ibayCountsByCategory } from "./ibay.js";
import { categoryIndex, effectiveAttributes, guessAttributes, cleanAttributes, isLeaf, pathOf, scoreCategories, categoriesMatchingQuery, CategoryIndex } from "../categories.js";
import { aiEnabled, aiExtractAttributes, aiPickCategory, aiUnderstandQuery } from "../ai.js";

export const categoriesRouter = safeRouter();

// The whole tree, flat (parentId + sortOrder), read on every Home and Search
// visit: shared for 30 seconds. Each category's count includes everything
// under it, and its photo is the newest item anywhere in its branch.
async function loadCategories() {
  const [index, counts, photos, ibay] = await Promise.all([
    categoryIndex(),
    prisma.listing.groupBy({ by: ["categoryId"], where: { status: "ACTIVE", hiddenAt: null }, _count: { _all: true } }),
    prisma.$queryRaw<{ categoryId: string; photo: string; at: Date }[]>`
      SELECT DISTINCT ON ("categoryId") "categoryId", images[1] AS photo, "createdAt" AS at
      FROM "Listing"
      WHERE status = 'ACTIVE' AND "hiddenAt" IS NULL AND cardinality(images) > 0
      ORDER BY "categoryId", "createdAt" DESC`,
    ibayCountsByCategory(),
  ]);
  const count = new Map<string, number>();
  const photo = new Map<string, { photo: string; at: number }>();
  const bubble = (id: string, n: number, p?: { photo: string; at: number }) => {
    for (const c of pathOf(index, id)) {
      count.set(c.id, (count.get(c.id) ?? 0) + n);
      if (p && (!photo.has(c.id) || photo.get(c.id)!.at < p.at)) photo.set(c.id, p);
    }
  };
  for (const c of counts) bubble(c.categoryId, c._count._all);
  for (const p of photos) bubble(p.categoryId, 0, { photo: p.photo, at: p.at.getTime() });
  for (const [slug, n] of ibay) {
    const c = index.bySlug.get(slug);
    if (c) bubble(c.id, n);
  }
  return index.rows
    .filter((c) => !c.hidden && !pathOf(index, c.id).some((a) => a.hidden))
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      parentId: c.parentId,
      sortOrder: c.sortOrder,
      keywords: c.keywords,
      attributes: c.attributes,
      listingCount: count.get(c.id) ?? 0,
      photo: photo.get(c.id)?.photo ?? null,
    }));
}

categoriesRouter.get("/", async (_req, res) => {
  res.json(await cached("categories", 30_000, loadCategories));
});

const pathLabel = (index: CategoryIndex, id: string) =>
  pathOf(index, id)
    .map((c) => c.name)
    .join(" > ");

// Every category an item can be listed in, for the AI's menu.
const choosable = (index: CategoryIndex) => index.rows.filter((c) => !c.hidden && c.parentId !== null).map((c) => ({ slug: c.slug, path: pathLabel(index, c.id) }));

// ---- auto category for Sell ------------------------------------------------------

// Categories of the most similar titles already on Alibe (and iBay items,
// where those exist), best first. Each match votes by how close it is.
async function categoriesOfSimilarTitles(index: CategoryIndex, title: string): Promise<string[]> {
  const q = title.toLowerCase().slice(0, 120);
  const [own, ibay] = await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.similarity_threshold = 0.3`),
    prisma.$queryRaw<{ categoryId: string; score: number }[]>`
      SELECT "categoryId", similarity(title, ${q}) AS score FROM "Listing"
      WHERE title % ${q} AND "hiddenAt" IS NULL
      ORDER BY score DESC LIMIT 25`,
    prisma.$queryRaw<{ slug: string; score: number }[]>`
      SELECT "alibeCategory" AS slug, similarity(title, ${q}) AS score FROM "IbayItem"
      WHERE title % ${q} AND "alibeCategory" IS NOT NULL AND "alibeCategory" <> 'excluded'
      ORDER BY score DESC LIMIT 25`,
  ]).then(([, a, b]) => [a, b] as const);
  const votes = new Map<string, number>();
  const vote = (slug: string | undefined, score: number) => {
    // Only categories that can take a listing (not the top level).
    const c = slug ? index.bySlug.get(slug) : undefined;
    if (c && c.parentId && !c.hidden) votes.set(c.slug, (votes.get(c.slug) ?? 0) + Number(score));
  };
  for (const r of own) vote(index.byId.get(r.categoryId)?.slug, r.score);
  for (const r of ibay) vote(r.slug, r.score);
  return [...votes.entries()].sort((a, b) => b[1] - a[1]).map(([slug]) => slug);
}

const suggestSchema = z.object({ title: z.string().trim().min(2).max(120), description: z.string().max(2000).optional().default("") });

// Up to three likely categories for what's being sold, best first, with the
// details the title gives away (brand, storage, year...). AI picks the first
// when it's set up; keyword matching always fills in the rest.
categoriesRouter.post("/suggest", async (req, res) => {
  const parsed = suggestSchema.safeParse(req.body);
  if (!parsed.success) return res.json({ suggestions: [], source: "none" });
  const { title, description } = parsed.data;
  const index = await categoryIndex();
  const scored = scoreCategories(index, title, description);
  const picks: string[] = [];
  let source: "ai" | "keywords" | "none" = scored.length ? "keywords" : "none";
  const aiSlug = await aiPickCategory(title, description, choosable(index));
  if (aiSlug && aiSlug !== "other") {
    picks.push(aiSlug);
    source = "ai";
  }
  for (const s of scored) if (picks.length < 3 && !picks.includes(s.category.slug)) picks.push(s.category.slug);
  // Nothing matched the words: learn from similar things already listed.
  if (picks.length === 0) {
    for (const slug of await categoriesOfSimilarTitles(index, title)) if (picks.length < 2 && !picks.includes(slug)) picks.push(slug);
    if (source === "none" && picks.length) source = "keywords";
  }

  const suggestions = await Promise.all(
    picks.map(async (slug, i) => {
      const c = index.bySlug.get(slug)!;
      const defs = effectiveAttributes(index, c.id);
      let attributes = guessAttributes(defs, title, description);
      // AI reads the details for the top pick only (one call).
      if (i === 0 && defs.length) {
        const ai = await aiExtractAttributes(title, description, defs);
        if (ai) attributes = { ...cleanAttributes(defs, ai), ...attributes };
      }
      return { slug, id: c.id, path: pathOf(index, c.id).map((p) => ({ slug: p.slug, name: p.name })), leaf: isLeaf(index, c.id), attributes };
    })
  );
  res.json({ suggestions, source });
});

// ---- understanding a search ------------------------------------------------------

const ATOLL_ALIASES: Record<string, string[]> = { KAA: ["male", "malé", "hulhumale", "hulhumalé", "villimale", "villingili"], ADD: ["addu", "hithadhoo", "gan", "feydhoo", "maradhoo"], GN: ["fuvahmulah", "fuvamulah"] };

type Understood = { q?: string; categorySlug?: string; atollId?: string; minPrice?: number; maxPrice?: number; condition?: "NEW" | "LIKE_NEW" | "GOOD" | "FAIR" };

const num = (s: string) => {
  const v = s.toLowerCase().replace(/,/g, "");
  return v.endsWith("k") ? parseFloat(v) * 1000 : parseFloat(v);
};

// Plain rules first (prices, places, "brand new"): free, instant, offline.
function understandLocally(q: string, index: CategoryIndex, atolls: Array<{ id: string; code: string; name: string; islands: { name: string }[] }>): Understood {
  let rest = ` ${q.toLowerCase()} `;
  const out: Understood = {};
  const money = String.raw`(?:mvr|rf|rs|mrf)?\s*(\d[\d,.]*k?)\s*(?:mvr|rf|rufiyaa)?`;
  const between = rest.match(new RegExp(String.raw`\bbetween\s+${money}\s+(?:and|to|-)\s+${money}`));
  if (between) {
    out.minPrice = num(between[1]);
    out.maxPrice = num(between[2]);
    rest = rest.replace(between[0], " ");
  }
  const under = rest.match(new RegExp(String.raw`\b(?:under|below|less than|max|upto|up to|cheaper than|<)\s*${money}`));
  if (under) {
    out.maxPrice = num(under[1]);
    rest = rest.replace(under[0], " ");
  }
  const over = rest.match(new RegExp(String.raw`\b(?:over|above|more than|min|from|>)\s*${money}`));
  if (over) {
    out.minPrice = num(over[1]);
    rest = rest.replace(over[0], " ");
  }
  if (/\b(brand new|new in box|sealed|bnib)\b/.test(rest)) {
    out.condition = "NEW";
    rest = rest.replace(/\b(brand new|new in box|sealed|bnib)\b/, " ");
  } else if (/\blike new\b/.test(rest)) {
    out.condition = "LIKE_NEW";
    rest = rest.replace(/\blike new\b/, " ");
  }
  for (const a of atolls) {
    const names = [a.name.toLowerCase(), ...a.islands.map((i) => i.name.toLowerCase()), ...(ATOLL_ALIASES[a.code] ?? [])];
    const hit = names.find((n) => n.length > 2 && new RegExp(`\\b(?:in |at |from )?${n.replace(/[^a-zà-ÿ ]/g, ".")}\\b`).test(rest));
    if (hit) {
      out.atollId = a.id;
      rest = rest.replace(new RegExp(`\\b(?:in |at |from )?${hit.replace(/[^a-zà-ÿ ]/g, ".")}\\b`), " ");
      break;
    }
  }
  // The most specific category the words name ("iphone" -> Mobile phones).
  const named = categoriesMatchingQuery(index, rest).sort((a, b) => pathOf(index, b.id).length - pathOf(index, a.id).length);
  if (named[0]) out.categorySlug = named[0].slug;
  rest = rest.replace(/\b(cheap|cheapest|for sale|wanted|selling|buy|in|at)\b/g, " ").replace(/\s+/g, " ").trim();
  if (rest) out.q = rest;
  return out;
}

const understandSchema = z.object({ q: z.string().trim().min(2).max(120) });

// Suggests filters for what someone typed: "iphone under 5000 in addu" ->
// Mobile phones, up to MVR 5,000, Addu. The app shows them as a one-tap
// suggestion; nothing is applied without the person choosing it.
categoriesRouter.get("/understand", async (req, res) => {
  const parsed = understandSchema.safeParse(req.query);
  if (!parsed.success) return res.json({ filters: null });
  const { q } = parsed.data;
  const [index, atolls] = await Promise.all([categoryIndex(), cached("atolls-with-islands", 600_000, () => prisma.atoll.findMany({ include: { islands: { select: { name: true } } } }))]);
  const local = understandLocally(q, index, atolls);
  let filters: Understood = local;
  let source: "ai" | "rules" = "rules";
  // AI only for longer, sentence-like searches: single words are already handled.
  if (aiEnabled() && q.split(/\s+/).length >= 3) {
    const ai = await aiUnderstandQuery(q, choosable(index), atolls.map((a) => a.name));
    if (ai) {
      const atoll = typeof ai.atoll === "string" ? atolls.find((a) => a.name.toLowerCase() === ai.atoll!.toLowerCase()) : undefined;
      const price = (v: unknown) => (typeof v === "number" && v > 0 && v < 100_000_000 ? Math.round(v) : undefined);
      const condition = ["NEW", "LIKE_NEW", "GOOD", "FAIR"].includes(String(ai.condition)) ? (ai.condition as Understood["condition"]) : undefined;
      filters = {
        q: typeof ai.keywords === "string" && ai.keywords.trim() ? ai.keywords.trim().slice(0, 80) : local.q,
        categorySlug: typeof ai.categorySlug === "string" && index.bySlug.has(ai.categorySlug) ? ai.categorySlug : local.categorySlug,
        atollId: atoll?.id ?? local.atollId,
        minPrice: price(ai.minPrice) ?? local.minPrice,
        maxPrice: price(ai.maxPrice) ?? local.maxPrice,
        condition: condition ?? local.condition,
      };
      source = "ai";
    }
  }
  // Only worth suggesting if it found more than the words themselves.
  const found = filters.categorySlug || filters.atollId || filters.minPrice !== undefined || filters.maxPrice !== undefined || filters.condition;
  const category = filters.categorySlug ? index.bySlug.get(filters.categorySlug) : undefined;
  res.json({
    filters: found ? filters : null,
    categoryPath: category ? pathOf(index, category.id).map((c) => c.name) : null,
    atollName: atolls.find((a) => a.id === filters.atollId)?.name ?? null,
    source,
  });
});
