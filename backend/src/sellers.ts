import { prisma } from "./db.js";
import { cached } from "./cache.js";
import { moneySettings } from "./money.js";

// Seller types and what each may do.
//
// Posting (everyone):
//   - The first 5 posts go live straight away.
//   - After that, posts from sellers who aren't approved wait for a Post
//     approver. Approved sellers' posts always go live at once.
//   - At most 30 new posts a month, unless the seller has Premium or a live
//     Store plan (then no limit).
//
//   Individual, unverified   default. No badge, no boosts.
//   Individual, verified     ID card (both sides) approved: posts skip review,
//                            Verified badge, can boost.
//   Store                    paid plan + approved store (business details +
//                            owner's ID): posts go live at once, store page,
//                            Store badge.
//   Premium                  paid add-on (on top of Store for stores): free
//                            boosts each month, top placement, Premium badge.
//
// "Approved" (posts skip review) = ID-verified, or an approved store (whose
// owner's ID was checked as part of the application).

// Posts anyone can make before review kicks in (for sellers who aren't approved).
export const FREE_POSTS = 5;
// New posts a month without Premium or a Store plan.
export const MONTHLY_POST_LIMIT = 30;
// What counts towards the limit: everything that's up or on its way up.
export const LIVE_STATUSES = ["ACTIVE", "PENDING", "RESERVED"] as const;

export type Badge = "PREMIUM" | "STORE" | "VERIFIED" | null;
export type StoreSummary = { name: string; slug: string; logoUrl: string | null };

type Plans = { store: Date | null; premium: Date | null };

// Paid plans running now, with when each ends.
export async function plansFor(userIds: string[]): Promise<Map<string, Plans>> {
  const ids = [...new Set(userIds)];
  const map = new Map<string, Plans>(ids.map((id) => [id, { store: null, premium: null }]));
  if (!ids.length) return map;
  const rows = await prisma.purchase.findMany({
    where: { userId: { in: ids }, kind: { in: ["STORE_PLAN", "PREMIUM_PLAN"] }, status: "ACTIVE", endsAt: { gt: new Date() } },
    select: { userId: true, kind: true, endsAt: true },
  });
  for (const r of rows) {
    const p = map.get(r.userId)!;
    const key = r.kind === "STORE_PLAN" ? "store" : "premium";
    if (!p[key] || r.endsAt! > p[key]!) p[key] = r.endsAt;
  }
  return map;
}

// The badge and store each seller shows buyers (one batch for a whole feed).
export async function sellerBadges(userIds: string[]): Promise<Map<string, { badge: Badge; store: StoreSummary | null }>> {
  const ids = [...new Set(userIds)];
  const out = new Map<string, { badge: Badge; store: StoreSummary | null }>();
  if (!ids.length) return out;
  const [users, plans] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, verificationStatus: true, store: { select: { name: true, slug: true, logoUrl: true, status: true } } } }),
    plansFor(ids),
  ]);
  for (const u of users) {
    const p = plans.get(u.id)!;
    const storeLive = u.store?.status === "APPROVED" && !!p.store;
    const approved = u.verificationStatus === "VERIFIED" || u.store?.status === "APPROVED";
    const badge: Badge = approved && p.premium ? "PREMIUM" : storeLive ? "STORE" : u.verificationStatus === "VERIFIED" ? "VERIFIED" : null;
    out.set(u.id, { badge, store: storeLive && u.store ? { name: u.store.name, slug: u.store.slug, logoUrl: u.store.logoUrl } : null });
  }
  return out;
}

// Sellers whose Premium plan is running (their new items get top placement).
export const premiumSellerIds = () =>
  cached("premium-sellers", 60_000, async () => {
    const rows = await prisma.purchase.findMany({
      where: { kind: "PREMIUM_PLAN", status: "ACTIVE", endsAt: { gt: new Date() } },
      select: { userId: true },
      distinct: ["userId"],
    });
    return rows.map((r) => r.userId);
  });

// Everything about one seller's standing, for posting rules and their Profile.
export async function standing(userId: string) {
  // Counted from the 1st of the month (Maldives is UTC+5; close enough to UTC here).
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [user, plans, liveCount, totalPosts, postedThisMonth, m] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { sellerKind: true, verificationStatus: true, store: true } }),
    plansFor([userId]),
    prisma.listing.count({ where: { sellerId: userId, status: { in: [...LIVE_STATUSES] }, hiddenAt: null } }),
    prisma.listing.count({ where: { sellerId: userId, status: { not: "DRAFT" } } }),
    prisma.listing.count({ where: { sellerId: userId, status: { not: "DRAFT" }, createdAt: { gte: monthStart } } }),
    moneySettings(),
  ]);
  if (!user) return null;
  const p = plans.get(userId)!;
  const verified = user.verificationStatus === "VERIFIED";
  const storeApproved = user.store?.status === "APPROVED";
  const approved = verified || storeApproved;
  const premium = approved && !!p.premium;
  const storeLive = storeApproved && !!p.store;
  const unlimited = premium || storeLive;
  // Free boosts: Premium's monthly allowance, counted from the 1st.
  const freeUsed = premium ? await prisma.purchase.count({ where: { userId, kind: "BOOST", amount: 0, createdAt: { gte: monthStart } } }) : 0;
  return {
    kind: user.sellerKind,
    verified,
    approved,
    store: user.store,
    storeLive,
    storeEndsAt: p.store,
    premium,
    premiumEndsAt: p.premium,
    liveCount,
    // The first FREE_POSTS go live without review; after that only approved
    // sellers skip it.
    freePostsLeft: approved ? null : Math.max(0, FREE_POSTS - totalPosts),
    nextPostReviewed: !approved && totalPosts >= FREE_POSTS,
    // New posts this month, against the cap (null = no cap).
    postedThisMonth,
    monthlyLimit: unlimited ? null : MONTHLY_POST_LIMIT,
    canBoost: approved,
    freeBoosts: { allowance: premium ? m.premiumFreeBoosts : 0, used: freeUsed, left: premium ? Math.max(0, m.premiumFreeBoosts - freeUsed) : 0 },
  };
}

export type Standing = NonNullable<Awaited<ReturnType<typeof standing>>>;

// Store page addresses: alibe.online/store/<slug>.
export async function uniqueStoreSlug(name: string, ownId?: string) {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "store";
  for (let i = 0; ; i++) {
    const slug = i ? `${base}-${i + 1}` : base;
    const taken = await prisma.store.findUnique({ where: { slug } });
    if (!taken || taken.id === ownId) return slug;
  }
}
