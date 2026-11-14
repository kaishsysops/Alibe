import { prisma } from "./db.js";
import { cached, invalidate } from "./cache.js";
import type { AttributeDef } from "./categoryTree.js";

// The category tree as the server uses it: loaded once, shared for a minute,
// cleared when staff edit categories.

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  keywords: string[];
  attributes: AttributeDef[] | null;
  hidden: boolean;
};

export type CategoryIndex = {
  rows: CategoryRow[];
  byId: Map<string, CategoryRow>;
  bySlug: Map<string, CategoryRow>;
  children: Map<string | null, CategoryRow[]>;
};

export const CATEGORY_CACHE = "category-index";

export function clearCategoryCaches() {
  [CATEGORY_CACHE, "categories", "home:", "ibay:"].forEach(invalidate);
}

export const categoryIndex = () =>
  cached(CATEGORY_CACHE, 60_000, async (): Promise<CategoryIndex> => {
    const rows = (await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })).map((c) => ({
      ...c,
      attributes: Array.isArray(c.attributes) ? (c.attributes as unknown as AttributeDef[]) : null,
    }));
    const children = new Map<string | null, CategoryRow[]>();
    for (const r of rows) children.set(r.parentId, [...(children.get(r.parentId) ?? []), r]);
    return { rows, byId: new Map(rows.map((r) => [r.id, r])), bySlug: new Map(rows.map((r) => [r.slug, r])), children };
  });

// The category and everything under it, at any depth.
export function descendants(index: CategoryIndex, slug: string): CategoryRow[] {
  const start = index.bySlug.get(slug);
  if (!start) return [];
  const out: CategoryRow[] = [];
  const walk = (c: CategoryRow) => {
    out.push(c);
    for (const child of index.children.get(c.id) ?? []) walk(child);
  };
  walk(start);
  return out;
}

// Root first: Electronics > Computers & laptops > Laptops.
export function pathOf(index: CategoryIndex, id: string): CategoryRow[] {
  const out: CategoryRow[] = [];
  let c = index.byId.get(id);
  while (c) {
    out.unshift(c);
    c = c.parentId ? index.byId.get(c.parentId) : undefined;
  }
  return out;
}

export const topLevelOf = (index: CategoryIndex, id: string) => pathOf(index, id)[0];

// A category's questions: its ancestors' plus its own (a closer one wins on the same key).
export function effectiveAttributes(index: CategoryIndex, id: string): AttributeDef[] {
  const byKey = new Map<string, AttributeDef>();
  for (const c of pathOf(index, id)) for (const a of c.attributes ?? []) byKey.set(a.key, a);
  return [...byKey.values()];
}

export const isLeaf = (index: CategoryIndex, id: string) => !(index.children.get(id) ?? []).some((c) => !c.hidden);

// Keeps only answers the category asks about, in the right shape.
export function cleanAttributes(defs: AttributeDef[], raw: unknown): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const def of defs) {
    const v = (raw as Record<string, unknown>)[def.key];
    if (v === undefined || v === null || v === "") continue;
    if (def.type === "number") {
      const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.]/g, ""));
      if (Number.isFinite(n) && n >= 0 && n < 10_000_000) out[def.key] = Math.round(n);
    } else if (typeof v === "string" && def.options?.includes(v)) {
      out[def.key] = v;
    }
  }
  return out;
}

// ---- matching text to categories (no AI needed) ---------------------------------

const normalise = (s: string) =>
  ` ${s
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim()} `;

// Does the phrase appear as whole words? Plurals ("phones") count.
function hasPhrase(text: string, phrase: string) {
  const p = normalise(phrase).trim();
  if (!p) return false;
  return text.includes(` ${p} `) || text.includes(` ${p}s `) || text.includes(` ${p}es `);
}

const STOP = new Set(["and", "for", "the", "with", "other", "others", "accessories", "parts", "stuff", "general", "new", "used", "sale"]);

function termsOf(c: CategoryRow) {
  const nameWords = normalise(c.name)
    .trim()
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w));
  return { phrases: [c.name, ...c.keywords], words: nameWords };
}

export type Scored = { category: CategoryRow; score: number };

