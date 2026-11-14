import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../db.js";
import { safeRouter } from "../http.js";
import { cached, invalidate } from "../cache.js";
import { prohibitedReason } from "../moderation.js";
import { categoryIndex } from "../categories.js";

// "Popular right now" on Search: what people really searched for this week.
export const searchRouter = safeRouter();

const WINDOW_DAYS = 7;
const MIN_PEOPLE = 2;
const SHOW = 8;
const SALT = process.env.SLIP_LINK_SECRET || "alibe-search";

const normaliseTerm = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

// Called when someone submits a search or opens an item from its results,
// and only when the search found something.
searchRouter.post("/log", async (req, res) => {
  const parsed = z.object({ q: z.string().max(80) }).safeParse(req.body);
  const term = parsed.success ? normaliseTerm(parsed.data.q) : "";
  if (!req.userId || term.length < 2 || term.length > 40 || /^\d+$/.test(term) || prohibitedReason(term)) return res.json({ ok: true });
  const userKey = crypto.createHmac("sha256", SALT).update(req.userId).digest("hex").slice(0, 32);
  const day = new Date(new Date().toISOString().slice(0, 10));
  await prisma.searchEvent.upsert({ where: { term_userKey_day: { term, userKey, day } }, update: {}, create: { term, userKey, day } }).catch(() => {});
  res.json({ ok: true });
});

const titleCase = (t: string) => t.replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase()).replace(/\bIphone\b/g, "iPhone").replace(/\bIpad\b/g, "iPad").replace(/\bPs(\d)\b/g, "PS$1");

async function loadPopular(): Promise<{ terms: string[]; source: "searches" | "listings" }> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const rows = await prisma.$queryRaw<{ term: string; people: bigint }[]>`
    SELECT term, COUNT(DISTINCT "userKey") AS people FROM "SearchEvent"
    WHERE day >= ${since}
    GROUP BY term HAVING COUNT(DISTINCT "userKey") >= ${MIN_PEOPLE}
    ORDER BY people DESC, MAX("createdAt") DESC
    LIMIT ${SHOW}`;
  const terms = rows.map((r) => titleCase(r.term));
  if (terms.length >= 4) return { terms, source: "searches" };
  // Not enough searches yet: the categories with the most new listings lately.
  const index = await categoryIndex();
  const busiest = (since?: Date) =>
    prisma.listing.groupBy({
      by: ["categoryId"],
      where: { status: "ACTIVE", hiddenAt: null, createdAt: since ? { gte: since } : undefined },
      _count: { _all: true },
      orderBy: { _count: { categoryId: "desc" } },
      take: SHOW * 2,
    });
  // Newest listings first; on a quiet site, whatever has the most for sale.
  let fresh = await busiest(new Date(Date.now() - 14 * 86_400_000));
  if (fresh.length < 4) fresh = await busiest();
  const names = fresh
    .map((f) => index.byId.get(f.categoryId))
    .filter((c): c is NonNullable<typeof c> => !!c && !!c.parentId && !c.hidden)
    .map((c) => c.name);
  return { terms: [...new Set([...terms, ...names])].slice(0, SHOW), source: terms.length ? "searches" : "listings" };
}

searchRouter.get("/popular", async (_req, res) => {
  res.json(await cached("popular-searches", 10 * 60_000, loadPopular));
});

// Old rows are only needed for the window; keep the table small.
export async function pruneSearchEvents() {
  await prisma.searchEvent.deleteMany({ where: { day: { lt: new Date(Date.now() - 30 * 86_400_000) } } });
  invalidate("popular-searches");
}
