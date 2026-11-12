// Prints "legacy" when the database has tables but no Prisma migration history
// (it was created with `prisma db push`), otherwise "ok".
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const [row] = await prisma.$queryRaw`
  SELECT to_regclass('public."User"') IS NOT NULL AS "hasTables",
         to_regclass('public."_prisma_migrations"') IS NOT NULL AS "hasHistory"`;
await prisma.$disconnect();
process.stdout.write(row.hasTables && !row.hasHistory ? "legacy" : "ok");
