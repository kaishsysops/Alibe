import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { CATEGORY_TREE, EXTRA_KEYWORDS, TREE_VERSION, flattenTree } from "./categoryTree.js";
import { CategoryIndex, bestCategory, categoryIndex, clearCategoryCaches, descendants, effectiveAttributes, guessAttributes, isLeaf, topLevelOf } from "./categories.js";
import { NOT_FOR_SALE } from "./ibayCategories.js";

const VERSION_KEY = "categoryTreeVersion";

// Writes the starting tree (src/categoryTree.ts) into the database, once per
// TREE_VERSION. Between versions staff own the categories, so restarts never
// undo their edits. Existing categories keep their id (listings point at it).
export async function syncCategoryTree(log = console.log) {
  const row = await prisma.appSetting.findUnique({ where: { key: VERSION_KEY } });
  if (Number(row?.value ?? 0) >= TREE_VERSION) return false;

  const nodes = flattenTree(CATEGORY_TREE);
  const firstSetup = Number(row?.value ?? 0) < 1;
  const idBySlug = new Map<string, string>();
  // Parents come before their children in the flattened list.
  const existing = new Map((await prisma.category.findMany({ select: { slug: true, keywords: true } })).map((c) => [c.slug, c.keywords]));
  for (const n of nodes) {
    // Keywords only ever grow: the template's plus any staff added.
    const keywords = [...new Set([...(n.keywords ?? []), ...(EXTRA_KEYWORDS[n.slug] ?? []), ...(existing.get(n.slug) ?? [])].map((k) => k.toLowerCase().trim()).filter(Boolean))];
    const data = {
      name: n.name,
      icon: n.icon ?? null,
      sortOrder: n.sortOrder,
      keywords,
      attributes: n.attributes ? (n.attributes as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      parentId: n.parentSlug ? idBySlug.get(n.parentSlug)! : null,
      hidden: false,
    };
    // First setup writes the whole tree. After that staff own names, order and
    // placement: later versions only add new categories and new words.
    const c = await prisma.category.upsert({
      where: { slug: n.slug },
      update: firstSetup ? data : { keywords, attributes: data.attributes },
      create: { slug: n.slug, ...data },
    });
    idBySlug.set(n.slug, c.id);
  }
  await prisma.appSetting.upsert({ where: { key: VERSION_KEY }, update: { value: String(TREE_VERSION) }, create: { key: VERSION_KEY, value: String(TREE_VERSION) } });
  clearCategoryCaches();
  log(`Category tree v${TREE_VERSION}: ${nodes.length} categories`);

  const index = await categoryIndex();
  await placeListings(index, log);
  await placeIbayItems(index, log);
  return true;
}

// Listings sitting on a category that now has subcategories move to the most
// specific one their title matches. Nothing moves on a guess outside its branch.
async function placeListings(index: CategoryIndex, log: typeof console.log) {
  const broad = index.rows.filter((c) => !isLeaf(index, c.id)).map((c) => c.id);
  const rows = await prisma.listing.findMany({ where: { categoryId: { in: broad } }, select: { id: true, title: true, description: true, categoryId: true } });
  let moved = 0;
  for (const l of rows) {
    const current = index.byId.get(l.categoryId)!;
    const best = bestCategory(index, l.title, l.description, current.slug);
    if (best && best.id !== current.id) {
      await prisma.listing.update({ where: { id: l.id }, data: { categoryId: best.id } });
      moved++;
    }
  }
  if (rows.length) log(`Listings: ${moved} of ${rows.length} moved into subcategories`);

  // Listings made before categories had questions: fill in what their titles say.
  const blank = await prisma.listing.findMany({ where: { attributes: { equals: {} } }, select: { id: true, title: true, description: true, categoryId: true } });
  let filled = 0;
  for (const l of blank) {
    const attributes = guessAttributes(effectiveAttributes(index, l.categoryId), l.title, l.description);
    if (Object.keys(attributes).length) {
      await prisma.listing.update({ where: { id: l.id }, data: { attributes } });
      filled++;
    }
  }
  if (filled) log(`Listings: details filled in for ${filled}`);
}

// iBay items take the subcategory their iBay section name points to. Runs on
// whatever is in the table; on a server with no iBay items it does nothing.
async function placeIbayItems(index: CategoryIndex, log: typeof console.log) {
  const pairs = await prisma.ibayItem.groupBy({ by: ["alibeCategory", "category"], where: { alibeCategory: { not: NOT_FOR_SALE } } });
  let moved = 0;
  for (const p of pairs) {
    // Start again from the top of its branch, so a later tree version can
    // correct an earlier placement.
    const current = p.alibeCategory ? index.bySlug.get(p.alibeCategory) : undefined;
    const top = current ? topLevelOf(index, current.id).slug : p.alibeCategory;
    const target = refineIbayCategory(index, top, p.category);
    if (target && target !== p.alibeCategory) {
      const { count } = await prisma.ibayItem.updateMany({ where: { alibeCategory: p.alibeCategory, category: p.category }, data: { alibeCategory: target } });
      moved += count;
    }
  }
  if (moved) log(`iBay items: ${moved} placed in subcategories`);
}

// The most specific Alibe category for an iBay section name, within the broad
// category its iBay section maps to ("other" sections may land anywhere).
export function refineIbayCategory(index: CategoryIndex, broadSlug: string | null, label: string): string | null {
  if (!broadSlug || broadSlug === NOT_FOR_SALE) return broadSlug;
  const broad = index.bySlug.get(broadSlug);
  // "Other" has no subcategories, but its iBay sections (tools, pets, POS...)
  // belong elsewhere in the tree.
  if (broad && broadSlug !== "other" && isLeaf(index, broad.id)) return broadSlug;
  const within = broadSlug === "other" || !broad ? undefined : broadSlug;
  const best = bestCategory(index, label, "", within);
  if (!best) return broadSlug;
  // Never pull an item out of its branch into an unrelated one.
  if (within && !descendants(index, within).some((c) => c.id === best.id)) return broadSlug;
  return best.slug;
}
