import { prisma } from "./db.js";
import { notifyUser } from "./push.js";

// Keeps accepted orders moving: a seller who hasn't sent the item gets a
// nudge after a few hours and again the next day, and the buyer is told the
// seller has been reminded so they're never left wondering.
const STEPS = [
  { afterHours: 3, seller: (item: string, buyer: string) => [`${buyer} is waiting for ${item}`, "Open the order to send it or arrange a pickup."] },
  { afterHours: 24, seller: (item: string, buyer: string) => [`Please send ${item}`, `${buyer} has been waiting a day. Send it, or message them if there's a delay.`] },
] as const;

const HOUR = 3600 * 1000;

async function sendDueReminders() {
  for (const [index, step] of STEPS.entries()) {
    const due = await prisma.order.findMany({
      where: { status: "AWAITING_DISPATCH", remindersSent: index, createdAt: { lte: new Date(Date.now() - step.afterHours * HOUR) } },
      include: { listing: { select: { title: true } }, buyer: { select: { name: true } }, seller: { select: { name: true } } },
      take: 100,
    });
    for (const order of due) {
      // Claim this reminder first so two server instances never both send it.
      const claimed = await prisma.order.updateMany({ where: { id: order.id, remindersSent: index, status: "AWAITING_DISPATCH" }, data: { remindersSent: index + 1 } });
      if (!claimed.count) continue;
      const data = { type: "order", orderId: order.id, conversationId: order.conversationId };
      const [title, body] = step.seller(order.listing.title, order.buyer.name);
      notifyUser(order.sellerId, title, body, data);
      if (index === STEPS.length - 1) {
        notifyUser(order.buyerId, `We've reminded ${order.seller.name}`, `They haven't sent ${order.listing.title} yet. You can message them from the order.`, data);
      }
    }
  }
}

// Seller plans ending within 3 days get one "renew" reminder.
async function sendPlanReminders() {
  const soon = new Date(Date.now() + 3 * 86_400_000);
  const ending = await prisma.purchase.findMany({
    where: { kind: { in: ["STORE_PLAN", "PREMIUM_PLAN"] }, status: "ACTIVE", renewalReminded: false, endsAt: { gt: new Date(), lte: soon } },
    take: 200,
  });
  for (const p of ending) {
    // A newer paid period already queued up means there's nothing to remind.
    const next = await prisma.purchase.count({ where: { userId: p.userId, kind: p.kind, status: "ACTIVE", endsAt: { gt: p.endsAt! } } });
    const claimed = await prisma.purchase.updateMany({ where: { id: p.id, renewalReminded: false }, data: { renewalReminded: true } });
    if (!claimed.count || next) continue;
    const plan = p.kind === "STORE_PLAN" ? "Store" : "Premium";
    notifyUser(p.userId, `Your ${plan} plan ends soon`, `It ends on ${p.endsAt!.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Indian/Maldives" })}. Renew in Profile > Seller account to keep its benefits.`, { type: "seller" });
  }
}

export function startReminders() {
  const run = () => {
    sendDueReminders().catch((e) => console.error("[reminders]", e));
    sendPlanReminders().catch((e) => console.error("[plan reminders]", e));
  };
  run();
  return setInterval(run, 10 * 60 * 1000);
}
