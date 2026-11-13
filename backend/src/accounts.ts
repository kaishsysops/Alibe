import { prisma } from "./db.js";

// Deletes an account and everything tied to it: their listings, chats about
// those listings, orders, offers, reviews, reports, blocks, saved searches and
// favourites. (Sessions, purchases, dispute evidence and photo fingerprints
// go with it through ON DELETE CASCADE.) Used by "Delete my account" and by
// prisma/remove-demo.ts.
export async function deleteAccount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  const listingIds = (await prisma.listing.findMany({ where: { sellerId: userId }, select: { id: true } })).map((l) => l.id);
  const conversationIds = (
    await prisma.conversation.findMany({ where: { OR: [{ buyerId: userId }, { sellerId: userId }, { listingId: { in: listingIds } }] }, select: { id: true } })
  ).map((c) => c.id);

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { OR: [{ conversationId: { in: conversationIds } }, { senderId: userId }] } }),
    prisma.order.deleteMany({ where: { OR: [{ conversationId: { in: conversationIds } }, { buyerId: userId }, { sellerId: userId }, { listingId: { in: listingIds } }] } }),
    prisma.offer.deleteMany({ where: { OR: [{ conversationId: { in: conversationIds } }, { fromId: userId }, { listingId: { in: listingIds } }] } }),
    prisma.review.deleteMany({ where: { OR: [{ reviewerId: userId }, { sellerId: userId }, { listingId: { in: listingIds } }] } }),
    prisma.report.deleteMany({ where: { OR: [{ reporterId: userId }, { reportedUserId: userId }, { listingId: { in: listingIds } }] } }),
    prisma.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } }),
    prisma.savedSearch.deleteMany({ where: { userId } }),
    prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } }),
    prisma.favorite.deleteMany({ where: { OR: [{ userId }, { listingId: { in: listingIds } }] } }),
    prisma.listing.deleteMany({ where: { sellerId: userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
  return true;
}
