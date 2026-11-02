import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/password.js";
import { STAFF_CODE_KEY, STAFF_CODE_LENGTH } from "../src/staffEntry.js";

// Sets the secret number that opens staff sign-in from the phone field. It comes
// from the environment and only its hash is stored:
//   docker exec -e STAFF_CODE=... alibe-backend npx tsx prisma/set-staff-code.ts
const prisma = new PrismaClient();
const code = process.env.STAFF_CODE?.replace(/\D/g, "");
if (!code || code.length !== STAFF_CODE_LENGTH) {
  console.error(`STAFF_CODE must be exactly ${STAFF_CODE_LENGTH} digits.`);
  process.exit(1);
}
const value = await hashPassword(code);
await prisma.appSetting.upsert({ where: { key: STAFF_CODE_KEY }, update: { value }, create: { key: STAFF_CODE_KEY, value } });
console.log("Staff code saved.");
await prisma.$disconnect();
