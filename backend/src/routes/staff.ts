import { z } from "zod";
import { prisma } from "../db.js";
import { safeRouter } from "../http.js";
import { accessOf, can, requireRole } from "../roles.js";
import { listingInclude, serializeListings } from "../serializers.js";
import { deleteIdPhotos, signedIdUrl } from "./slips.js";
import { notifyUser } from "../push.js";
import { sendNoticeEmail } from "../messaging.js";
import { invalidate } from "../cache.js";

// The portal's API (portal.alibe.online; the admin site uses it too). Every
// route checks the caller's role (src/roles.ts); admins pass everything.
export const staffRouter = safeRouter();

// Who's asking and what's waiting: the portal home and its sidebar counts.
// Only the queues this person can work on are counted.
staffRouter.get("/me", async (req, res) => {
  const a = await accessOf(req.userId);
  if (!a.admin && !a.roles.length) return res.status(403).json({ error: "Your account doesn't have staff access." });
  const count = async (roles: Parameters<typeof can>[1], q: () => Promise<number>) => (can(a, roles) ? q() : null);
  const [applications, posts, reports, disputes] = await Promise.all([
    count(["SELLER_APPROVER"], () => prisma.sellerApplication.count({ where: { status: "PENDING" } })),
    count(["POST_APPROVER"], () => prisma.listing.count({ where: { status: "PENDING", hiddenAt: null } })),
    count(["MODERATOR"], () => prisma.report.groupBy({ by: ["listingId", "reportedUserId"], where: { resolvedAt: null } }).then((g) => g.length)),
    count(["SUPPORT", "MODERATOR"], () => prisma.order.count({ where: { status: "DISPUTED" } })),
  ]);
  res.json({ admin: a.admin, roles: a.roles, counts: { applications, posts, reports, disputes } });
});

// Tells the seller the outcome: in the app, and by email.
async function tell(userId: string, title: string, body: string, data: Record<string, string>) {
  notifyUser(userId, title, body, data);
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  void sendNoticeEmail(u?.email, title, body);
}

// ---- seller applications (Seller approver) -----------------------------------

staffRouter.get("/applications", requireRole("SELLER_APPROVER"), async (req, res) => {
  const status = z.enum(["PENDING", "APPROVED", "REJECTED"]).catch("PENDING").parse(req.query.status);
  const apps = await prisma.sellerApplication.findMany({
    where: { status },
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    take: 100,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, avatarColor: true, avatarUrl: true, createdAt: true, verificationStatus: true, store: true } },
      decidedBy: { select: { name: true } },
    },
  });
  res.json(
    apps.map((a) => ({
      id: a.id,
      kind: a.kind,
      status: a.status,
      idNumberLast4: a.idNumberLast4,
      note: a.note,
      createdAt: a.createdAt,
      decidedAt: a.decidedAt,
      decidedBy: a.decidedBy?.name ?? null,
      user: { ...a.user, store: undefined },
      store: a.kind === "STORE" ? a.user.store : null,
      // Links that work for 10 minutes; the photos are deleted once decided.
      photos: { idFront: signedIdUrl(a.idFront), idBack: signedIdUrl(a.idBack), selfie: signedIdUrl(a.selfie) },
    }))
  );
});

const decideSchema = z.object({ approve: z.boolean(), reason: z.string().trim().max(300).optional() });

