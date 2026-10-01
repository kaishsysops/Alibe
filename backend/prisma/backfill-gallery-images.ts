import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// One-off: give existing single-image listings 2 extra gallery photos (same
// picsum seed family) so the product photo gallery has something to swipe
// through. Safe to re-run — skips listings that already have 2+ images.
async function main() {
  const listings = await prisma.listing.findMany({ where: {} });
  let updated = 0;
  for (const listing of listings) {
    if (listing.images.length >= 2) continue;
    const base = listing.images[0];
    const match = base.match(/seed\/([^/]+)\/(\d+)\/(\d+)/);
    if (!match) continue;
    const [, seed, w, h] = match;
    const extra = [`https://picsum.photos/seed/${seed}-b/${w}/${h}`, `https://picsum.photos/seed/${seed}-c/${w}/${h}`];
    await prisma.listing.update({
      where: { id: listing.id },
      data: { images: [...listing.images, ...extra] },
    });
    updated++;
  }
  console.log(`Backfilled gallery images for ${updated} listing(s).`);
}

main().finally(() => prisma.$disconnect());
