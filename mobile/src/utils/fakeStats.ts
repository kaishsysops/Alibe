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
