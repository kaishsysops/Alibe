import { PLAN_GRACE_DAYS, PLAN_GRACE_MS } from "./sellers.js";
import { prisma } from "./db.js";
import { notifyUser } from "./push.js";
import { sendNoticeEmail } from "./messaging.js";

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

const DAY = 86_400_000;
const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Indian/Maldives" });

// Push and email, with a link to where they act on it.
async function remind(userId: string, title: string, body: string, path: string, data: Record<string, string>) {
  notifyUser(userId, title, body, data);
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }).catch(() => null);
  const site = process.env.PUBLIC_URL ?? "https://alibe.online";
  void sendNoticeEmail(u?.email, title, `${body.replace(/Tap here to /, "Open the link below to ")}\n\n${site}${path}`);
}

// Moves a purchase's reminder stage forward; false if another server got there first.
const claimStage = async (id: string, stage: number) => (await prisma.purchase.updateMany({ where: { id, reminderStage: { lt: stage } }, data: { reminderStage: stage } })).count > 0;

// Store and Premium plans: 3 days before the end date, on the day it ends
// (the 5-day grace period starts), the day before the grace period ends, and
// when it's switched off. Nothing if a newer period is already paid for.
async function sendPlanReminders() {
  const now = Date.now();
  const plans = await prisma.purchase.findMany({
    where: { kind: { in: ["STORE_PLAN", "PREMIUM_PLAN"] }, status: "ACTIVE", reminderStage: { lt: 4 }, endsAt: { gt: new Date(now - PLAN_GRACE_MS - 2 * DAY), lte: new Date(now + 3 * DAY) } },
    take: 300,
  });
  for (const p of plans) {
    const ends = p.endsAt!.getTime();
    const graceEnds = ends + PLAN_GRACE_MS;
    const stage = now < ends ? 1 : now < graceEnds - DAY ? 2 : now < graceEnds ? 3 : 4;
    if (stage <= p.reminderStage) continue;
    const renewed = await prisma.purchase.count({ where: { userId: p.userId, kind: p.kind, status: "ACTIVE", endsAt: { gt: p.endsAt! } } });
    if (renewed) {
      await prisma.purchase.updateMany({ where: { id: p.id }, data: { reminderStage: 4 } });
      continue;
    }
    if (!(await claimStage(p.id, stage))) continue;
    const plan = p.kind === "STORE_PLAN" ? "Store" : "Premium";
    const what = p.kind === "STORE_PLAN" ? "your store page and Store badge" : "free boosts, top placement and the Premium badge";
    const data = { type: "seller", focus: "plans" };
    if (stage === 1) remind(p.userId, `Your ${plan} plan ends soon`, `It ends on ${fmt(p.endsAt!)}. Tap here to renew and keep ${what}.`, "/seller-account?focus=plans", data);
    else if (stage === 2) remind(p.userId, `Your ${plan} plan has ended`, `You keep ${what} for ${PLAN_GRACE_DAYS} more days, until ${fmt(new Date(graceEnds))}. Tap here to renew.`, "/seller-account?focus=plans", data);
    else if (stage === 3) remind(p.userId, `Last day: renew your ${plan} plan`, `Tomorrow you lose ${what}. Tap here to renew now.`, "/seller-account?focus=plans", data);
    else remind(p.userId, `Your ${plan} plan is off`, `${what.charAt(0).toUpperCase()}${what.slice(1)} have stopped. Renew any time to switch them back on.`, "/seller-account?focus=plans", data);
  }
}

// Payments still waiting a day later, and again after 3 days.
async function sendPaymentReminders() {
  const now = Date.now();
  const unpaid = await prisma.purchase.findMany({ where: { status: "AWAITING_PAYMENT", reminderStage: { lt: 2 }, updatedAt: { lt: new Date(now - DAY) } }, take: 300 });
  for (const p of unpaid) {
    const stage = now - p.updatedAt.getTime() >= 3 * DAY ? 2 : 1;
    if (stage <= p.reminderStage || !(await claimStage(p.id, stage))) continue;
    const label = p.itemTitle ?? p.adTitle ?? "Your purchase";
    await remind(p.userId, stage === 1 ? "Waiting for your payment" : "Still waiting for your payment", `${label}: MVR ${p.amount.toLocaleString()}. Tap here to see how to pay. It starts as soon as we have it.`, "/purchases", { type: "purchase", purchaseId: p.id });
  }
}

export function startReminders() {
  const run = () => {
    sendDueReminders().catch((e) => console.error("[reminders]", e));
    sendPlanReminders().catch((e) => console.error("[plan reminders]", e));
    sendPaymentReminders().catch((e) => console.error("[payment reminders]", e));
  };
  run();
  return setInterval(run, 10 * 60 * 1000);
}
