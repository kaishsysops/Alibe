// Deterministic decorative stats (rating/sold count) derived from listing id.
// This is a demo app with seeded placeholder data — these are not real transactions.
function hash(id: string, seed: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * seed + id.charCodeAt(i)) >>> 0;
  return h;
}

export function pseudoRating(id: string): number {
  return Math.round((3.8 + (hash(id, 31) % 120) / 100) * 10) / 10;
}

export function pseudoSoldCount(id: string): number {
  return 5 + (hash(id, 17) % 495);
}

// Returns a discount percentage for most (not all) listings, purely as
// decorative demo styling — there's no real "original price" behind it.
export function pseudoDiscountPercent(id: string): number | null {
  const roll = hash(id, 13) % 100;
  if (roll < 35) return null;
  return 10 + (hash(id, 41) % 46); // 10-55%
}

export function originalPriceFor(price: number, discountPercent: number): number {
  return Math.round(price / (1 - discountPercent / 100));
}
