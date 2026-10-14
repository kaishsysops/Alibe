import { prisma } from "./db.js";
import { ratingsFor } from "./serializers.js";

// One simple trust level per person, built only from things that actually
// happened on Alibe, so a non-technical buyer can judge a stranger at a glance.
export type TrustLevel = "CAUTION" | "NEW" | "MEMBER" | "ESTABLISHED" | "TRUSTED";

export type TrustSummary = {
  level: TrustLevel;
  delivered: number;
  rating: { average: number; count: number };
  memberDays: number;
  // Typical time to reply to a buyer's first message, in minutes (null until
  // there's enough history).
  replyMinutes: number | null;
  // Different people who reported this account in the last 90 days.
  reporters: number;
  cancelledByThem: number;
};

const DAY = 86_400_000;

async function typicalReplyMinutes(userId: string) {
  // Their last 20 chats as a seller where the buyer spoke first.
  const conversations = await prisma.conversation.findMany({
    where: { sellerId: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { buyerId: true, messages: { orderBy: { createdAt: "asc" }, take: 15, select: { senderId: true, createdAt: true } } },
  });
  const delays: number[] = [];
  for (const c of conversations) {
    const first = c.messages[0];
    if (!first || first.senderId !== c.buyerId) continue;
    const reply = c.messages.find((m) => m.senderId === userId);
    if (reply) delays.push((reply.createdAt.getTime() - first.createdAt.getTime()) / 60_000);
  }
  if (delays.length < 3) return null;
  delays.sort((a, b) => a - b);
  return Math.round(delays[Math.floor(delays.length / 2)]);
}

export async function trustFor(userId: string): Promise<TrustSummary | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!user) return null;
  const since = new Date(Date.now() - 90 * DAY);
  const [delivered, ratings, reportRows, cancelledByThem, replyMinutes] = await Promise.all([
    prisma.order.count({ where: { sellerId: userId, status: "DELIVERED" } }),
    ratingsFor([userId]),
    prisma.report.findMany({ where: { reportedUserId: userId, createdAt: { gte: since } }, select: { reporterId: true }, distinct: ["reporterId"] }),
    prisma.order.count({ where: { sellerId: userId, status: "CANCELLED" } }),
    typicalReplyMinutes(userId),
  ]);
  const rating = ratings.get(userId) ?? { average: 0, count: 0 };
  const memberDays = Math.floor((Date.now() - user.createdAt.getTime()) / DAY);
  const reporters = reportRows.length;

  let level: TrustLevel = "MEMBER";
  if (reporters >= 3 || (rating.count >= 3 && rating.average < 2.5)) level = "CAUTION";
  else if (delivered >= 5 && (rating.count === 0 || rating.average >= 4)) level = "TRUSTED";
  else if (delivered >= 1) level = "ESTABLISHED";
  else if (memberDays < 7) level = "NEW";

  return { level, delivered, rating, memberDays, replyMinutes, reporters, cancelledByThem };
}
