import type { User } from "@prisma/client";
import { prisma } from "./db.js";

// The seller/buyer shape every public endpoint returns. Contact channels are
// only exposed when the user has switched them on in their profile.
export function publicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    avatarColor: u.avatarColor,
    createdAt: u.createdAt,
    verified: u.verificationStatus === "VERIFIED",
    phone: u.showPhone ? u.phone : null,
    whatsapp: u.whatsappEnabled ? u.whatsappNumber || u.phone : null,
    viber: u.viberEnabled ? u.viberNumber || u.phone : null,
  };
}

export type SellerRating = { average: number; count: number };

export async function ratingsFor(sellerIds: string[]): Promise<Map<string, SellerRating>> {
  const unique = [...new Set(sellerIds)];
  if (!unique.length) return new Map();
  const rows = await prisma.review.groupBy({
    by: ["sellerId"],
    where: { sellerId: { in: unique } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return new Map(rows.map((r) => [r.sellerId, { average: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count.rating }]));
}

export function serializeListing<T extends { seller: User }>(listing: T, ratings?: Map<string, SellerRating>) {
  return {
    ...listing,
    seller: { ...publicUser(listing.seller), rating: ratings?.get(listing.seller.id) ?? { average: 0, count: 0 } },
  };
}

// Serialises a batch of listings with one extra query for all seller ratings.
export async function serializeListings<T extends { seller: User }>(listings: T[]) {
  const ratings = await ratingsFor(listings.map((l) => l.seller.id));
  return listings.map((l) => serializeListing(l, ratings));
}

export function serializeConversation<T extends { seller: User; buyer: User }>(c: T) {
  return { ...c, seller: publicUser(c.seller), buyer: publicUser(c.buyer) };
}

export const listingInclude = {
  category: true,
  island: { include: { atoll: true } },
  seller: true,
} as const;
