// Migration folders were renamed from 0_init..9_post_hold_reason to
// 00_init..09_post_hold_reason, because Prisma runs them in alphabetical order
// and "10_card_payments" was sorting before "2_...". The database remembers
// applied migrations by folder name, so rename those records to match; without
// this, Prisma would treat the renamed folders as new and run them again.
// Safe to run any number of times: it only touches old-style names.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const [{ hasHistory }] = await prisma.$queryRaw`
  SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS "hasHistory"`;
if (hasHistory) {
  const renamed = await prisma.$executeRaw`
    UPDATE "_prisma_migrations"
       SET migration_name = '0' || migration_name
     WHERE migration_name ~ '^[0-9]_'`;
  if (renamed > 0) console.log(`Renamed ${renamed} migration record(s) to the zero-padded names.`);
}
await prisma.$disconnect();