staffRouter.post("/applications/:id/decide", requireRole("SELLER_APPROVER"), async (req, res) => {
  const parsed = decideSchema.safeParse(req.body);
  if (!parsed.success || (!parsed.data.approve && (parsed.data.reason ?? "").length < 3)) {
    return res.status(400).json({ error: "Say why it's turned down (the applicant sees this)." });
  }
  const { approve, reason } = parsed.data;
  const app = await prisma.sellerApplication.findUnique({ where: { id: req.params.id } });
  if (!app) return res.status(404).json({ error: "That application doesn't exist." });
  if (app.status !== "PENDING") return res.status(409).json({ error: "Someone already decided this one." });
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // Claim it first, so two approvers can't both decide it.
    const claimed = await tx.sellerApplication.updateMany({
      where: { id: app.id, status: "PENDING" },
      data: { status: approve ? "APPROVED" : "REJECTED", note: approve ? null : reason, decidedById: req.userId!, decidedAt: now, idFront: null, idBack: null, selfie: null },
    });
    if (!claimed.count) throw Object.assign(new Error("taken"), { taken: true });
    if (approve) {
      // An approved store's owner had their ID checked too.
      await tx.user.update({ where: { id: app.userId }, data: { verificationStatus: "VERIFIED", verifiedAt: now } });
      if (app.kind === "STORE") await tx.store.update({ where: { userId: app.userId }, data: { status: "APPROVED", approvedAt: now, rejectReason: null } });
      // Posts waiting from this seller go live: they're approved now.
      await tx.listing.updateMany({ where: { sellerId: app.userId, status: "PENDING" }, data: { status: "ACTIVE", reviewedAt: now } });
    } else if (app.kind === "STORE") {
      await tx.store.update({ where: { userId: app.userId }, data: { status: "REJECTED", rejectReason: reason } });
    }
  }).catch((e) => {
    if (e?.taken) return res.status(409).json({ error: "Someone already decided this one." });
    throw e;
  });
  if (res.headersSent) return;
  // Privacy: the ID and selfie photos are gone once it's decided.
  await deleteIdPhotos([app.idFront, app.idBack, app.selfie]);
  invalidate("home:");
  const what = app.kind === "STORE" ? "store" : "ID check";
  if (approve) {
    await tell(
      app.userId,
      app.kind === "STORE" ? "Your store is approved" : "You're verified",
      app.kind === "STORE" ? "Your store is approved. Choose a Store plan in Profile > Seller account to open your store page." : "Your posts now go live straight away, with the Verified badge.",
      { type: "seller" }
    );
  } else {
    await tell(app.userId, `Your ${what} wasn't approved`, `${reason} You can apply again from Profile > Seller account.`, { type: "seller" });
  }
  res.status(204).send();
});

// ---- posts waiting for review (Post approver) ----------------------------------

staffRouter.get("/posts", requireRole("POST_APPROVER"), async (_req, res) => {
  const listings = await prisma.listing.findMany({ where: { status: "PENDING", hiddenAt: null }, include: listingInclude, orderBy: { updatedAt: "asc" }, take: 60 });
  const counts = await prisma.listing.groupBy({
    by: ["sellerId"],
    where: { sellerId: { in: listings.map((l) => l.sellerId) }, status: { in: ["ACTIVE", "SOLD"] } },
    _count: { _all: true },
  });
  const byId = new Map(counts.map((c) => [c.sellerId, c._count._all]));
  const items = await serializeListings(listings);
  res.json(items.map((l) => ({ ...l, sellerPublishedCount: byId.get(l.sellerId) ?? 0, sellerEmail: listings.find((x) => x.id === l.id)?.seller.email ?? null })));
});

staffRouter.post("/posts/:id/decide", requireRole("POST_APPROVER"), async (req, res) => {
  const parsed = decideSchema.safeParse(req.body);
  if (!parsed.success || (!parsed.data.approve && (parsed.data.reason ?? "").length < 3)) {
    return res.status(400).json({ error: "Say why it's turned down (the seller sees this)." });
  }
  const { approve, reason } = parsed.data;
  const listing = await prisma.listing.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, sellerId: true } });
  if (!listing) return res.status(404).json({ error: "That post no longer exists." });
  const changed = await prisma.listing.updateMany({
    where: { id: listing.id, status: "PENDING" },
    data: approve ? { status: "ACTIVE", reviewedAt: new Date(), rejectReason: null, createdAt: new Date() } : { status: "REJECTED", reviewedAt: new Date(), rejectReason: reason },
  });
  if (!changed.count) return res.status(409).json({ error: "Someone already decided this one." });
  invalidate("home:");
  invalidate("categories");
  if (approve) await tell(listing.sellerId, "Your post is live", `"${listing.title}" is on Alibe now.`, { type: "listing", listingId: listing.id });
  else await tell(listing.sellerId, "Your post wasn't approved", `"${listing.title}": ${reason} Edit it in My listings to send it again.`, { type: "listing", listingId: listing.id });
  res.status(204).send();
});