// Scores every category against a title (and description). Words in the title
// count three times more. A category also earns a share of its parent's score,
// so "iPhone 13 case" lands in Phone accessories > Cases, not Mobile phones.
export function scoreCategories(index: CategoryIndex, title: string, description = "", within?: string): Scored[] {
  const t = normalise(title);
  const d = normalise(description.slice(0, 600));
  const lead = ` ${t.trim().split(" ").slice(0, 3).join(" ")} `;
  const pool = within ? descendants(index, within) : index.rows;
  const own = new Map<string, number>();
  for (const c of pool) {
    if (c.hidden) continue;
    const { phrases, words } = termsOf(c);
    let s = 0;
    for (const p of phrases) {
      // Longer phrases are more specific: "screen protector" beats "screen".
      const weight = 1 + normalise(p).trim().split(" ").length * 0.6;
      // What a title starts with is what it is: "iPad Pro with Apple Pencil".
      if (hasPhrase(lead, p)) s += 4.5 * weight;
      else if (hasPhrase(t, p)) s += 3 * weight;
      else if (d.length > 2 && hasPhrase(d, p)) s += weight;
    }
    for (const w of words) if (hasPhrase(t, w)) s += 1;
    own.set(c.id, s);
  }
  const total = (c: CategoryRow): number => {
    const parent = c.parentId ? index.byId.get(c.parentId) : undefined;
    return (own.get(c.id) ?? 0) + (parent && own.has(parent.id) ? total(parent) * 0.35 : 0);
  };
  return pool
    .filter((c) => !c.hidden && (own.get(c.id) ?? 0) > 0)
    .map((c) => ({ category: c, score: total(c) + (isLeaf(index, c.id) ? 0.2 : 0) }))
    .sort((a, b) => b.score - a.score);
}

// The most specific category a title clearly belongs to, or null.
export function bestCategory(index: CategoryIndex, title: string, description = "", within?: string): CategoryRow | null {
  return scoreCategories(index, title, description, within)[0]?.category ?? null;
}

// Fills in the answers a title gives away: "iPhone 13 256GB" -> Apple, 256 GB.
export function guessAttributes(defs: AttributeDef[], title: string, description = ""): Record<string, string | number> {
  const text = normalise(`${title} ${description.slice(0, 400)}`);
  const raw = `${title} ${description.slice(0, 400)}`;
  const out: Record<string, string | number> = {};
  for (const def of defs) {
    if (def.type === "select" && def.options) {
      if (def.key === "bedrooms") {
        if (/\bstudio\b/i.test(raw)) out.bedrooms = "Studio";
        const n = raw.match(/\b(\d)\s?(?:br|bhk|bed(?:room)?s?)\b/i)?.[1];
        if (n) out.bedrooms = Number(n) >= 5 ? "5+" : n;
        continue;
      }
      if (def.key === "storage" || def.key === "ram") {
        const sizes = [...raw.matchAll(/(\d+)\s?(gb|tb)\b/gi)].map((m) => `${m[1]} ${m[2].toUpperCase()}`);
        // RAM is the smaller number when both appear ("8GB/256GB").
        const pick = def.key === "ram" && sizes.length > 1 ? sizes[0] : sizes[sizes.length - 1];
        if (pick && def.options.includes(pick)) out[def.key] = pick;
        continue;
      }
      // Bare numbers ("2") mean nothing on their own: only their own rules read them.
      const hit = def.options.find((o) => o !== "Other" && !/^\d+\+?$/.test(o) && (hasPhrase(text, o) || (def.aliases?.[o] ?? []).some((a) => hasPhrase(text, a))));
      if (hit) out[def.key] = hit;
    } else if (def.type === "number") {
      if (def.key === "year") {
        const y = raw.match(/\b(19[89]\d|20[0-3]\d)\b/);
        if (y) out.year = Number(y[1]);
      } else if (def.unit) {
        const unit = def.unit.replace(/\s/g, "\\s?");
        const m = raw.match(new RegExp(`(\\d[\\d,.]*)\\s?(${unit}|${def.unit === "inch" ? '"|in\\b|inches' : def.unit})`, "i"));
        if (m) out[def.key] = Math.round(Number(m[1].replace(/,/g, "")));
      }
    }
  }
  return out;
}

// Categories whose name or keywords match a search, for "Phones" style shortcuts
// and so searching "mobile" also finds items in Mobile phones.
export function categoriesMatchingQuery(index: CategoryIndex, q: string): CategoryRow[] {
  const text = normalise(q);
  if (text.trim().length < 3) return [];
  return index.rows.filter((c) => !c.hidden && [c.name, ...c.keywords].some((p) => normalise(p).trim().length > 2 && (hasPhrase(text, p) || normalise(p).trim() === text.trim())));
}
