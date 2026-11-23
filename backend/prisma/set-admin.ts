import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/password.js";

// Creates an admin login for admin.alibe.online, or sets a new password for
// one (and unlocks it). Normally admins manage logins on the admin site; this
// is for the first admin, or if every admin is locked out. The password comes from the
// environment so it never lands in shell history, a file or the repo:
//   docker exec -e ADMIN_PASSWORD='...' alibe-backend npx tsx prisma/set-admin.ts <username>
const prisma = new PrismaClient();
const username = process.argv[2]?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!username || !password) {
  console.error("Usage: ADMIN_PASSWORD=... npx tsx prisma/set-admin.ts <username>");
  process.exit(1);
}
const name = username.charAt(0).toUpperCase() + username.slice(1);
const user = await prisma.user.upsert({ where: { username }, update: { isAdmin: true, bannedAt: null }, create: { username, name, isAdmin: true } });
const passwordHash = await hashPassword(password);
await prisma.adminCredential.upsert({
  where: { userId: user.id },
  update: { passwordHash, failures: 0, lockedUntil: null },
  create: { userId: user.id, passwordHash },
});
// A new password signs out their other staff sessions.
await prisma.session.deleteMany({ where: { userId: user.id, staff: true } });
console.log(`${username} can sign in at the admin site.`);
await prisma.$disconnect();
