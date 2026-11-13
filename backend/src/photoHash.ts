import path from "node:path";
import sharp from "sharp";
import { prisma } from "./db.js";
import { UPLOAD_DIR } from "./routes/uploads.js";

// Duplicate and stolen photo detection. Each listing photo gets a 64-bit
// difference hash: shrink to 9x8 greyscale and record whether each pixel is
// brighter than its right-hand neighbour. Resizing, recompressing or light
// edits barely change it, so photos a few bits apart are the same picture.
// A match with another seller's listing goes to staff as a report.

const MAX_DISTANCE = 6;

async function dHash(file: string) {
  const px = await sharp(file).rotate().greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = 0n;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      bits = (bits << 1n) | (px[row * 9 + col] > px[row * 9 + col + 1] ? 1n : 0n);
    }
  }
  // Postgres BIGINT is signed.
  return BigInt.asIntN(64, bits);
}

// Staff reports from the photo check are filed by this system account.
async function checkerId() {
  const u = await prisma.user.upsert({
    where: { username: "alibe_photo_check" },
    update: {},
    create: { username: "alibe_photo_check", name: "Alibe photo check", isSystem: true, showPhone: false, promoOptIn: false },
  });
  return u.id;
}

export async function checkListingPhotos(listingId: string) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, sellerId: true, images: true } });
  if (!listing) return;
  const local = listing.images.filter((u) => /^\/uploads\/[\w.-]+$/.test(u));
  // Photos removed from the listing stop counting.
  await prisma.imageHash.deleteMany({ where: { listingId, imageUrl: { notIn: local } } });
  for (const imageUrl of local) {
    let hash: bigint;
    try {
      hash = await dHash(path.join(UPLOAD_DIR, path.basename(imageUrl)));
    } catch {
      continue; // HEIC, video thumbnails, missing files: nothing to compare
    }
    await prisma.imageHash.upsert({
      where: { listingId_imageUrl: { listingId, imageUrl } },
      update: { hash },
      create: { listingId, sellerId: listing.sellerId, imageUrl, hash },
    });
    const matches = await prisma.$queryRaw<{ listingId: string; title: string; sellerName: string; distance: number }[]>`
      SELECT h."listingId", l.title, u.name AS "sellerName", bit_count((h.hash # ${hash})::bit(64))::int AS distance
      FROM "ImageHash" h
      JOIN "Listing" l ON l.id = h."listingId"
      JOIN "User" u ON u.id = h."sellerId"
      WHERE h."sellerId" <> ${listing.sellerId}
        AND bit_count((h.hash # ${hash})::bit(64)) <= ${MAX_DISTANCE}
      ORDER BY distance, h."createdAt"
      LIMIT 1`;
    const match = matches[0];
    if (!match) continue;
    const reporterId = await checkerId();
    const details = `A photo on this listing matches one on "${match.title}" by ${match.sellerName} (listing ${match.listingId}). Possibly stolen photos.`;
    await prisma.report.upsert({
      where: { reporterId_listingId: { reporterId, listingId } },
      update: { details, resolvedAt: null },
      create: { reporterId, listingId, reportedUserId: null, reason: "SCAM", details },
    });
    return; // one report per listing is enough
  }
}

// Fire and forget after a listing is saved: never slows down or fails a post.
export function checkListingPhotosLater(listingId: string) {
  setTimeout(() => checkListingPhotos(listingId).catch((e) => console.error("[photo check]", e)), 500);
}
