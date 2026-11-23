import { prisma } from "./db.js";
import { scanMessage } from "./safety.js";
import { categoryIndex, topLevelOf } from "./categories.js";

// Which new posts wait for a Post approver. Most go live at once; a post is
// held only when something looks off, so the review queue stays small:
//   - the text reads like a scam (pay first, gift cards/crypto, links, bank
//     account numbers): the same patterns that warn people in chats
//   - the seller has open reports, or had a post turned down this month
//   - a brand-new account selling phones/electronics, vehicles or property,
//     or anything worth MVR 10,000+
//   - (after posting) its photos match another seller's: src/photoHash.ts
// Verified sellers and approved stores are never held.
const NEW_ACCOUNT_DAYS = 3;
const HIGH_VALUE = 10_000;
const RISKY_CATEGORIES = new Set(["electronics", "vehicles", "property"]);

const TEXT_REASONS: Record<string, string> = {
  PAY_FIRST: "Asks for payment up front",
  GIFT_CARD_CRYPTO: "Mentions gift cards or crypto",
  LINK: "Contains a link",
  BANK_DETAILS: "Contains a bank account number",
};

export async function postHoldReason(sellerId: string, post: { title: string; description: string; price: number; categoryId: string }): Promise<string | null> {
  const flag = scanMessage(`${post.title}\n${post.description}`, { hasOrder: false, unsentHandoverCode: null });
  if (flag && TEXT_REASONS[flag]) return TEXT_REASONS[flag];

  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const [user, openReports, recentRejects, index] = await Promise.all([
    prisma.user.findUnique({ where: { id: sellerId }, select: { createdAt: true } }),
    prisma.report.count({ where: { resolvedAt: null, OR: [{ reportedUserId: sellerId }, { listing: { sellerId } }] } }),
    prisma.listing.count({ where: { sellerId, status: "REJECTED", reviewedAt: { gte: monthAgo } } }),
    categoryIndex(),
  ]);
  if (openReports) return "The seller has open reports";
  if (recentRejects) return "A recent post from this seller was turned down";

  const newAccount = !!user && Date.now() - user.createdAt.getTime() < NEW_ACCOUNT_DAYS * 86_400_000;
  if (newAccount) {
    if (post.price >= HIGH_VALUE) return `New account, item over MVR ${HIGH_VALUE.toLocaleString()}`;
    const top = topLevelOf(index, post.categoryId)?.slug;
    if (top && RISKY_CATEGORIES.has(top)) return "New account selling in a category scammers target";
  }
  return null;
}
