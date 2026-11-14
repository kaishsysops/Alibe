import { PrismaClient } from "@prisma/client";
import { IbayCategoryPage, conditionKeyFor, parseCategoryMenu } from "../src/ibayCategories.js";
import { categoryIndex } from "../src/categories.js";
import { refineIbayCategory } from "../src/categorySync.js";

// Copies iBay's public category pages into IbayItem, for admins only. Run with:
//   npx tsx prisma/import-ibay.ts [--categories=N]
//
// Only what the listing cards show is stored, with a link back to the original.
// Photos stay on iBay's servers (its robots.txt keeps crawlers out of its image
// folders); the admin's own browser loads them when the screen is open. Slow on
// purpose, and it stops at the first sign iBay would rather it didn't continue.
const prisma = new PrismaClient();
const BASE = "https://ibay.com.mv/";
const DELAY_MS = 2000;
const MAX_PAGES_PER_CATEGORY = 200;
const categoryLimit = Number(process.argv.find((a) => a.startsWith("--categories="))?.split("=")[1] ?? Infinity);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class StopCrawl extends Error {}

async function get(path: string) {
  await sleep(DELAY_MS);
  const res = await fetch(BASE + path, { headers: { "User-Agent": "AlibeImporter/1.0 (admin catalogue)" } });
  if (res.status === 403 || res.status === 429 || res.status >= 500) throw new StopCrawl(`iBay answered ${res.status} for ${path}`);
  return res.ok ? res.text() : "";
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();

function parseItems(html: string, page: IbayCategoryPage) {
  return html
    .split("latest-list-item")
    .slice(1)
    .flatMap((block) => {
      const link = block.match(/<h5><a href="([^"]*-o(\d+)\.html)[^"]*">([^<]*)<\/a>/);
      if (!link) return [];
      const price = block.match(/class="currency">\s*([A-Za-z]+)\s*<\/span>\s*([\d,]+)/);
      const condition = block.match(/Item Condition:(?:&nbsp;|\s)*([^<]+)</)?.[1].trim() ?? null;
      return [
        {
          id: link[2],
          title: decode(link[3]).slice(0, 300),
          url: BASE + link[1],
          imageUrl: block.match(/data-src="(https:\/\/[^"]+)"/)?.[1] ?? null,
          currency: price?.[1].toUpperCase() ?? null,
          price: price ? parseInt(price[2].replace(/,/g, ""), 10) : null,
          condition,
          conditionKey: conditionKeyFor(condition),
          category: page.label,
          alibeCategory: page.alibeCategory,
        },
      ];
    });
}

const startedAt = new Date();
const owner = await prisma.user.upsert({
  where: { username: "IBAY" },
  update: {},
  // No phone or email: there is nothing to sign in with, so nobody can become this account.
  create: { username: "IBAY", name: "IBAY", isSystem: true, showPhone: false, promoOptIn: false },
});

const home = await get("");
// Each iBay page goes to the most specific Alibe category its name fits.
const index = await categoryIndex();
const categories = parseCategoryMenu(home)
  .slice(0, categoryLimit)
  .map((page) => ({ ...page, alibeCategory: refineIbayCategory(index, page.alibeCategory, page.label) ?? page.alibeCategory }));
console.log(`${categories.length} categories to read`);

let saved = 0;
let complete = true;
try {
  for (const [i, category] of categories.entries()) {
    const { slug, label } = category;
    const seen = new Set<string>();
    for (let page = 0; page < MAX_PAGES_PER_CATEGORY; page++) {
      const items = parseItems(await get(`${slug}_${page}.html`), category);
      const fresh = items.filter((item) => !seen.has(item.id));
      if (!fresh.length) break;
      for (const { id, ...data } of fresh) {
        seen.add(id);
        await prisma.ibayItem.upsert({ where: { id }, update: { ...data, lastSeenAt: new Date() }, create: { id, ...data, ownerId: owner.id } });
        saved++;
      }
    }
    console.log(`[${i + 1}/${categories.length}] ${label}: ${seen.size} (${saved} so far)`);
  }
} catch (e) {
  if (!(e instanceof StopCrawl)) throw e;
  complete = false;
  console.log(`Stopped early: ${e.message}. Everything saved so far is kept.`);
}

// Only a full read can tell what has gone from iBay.
if (complete && categoryLimit === Infinity) {
  const { count } = await prisma.ibayItem.deleteMany({ where: { lastSeenAt: { lt: startedAt } } });
  console.log(`Removed ${count} items no longer on iBay`);
}
console.log(`Done: ${await prisma.ibayItem.count()} iBay items stored`);
await prisma.$disconnect();
