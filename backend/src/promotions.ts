import { z } from "zod";
import { prisma } from "./db.js";
import { cached, invalidate } from "./cache.js";

// What admins run across the site (Admin > Promotions):
//   banners       a message strip at the top of the app, for everyone, sellers or buyers
//   events        a campaign card on Home ("Eid sale") that opens a search
//   discounts     a percentage off boosts, ads and/or plans for a while
//   season        a seasonal look: a mark beside the logo and a greeting
//   staffNotices  messages from admins to everyone on the staff portal
// Everything has dates; only what's running now is sent to the app.
export const PROMOTIONS_KEY = "promotions";
const CACHE = "promotions:now";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates look like 2026-03-01.");
const id = z.string().min(1).max(40);
const dates = { id, startsOn: date, endsOn: date };

export const SEASONS = ["RAMADAN", "EID", "INDEPENDENCE", "NEW_YEAR"] as const;

export const promotionsSchema = z.object({
  banners: z
    .array(
      z.object({
        ...dates,
        message: z.string().trim().min(3).max(140),
        tone: z.enum(["INFO", "SUCCESS", "WARNING", "CELEBRATE"]).default("INFO"),
        audience: z.enum(["EVERYONE", "SELLERS", "BUYERS"]).default("EVERYONE"),
        linkLabel: z.string().trim().max(30).optional(),
        link: z.string().trim().max(300).optional(),
      })
    )
    .max(20)
    .default([]),
  events: z
    .array(
      z.object({
        ...dates,
        title: z.string().trim().min(3).max(60),
        subtitle: z.string().trim().max(140).optional(),
        image: z.string().regex(/^\/uploads\/[\w.-]+$/).optional(),
        // What "Shop now" searches for.
        searchText: z.string().trim().max(60).optional(),
        categorySlug: z.string().trim().max(60).optional(),
      })
    )
    .max(10)
    .default([]),
  discounts: z
    .array(
      z.object({
        ...dates,
        label: z.string().trim().min(2).max(40),
        percent: z.number().int().min(1).max(90),
        appliesTo: z.array(z.enum(["BOOST", "AD", "STORE_PLAN", "PREMIUM_PLAN"])).min(1),
      })
    )
    .max(10)
    .default([]),
  season: z.object({ theme: z.enum(SEASONS), greeting: z.string().trim().max(40).optional(), startsOn: date, endsOn: date }).nullable().default(null),
  staffNotices: z
    .array(z.object({ ...dates, message: z.string().trim().min(3).max(300), tone: z.enum(["INFO", "WARNING"]).default("INFO") }))
    .max(20)
    .default([]),
});
export type Promotions = z.infer<typeof promotionsSchema>;

const EMPTY: Promotions = { banners: [], events: [], discounts: [], season: null, staffNotices: [] };

export async function loadPromotions(): Promise<Promotions> {
  const row = await prisma.appSetting.findUnique({ where: { key: PROMOTIONS_KEY } });
  if (!row) return EMPTY;
  const parsed = promotionsSchema.safeParse(JSON.parse(row.value));
  return parsed.success ? parsed.data : EMPTY;
}

export async function savePromotions(p: Promotions) {
  const value = JSON.stringify(p);
  await prisma.appSetting.upsert({ where: { key: PROMOTIONS_KEY }, update: { value }, create: { key: PROMOTIONS_KEY, value } });
  invalidate(CACHE);
}

// Today in the Maldives (UTC+5), as YYYY-MM-DD: start and end days are inclusive.
export const todayMv = () => new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const running = <T extends { startsOn: string; endsOn: string }>(items: T[], today = todayMv()) => items.filter((i) => i.startsOn <= today && today <= i.endsOn);

// What's on right now (cached a minute; everyone asks for it).
export const promotionsNow = () =>
  cached(CACHE, 60_000, async () => {
    const p = await loadPromotions();
    const today = todayMv();
    return {
      banners: running(p.banners, today),
      events: running(p.events, today),
      discounts: running(p.discounts, today),
      season: p.season && p.season.startsOn <= today && today <= p.season.endsOn ? p.season : null,
      staffNotices: running(p.staffNotices, today),
    };
  });

// The biggest discount running for this kind of purchase (none: 0).
export async function discountFor(kind: "BOOST" | "AD" | "STORE_PLAN" | "PREMIUM_PLAN") {
  const now = await promotionsNow();
  const best = now.discounts.filter((d) => d.appliesTo.includes(kind)).sort((a, b) => b.percent - a.percent)[0];
  return best ? { percent: best.percent, label: best.label } : null;
}

export const applyDiscount = (amount: number, percent: number) => Math.max(0, Math.round(amount * (1 - percent / 100)));
