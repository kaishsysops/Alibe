import { AttributeDef, Category } from "../api/client";

// The category tree from the flat list the server sends (parentId + sortOrder).
// Depth is unlimited; siblings always keep staff's order.
export type CategoryTree = {
  all: Category[];
  bySlug: Map<string, Category>;
  byId: Map<string, Category>;
  roots: Category[];
  childrenOf: (slug?: string | null) => Category[];
  pathOf: (slug?: string | null) => Category[];
  // Everything under a category, at any depth, including itself.
  descendantSlugs: (slug: string) => Set<string>;
  attributesOf: (slug?: string | null) => AttributeDef[];
  topOf: (slug?: string | null) => Category | undefined;
};

const order = (a: Category, b: Category) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);

export function buildCategoryTree(categories: Category[]): CategoryTree {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const kids = new Map<string | null, Category[]>();
  for (const c of categories) {
    const key = c.parentId && byId.has(c.parentId) ? c.parentId : null;
    kids.set(key, [...(kids.get(key) ?? []), c]);
  }
  for (const list of kids.values()) list.sort(order);

  const childrenOf = (slug?: string | null) => (slug ? kids.get(bySlug.get(slug)?.id ?? "") ?? [] : kids.get(null) ?? []);
  const pathOf = (slug?: string | null) => {
    const out: Category[] = [];
    let c = slug ? bySlug.get(slug) : undefined;
    while (c) {
      out.unshift(c);
      c = c.parentId ? byId.get(c.parentId) : undefined;
    }
    return out;
  };
  const descendantSlugs = (slug: string) => {
    const out = new Set<string>();
    const walk = (s: string) => {
      out.add(s);
      for (const k of childrenOf(s)) walk(k.slug);
    };
    if (bySlug.has(slug)) walk(slug);
    return out;
  };
  const attributesOf = (slug?: string | null) => {
    const byKey = new Map<string, AttributeDef>();
    for (const c of pathOf(slug)) for (const a of c.attributes ?? []) byKey.set(a.key, a);
    return [...byKey.values()];
  };
  return { all: categories, bySlug, byId, roots: kids.get(null) ?? [], childrenOf, pathOf, descendantSlugs, attributesOf, topOf: (slug) => pathOf(slug)[0] };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Categories that match what's being typed: "pho" -> Mobile phones, Phone
// accessories... Names first, then search words; the most specific win ties.
export function matchCategories(tree: CategoryTree, text: string, limit = 4): Category[] {
  const q = norm(text);
  if (q.length < 2) return [];
  const scored: Array<{ c: Category; score: number }> = [];
  for (const c of tree.all) {
    const name = norm(c.name);
    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 60;
    else if (name.split(" ").some((w) => w.startsWith(q))) score = 45;
    else if ((c.keywords ?? []).some((k) => norm(k) === q)) score = 40;
    else if (q.length >= 3 && (c.keywords ?? []).some((k) => norm(k).startsWith(q) || q.split(" ").includes(norm(k)))) score = 25;
    if (score) scored.push({ c, score: score + tree.pathOf(c.slug).length * 2 + Math.min(5, Math.log10((c.listingCount ?? 0) + 1)) });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.c);
}

export const pathLabel = (tree: CategoryTree, slug?: string | null, sep = " › ") =>
  tree
    .pathOf(slug)
    .map((c) => c.name)
    .join(sep);
