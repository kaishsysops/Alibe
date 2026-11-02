import { PrismaClient } from "@prisma/client";

// Gives an existing account access to the report queue:
//   npm run make-admin -- you@example.com     (or +9607771234)
const prisma = new PrismaClient();
const contact = process.argv[2]?.trim().toLowerCase();
if (!contact) {
  console.error("Usage: npm run make-admin -- <email or phone>");
  process.exit(1);
}
const { count } = await prisma.user.updateMany({ where: { OR: [{ email: contact }, { phone: contact }] }, data: { isAdmin: true } });
console.log(count ? `${contact} can now review reports.` : `No account found for ${contact}. Sign in with it first.`);
await prisma.$disconnect();
process.exit(count ? 0 : 1);
