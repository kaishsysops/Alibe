import type { PurchaseStatus } from "@prisma/client";
import { prisma } from "./db.js";
import { notifyUser } from "./push.js";
import { invalidate } from "./cache.js";
import { graceCutoff } from "./sellers.js";

const DAY_MS = 86_400_000;

// Starts a paid purchase: a boost, ad or plan goes live (timed from now, or
// from the end of a plan still running), a buy-for-you moves on to buying.
// Used when an admin approves a bank transfer and when a card payment is
// confirmed. Only moves a purchase that's still in one of `from`, so a double
// confirmation can't start it twice. Returns whether it moved.
export async function activatePurchase(purchaseId: string, from: PurchaseStatus[]) {
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) return false;
  const now = new Date();
  const timed = purchase.kind !== "BUY_FOR_YOU";
  let start = now;
  if (purchase.kind === "STORE_PLAN" || purchase.kind === "PREMIUM_PLAN") {
    // Renewed early, or during the grace period: carry on from the old end
    // date, so no days are lost or given twice.
    const current = await prisma.purchase.findFirst({ where: { userId: purchase.userId, kind: purchase.kind, status: "ACTIVE", endsAt: { gt: graceCutoff() } }, orderBy: { endsAt: "desc" } });
    if (current?.endsAt) start = current.endsAt;
  }
  const moved = await prisma.purchase.updateMany({
    where: { id: purchase.id, status: { in: from } },
    data: { status: "ACTIVE", ...(timed ? { startsAt: start, endsAt: new Date(start.getTime() + (purchase.days ?? 0) * DAY_MS) } : {}) },
  });
  if (!moved.count) return false;
  ["categories", "home:", "ibay:", "boosted", "premium-sellers"].forEach(invalidate);
  const label = purchase.itemTitle ?? purchase.adTitle ?? "your purchase";
  notifyUser(purchase.userId, "Payment confirmed", timed ? `${label} is live now.` : `We're getting ${label} for you.`, { type: "purchase", purchaseId: purchase.id });
  return true;
}
