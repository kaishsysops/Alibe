import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "Electronics", slug: "electronics", icon: "smartphone" },
  { name: "Vehicles", slug: "vehicles", icon: "car" },
  { name: "Furniture", slug: "furniture", icon: "sofa" },
  { name: "Fashion", slug: "fashion", icon: "shirt" },
  { name: "Property", slug: "property", icon: "home" },
  { name: "Jobs", slug: "jobs", icon: "briefcase" },
  { name: "Services", slug: "services", icon: "wrench" },
  { name: "Home & Garden", slug: "home-garden", icon: "flower" },
];

const ATOLLS: Record<string, string[]> = {
  "Kaafu (Malé Atoll)": ["Malé", "Hulhumalé", "Villimalé", "Thulusdhoo"],
  "Addu City": ["Hithadhoo", "Maradhoo", "Feydhoo", "Hulhudhoo"],
  "Alifu Dhaalu": ["Mahibadhoo", "Dhangethi", "Dhigurah"],
  "Baa": ["Eydhafushi", "Dharavandhoo", "Thulhaadhoo"],
  "Laamu": ["Fonadhoo", "Gan", "Maabaidhoo"],
};

async function main() {
  console.log("Seeding categories...");
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
  }

  console.log("Seeding atolls & islands...");
  for (const [atollName, islands] of Object.entries(ATOLLS)) {
    const code = atollName.slice(0, 3).toUpperCase();
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

  console.log("Seeding demo user...");
  const demoUser = await prisma.user.upsert({
    where: { phone: "+9607777777" },
    update: {},
    create: { phone: "+9607777777", name: "Aishath Demo" },
  });

  const [electronics, vehicles, furniture, fashion, property, services, homeGarden] = await Promise.all([
    prisma.category.findUniqueOrThrow({ where: { slug: "electronics" } }),
    prisma.category.findUniqueOrThrow({ where: { slug: "vehicles" } }),
    prisma.category.findUniqueOrThrow({ where: { slug: "furniture" } }),
    prisma.category.findUniqueOrThrow({ where: { slug: "fashion" } }),
    prisma.category.findUniqueOrThrow({ where: { slug: "property" } }),
    prisma.category.findUniqueOrThrow({ where: { slug: "services" } }),
    prisma.category.findUniqueOrThrow({ where: { slug: "home-garden" } }),
  ]);
  const male = await prisma.island.findFirstOrThrow({ where: { name: "Malé" } });
  const hulhumale = await prisma.island.findFirstOrThrow({ where: { name: "Hulhumalé" } });
  const addu = await prisma.island.findFirstOrThrow({ where: { name: "Hithadhoo" } });

  const existingListings = await prisma.listing.count();
  if (existingListings > 0) {
    console.log("Sample listings already present, skipping.");
    return;
  }

  console.log("Seeding sample listings...");
  const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/600`;
  const sampleListings = [
    {
      title: "iPhone 13 Pro - 256GB",
      description: "Barely used, comes with box and charger. No scratches.",
      price: 9500,
      condition: "LIKE_NEW" as const,
      categoryId: electronics.id,
      islandId: male.id,
      images: [img("iphone13")],
    },
    {
      title: "Sony WH-1000XM4 Headphones",
      description: "Excellent noise cancelling, includes case.",
      price: 1800,
      condition: "GOOD" as const,
      categoryId: electronics.id,
      islandId: hulhumale.id,
      images: [img("headphones")],
    },
    {
      title: "Yamaha NMAX Scooter 2021",
      description: "Well maintained, recent service, low mileage.",
      price: 32000,
      condition: "GOOD" as const,
      categoryId: vehicles.id,
      islandId: hulhumale.id,
      images: [img("scooter")],
    },
    {
      title: "Toyota Vitz 2018",
      description: "Single owner, full service history, ready to drive.",
      price: 145000,
      condition: "GOOD" as const,
      categoryId: vehicles.id,
      islandId: male.id,
      images: [img("vitz")],
    },
    {
      title: "3-Seater Sofa (Grey)",
      description: "Moving out sale, must go this week.",
      price: 4200,
      condition: "FAIR" as const,
      categoryId: furniture.id,
      islandId: male.id,
      images: [img("sofa")],
    },
    {
      title: "Solid Wood Dining Table (6-seat)",
      description: "Teak finish, minor wear on legs, very sturdy.",
      price: 6800,
      condition: "GOOD" as const,
      categoryId: furniture.id,
      islandId: addu.id,
      images: [img("diningtable")],
    },
    {
      title: "Designer Abaya - Size M",
      description: "Worn once for an event, dry cleaned.",
      price: 850,
      condition: "LIKE_NEW" as const,
      categoryId: fashion.id,
      islandId: male.id,
      images: [img("abaya")],
    },
    {
      title: "2-Bedroom Apartment, Hulhumalé",
      description: "Sea-facing, fully furnished, available next month.",
      price: 18000,
      condition: "GOOD" as const,
      categoryId: property.id,
      islandId: hulhumale.id,
      images: [img("apartment")],
    },
    {
      title: "AC Servicing & Repair",
      description: "Same-day service across Malé & Hulhumalé.",
      price: 450,
      condition: "NEW" as const,
      categoryId: services.id,
      islandId: male.id,
      images: [img("acrepair")],
    },
    {
      title: "Indoor Plant Bundle (Set of 4)",
      description: "Snake plant, pothos, ZZ plant, monstera cutting.",
      price: 320,
      condition: "NEW" as const,
      categoryId: homeGarden.id,
      islandId: addu.id,
      images: [img("plants")],
    },
  ];

  for (const l of sampleListings) {
    await prisma.listing.create({ data: { ...l, sellerId: demoUser.id } });
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
