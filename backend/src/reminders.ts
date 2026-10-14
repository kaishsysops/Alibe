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

export function startReminders() {
  const run = () => sendDueReminders().catch((e) => console.error("[reminders]", e));
  run();
  return setInterval(run, 10 * 60 * 1000);
}
