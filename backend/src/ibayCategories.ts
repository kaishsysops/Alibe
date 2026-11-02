// How iBay's catalogue lines up with Alibe's. An item takes its Alibe category
// from its top-level iBay section, so "Other" under Books and "Other" under
// Tools land in the right places.
export const NOT_FOR_SALE = "excluded";

const SECTION_TO_ALIBE: Record<string, string> = {
  "214": "sports-hobbies", // Antiques, Collectibles & Gifts
  "146": "baby-kids", // Baby, Pregnancy & Maternity
  "61": "books-office", // Books & Magazines
  "66": "fashion", // Clothing & Accessories
  "1": "electronics", // Computer, Tablets & Networking
  "36": "vehicles", // Dhoani, Boats & Fishing
  "2": "electronics", // Electronics
  "213": "furniture", // Furniture & Storage
  "111": "health-beauty", // Health & Beauty
  "69": "home-garden", // Home & Garden
  "198": "other", // Industrial & Business
  "3": "electronics", // Mobile Phones & Accessories
  "4": "vehicles", // Motorcycle, Cars & Vehicles
  "72": "other", // Pets and Pet Supplies
  "56": "sports-hobbies", // Sports, Fitness & Recreation
  "211": "books-office", // Stationery & Office Supplies
  "77": "sports-hobbies", // Toys & Hobbies
  "107": "electronics", // Video & Computer Gaming
  "5": "other", // Other Stuff
  "19": "property", // Housing & Real Estate
  "55": "jobs", // Jobs
  "28": "services", // Services
  "176": "other", // Business Opportunities
  "451": "other", // Free Stuff
  // People asking for things or posting notices: nothing here is for sale.
  "87": NOT_FOR_SALE, // Wanted
  "227": NOT_FOR_SALE, // Announcements & Events
};

export const alibeCategoryFor = (sectionId: string) => SECTION_TO_ALIBE[sectionId] ?? "other";

export function conditionKeyFor(label: string | null) {
  if (!label) return null;
  if (/like new/i.test(label)) return "LIKE_NEW" as const;
  if (/^new/i.test(label)) return "NEW" as const;
  if (/refurbished|usable|used/i.test(label)) return "GOOD" as const;
  if (/faulty/i.test(label)) return "FAIR" as const;
  return null;
}

export type IbayCategoryPage = { slug: string; label: string; alibeCategory: string };

// Walks the nested category menu on iBay's home page. A page to read is any
// entry with no sub-categories of its own.
export function parseCategoryMenu(html: string): IbayCategoryPage[] {
  const pages: IbayCategoryPage[] = [];
  const entries: Array<{ depth: number; slug: string; id: string; label: string }> = [];
  let depth = 0;
  for (const m of html.matchAll(/<ul\b[^>]*>|<\/ul>|<a\b[^>]*href="([a-z0-9-]+-b(\d+))(?:_0)?\.html"[^>]*>([^<]*)<\/a>/g)) {
    if (m[0].startsWith("<ul")) depth++;
    else if (m[0].startsWith("</ul")) depth--;
    else entries.push({ depth, slug: m[1], id: m[2], label: m[3].replace(/&amp;/g, "&").trim() });
  }
  let section = "";
  entries.forEach((entry, i) => {
    if (entry.depth === 1) section = entry.id;
    const hasChildren = (entries[i + 1]?.depth ?? 0) > entry.depth;
    if (!hasChildren && section) pages.push({ slug: entry.slug, label: entry.label, alibeCategory: alibeCategoryFor(section) });
  });
  return [...new Map(pages.map((p) => [p.slug, p])).values()];
}
