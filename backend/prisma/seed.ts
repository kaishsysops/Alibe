import { PrismaClient } from "@prisma/client";
import { syncCategoryTree } from "../src/categorySync.js";

const prisma = new PrismaClient();


// Every administrative atoll, north to south, with its main inhabited islands.
// The first five keep the codes they were created with (the first three letters
// of the name); the rest use the official short codes. The app's map
// (mobile/src/data/maldives.ts) finds each atoll by this code.
const ATOLLS: Array<{ code: string; name: string; islands: string[] }> = [
  { code: "HA", name: "Haa Alifu", islands: ["Dhidhdhoo", "Hoarafushi", "Ihavandhoo", "Kelaa", "Baarah"] },
  { code: "HDH", name: "Haa Dhaalu", islands: ["Kulhudhuffushi", "Hanimaadhoo", "Nolhivaranfaru", "Makunudhoo"] },
  { code: "SH", name: "Shaviyani", islands: ["Funadhoo", "Milandhoo", "Komandoo", "Kanditheem"] },
  { code: "N", name: "Noonu", islands: ["Manadhoo", "Velidhoo", "Holhudhoo", "Kendhikulhudhoo"] },
  { code: "R", name: "Raa", islands: ["Ungoofaaru", "Dhuvaafaru", "Meedhoo", "Maduvvari", "Alifushi"] },
  { code: "BAA", name: "Baa", islands: ["Eydhafushi", "Dharavandhoo", "Thulhaadhoo", "Kendhoo"] },
  { code: "LH", name: "Lhaviyani", islands: ["Naifaru", "Hinnavaru", "Kurendhoo", "Olhuvelifushi"] },
  { code: "KAA", name: "Kaafu (Malé Atoll)", islands: ["Malé", "Hulhumalé", "Villimalé", "Thulusdhoo", "Maafushi", "Guraidhoo", "Himmafushi", "Dhiffushi", "Kaashidhoo"] },
  { code: "AA", name: "Alifu Alifu", islands: ["Rasdhoo", "Ukulhas", "Thoddoo", "Bodufolhudhoo", "Feridhoo"] },
  { code: "ALI", name: "Alifu Dhaalu", islands: ["Mahibadhoo", "Dhangethi", "Dhigurah", "Maamigili", "Omadhoo", "Fenfushi"] },
  { code: "V", name: "Vaavu", islands: ["Felidhoo", "Fulidhoo", "Keyodhoo", "Thinadhoo", "Rakeedhoo"] },
  { code: "M", name: "Meemu", islands: ["Muli", "Dhiggaru", "Kolhufushi", "Naalaafushi"] },
  { code: "F", name: "Faafu", islands: ["Nilandhoo", "Magoodhoo", "Feeali", "Dharanboodhoo"] },
  { code: "DH", name: "Dhaalu", islands: ["Kudahuvadhoo", "Meedhoo", "Bandidhoo", "Hulhudheli"] },
  { code: "TH", name: "Thaa", islands: ["Veymandoo", "Thimarafushi", "Guraidhoo", "Kinbidhoo", "Vilufushi"] },
  { code: "LAA", name: "Laamu", islands: ["Fonadhoo", "Gan", "Maabaidhoo", "Isdhoo", "Maamendhoo", "Kadhdhoo"] },
  { code: "GA", name: "Gaafu Alifu", islands: ["Villingili", "Dhaandhoo", "Kolamaafushi", "Gemanafushi"] },
  { code: "GDH", name: "Gaafu Dhaalu", islands: ["Thinadhoo", "Gadhdhoo", "Fares-Maathodaa", "Vaadhoo", "Rathafandhoo"] },
  { code: "GN", name: "Gnaviyani", islands: ["Fuvahmulah"] },
  { code: "ADD", name: "Addu City", islands: ["Hithadhoo", "Maradhoo", "Feydhoo", "Hulhudhoo", "Meedhoo"] },
];


// Reference data every Alibe needs: categories, and the atolls and islands.
// Safe to run on every start (upserts). No demo users or listings.
async function main() {
  // The category tree, once per version (staff edit it in the app after that).
  console.log("Seeding categories...");
  await syncCategoryTree();

  console.log("Seeding atolls & islands...");
  for (const { code, name: atollName, islands } of ATOLLS) {
    const atoll = await prisma.atoll.upsert({
      where: { code },
      update: {},
      create: { name: atollName, code },
    });
    for (const islandName of islands) {
      await prisma.island.upsert({
        where: { atollId_name: { atollId: atoll.id, name: islandName } },
        update: {},
        create: { name: islandName, atollId: atoll.id },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
