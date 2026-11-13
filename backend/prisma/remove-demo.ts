import { prisma } from "../src/db.js";
import { deleteAccount } from "../src/accounts.js";

// Removes the demo content prisma/seed.ts adds (SEED_DEMO): the demo sellers,
// their listings and the demo buyers, with their chats, orders and reviews.
// Only these seeded phone numbers are touched, plus empty sign-ups that never
// got past the code step (see below); real accounts never are.
// Categories, atolls and iBay items stay. Safe to run again: it does nothing
// once they're gone. deploy.sh runs it while SEED_DEMO=false.
//   npx tsx prisma/remove-demo.ts
const DEMO_PHONES = [
  "+9607777777", // Aishath Demo (sample listings)
  "+9607412345", // Hassan Rasheed (stock-photo catalogue)
  "+9607001001", "+9607001002", "+9607001003", "+9607001004", "+9607001005", // demo buyers and reviewers
];

const demo = await prisma.user.findMany({ where: { phone: { in: DEMO_PHONES } }, select: { id: true, name: true, _count: { select: { listings: true } } } });
if (!demo.length) {
  console.log("No demo data left.");
} else {
  for (const u of demo) {
    await deleteAccount(u.id);
    console.log(`Removed ${u.name}${u._count.listings ? ` and ${u._count.listings} listing(s)` : ""}`);
  }
}
// Abandoned sign-ups: accounts that got a code but never finished (still the
// placeholder name) after a day, with nothing in them. Staff never count.
const stale = await prisma.user.findMany({
  where: {
    name: "New Seller",
    isAdmin: false,
    isSystem: false,
    createdAt: { lt: new Date(Date.now() - 86_400_000) },
    listings: { none: {} },
    conversationsAsBuyer: { none: {} },
    conversationsAsSeller: { none: {} },
    ordersBought: { none: {} },
    ordersSold: { none: {} },
  },
  select: { id: true },
});
for (const u of stale) await deleteAccount(u.id);
if (stale.length) console.log(`Removed ${stale.length} unfinished sign-up(s)`);

await prisma.$disconnect();
