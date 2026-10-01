import { PrismaClient } from "@prisma/client";
import { CATALOG, LEGACY_TITLE_PHOTOS, photo } from "./catalog";

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
    create: { phone: "+9607777777", name: "Aishath Demo", whatsappEnabled: true, showPhone: true },
  });

  await seedMarketplaceSeller();
  await replacePlaceholderImages();

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

  const existingListings = await prisma.listing.count({ where: { sellerId: demoUser.id } });
  if (existingListings > 0) {
    console.log("Sample listings already present, skipping.");
    return;
  }

  console.log("Seeding sample listings...");
  const gallery = (title: string) => (LEGACY_TITLE_PHOTOS[title] ?? []).map(photo);
  const sampleListings = [
    {
      title: "iPhone 13 Pro - 256GB",
      description: "Barely used, comes with box and charger. No scratches.",
      price: 9500,
      condition: "LIKE_NEW" as const,
      categoryId: electronics.id,
      islandId: male.id,
      images: [] as string[],
    },
    {
      title: "Sony WH-1000XM4 Headphones",
      description: "Excellent noise cancelling, includes case.",
      price: 1800,
      condition: "GOOD" as const,
      categoryId: electronics.id,
      islandId: hulhumale.id,
      images: [] as string[],
    },
    {
      title: "Yamaha NMAX Scooter 2021",
      description: "Well maintained, recent service, low mileage.",
      price: 32000,
      condition: "GOOD" as const,
      categoryId: vehicles.id,
      islandId: hulhumale.id,
      images: [] as string[],
    },
    {
      title: "Toyota Vitz 2018",
      description: "Single owner, full service history, ready to drive.",
      price: 145000,
      condition: "GOOD" as const,
      categoryId: vehicles.id,
      islandId: male.id,
      images: [] as string[],
    },
    {
      title: "3-Seater Sofa (Grey)",
      description: "Moving out sale, must go this week.",
      price: 4200,
      condition: "FAIR" as const,
      categoryId: furniture.id,
      islandId: male.id,
      images: [] as string[],
    },
    {
      title: "Solid Wood Dining Table (6-seat)",
      description: "Teak finish, minor wear on legs, very sturdy.",
      price: 6800,
      condition: "GOOD" as const,
      categoryId: furniture.id,
      islandId: addu.id,
      images: [] as string[],
    },
    {
      title: "Designer Abaya - Size M",
      description: "Worn once for an event, dry cleaned.",
      price: 850,
      condition: "LIKE_NEW" as const,
      categoryId: fashion.id,
      islandId: male.id,
      images: [] as string[],
    },
    {
      title: "2-Bedroom Apartment, Hulhumalé",
      description: "Sea-facing, fully furnished, available next month.",
      price: 18000,
      condition: "GOOD" as const,
      categoryId: property.id,
      islandId: hulhumale.id,
      images: [] as string[],
    },
    {
      title: "AC Servicing & Repair",
      description: "Same-day service across Malé & Hulhumalé.",
      price: 450,
      condition: "NEW" as const,
      categoryId: services.id,
      islandId: male.id,
      images: [] as string[],
    },
    {
      title: "Indoor Plant Bundle (Set of 4)",
      description: "Snake plant, pothos, ZZ plant, monstera cutting.",
      price: 320,
      condition: "NEW" as const,
      categoryId: homeGarden.id,
      islandId: addu.id,
      images: [] as string[],
    },
  ];

  for (const l of sampleListings) {
    await prisma.listing.create({ data: { ...l, images: gallery(l.title), sellerId: demoUser.id } });
  }

  console.log("Done.");
}

// A realistic, busy seller with a large catalogue of stock-photo listings.
// Idempotent: only adds items this seller doesn't already have (by title).
async function seedMarketplaceSeller() {
  const seller = await prisma.user.upsert({
    where: { phone: "+9607412345" },
    update: {},
    create: {
      phone: "+9607412345",
      name: "Hassan Rasheed",
      username: "hassan_mv",
      bio: "Electronics, bikes and home goods. Fast replies, pickup in Malé or delivery by ferry.",
      avatarColor: "#2E86DE",
      showPhone: true,
      whatsappEnabled: true,
      viberEnabled: true,
      verificationStatus: "VERIFIED",
      verifiedAt: new Date(),
    },
  });

  const [categories, islands, existing] = await Promise.all([
    prisma.category.findMany(),
    prisma.island.findMany({ orderBy: { name: "asc" } }),
    prisma.listing.findMany({ where: { sellerId: seller.id }, select: { title: true } }),
  ]);
  const have = new Set(existing.map((l) => l.title));
  const missing = CATALOG.filter((c) => !have.has(c.title));
  await seedDeliveryAndReviews(seller.id);
  if (!missing.length) {
    console.log("Marketplace seller catalogue already present.");
    return;
  }

  console.log(`Seeding ${missing.length} stock-photo listings for ${seller.name}...`);
  const now = Date.now();
  for (const [i, entry] of missing.entries()) {
    const category = categories.find((c) => c.slug === entry.category);
    if (!category) continue;
    await prisma.listing.create({
      data: {
        title: entry.title,
        description: entry.description,
        price: entry.price,
        condition: entry.condition,
        images: entry.photos.map(photo),
        categoryId: category.id,
        islandId: islands[(i * 7) % islands.length].id,
        sellerId: seller.id,
        // Stagger timestamps so "newest" ordering looks like real activity.
        createdAt: new Date(now - i * 47 * 60 * 1000),
      },
    });
  }
}

// Delivery options by category (big items go by ferry cargo, small ones by
// courier) and a handful of buyer reviews so ratings have something to show.
async function seedDeliveryAndReviews(sellerId: string) {
  const listings = await prisma.listing.findMany({ where: { sellerId }, include: { category: true } });
  for (const l of listings) {
    if (l.deliveryOptions.length > 1) continue;
    const slug = l.category.slug;
    const options =
      slug === "property" || slug === "jobs" || slug === "services"
        ? ["PICKUP"]
        : slug === "furniture" || slug === "vehicles"
        ? ["PICKUP", "FERRY"]
        : ["PICKUP", "COURIER", "FERRY"];
    await prisma.listing.update({
      where: { id: l.id },
      data: {
        deliveryOptions: options as any,
        deliveryNote: options.includes("FERRY") ? "Ferry cargo to any island, buyer pays the cargo fee." : null,
      },
    });
  }

  await seedDeliveredOrders(sellerId);
  if ((await prisma.review.count({ where: { sellerId } })) > 0) return;
  const reviewers = [
    { phone: "+9607001001", name: "Mariyam Naseer", rating: 5, text: "Item exactly as described and he sent it on the next ferry. Would buy again." },
    { phone: "+9607001002", name: "Ibrahim Shareef", rating: 5, text: "Quick replies on WhatsApp, fair price, easy pickup in Malé." },
    { phone: "+9607001003", name: "Aminath Zahira", rating: 4, text: "Good condition. Pickup took a day longer than planned but he kept me updated." },
  ];
  for (const [i, r] of reviewers.entries()) {
    const reviewer = await prisma.user.upsert({ where: { phone: r.phone }, update: {}, create: { phone: r.phone, name: r.name } });
    const listing = listings[i * 5];
    if (!listing) continue;
    await prisma.review.upsert({
      where: { reviewerId_listingId: { reviewerId: reviewer.id, listingId: listing.id } },
      update: {},
      create: { reviewerId: reviewer.id, sellerId, listingId: listing.id, rating: r.rating, text: r.text },
    });
  }
  console.log("Seeded delivery options and reviews.");
}

// Verification is earned with 5 buyer-verified deliveries, so the seeded
// verified seller gets 5 completed orders (small items, now marked sold).
async function seedDeliveredOrders(sellerId: string) {
  if ((await prisma.order.count({ where: { sellerId, status: "DELIVERED" } })) >= 5) return;
  const sales = [
    { title: "Plain White Cotton T-Shirt (M)", buyer: { phone: "+9607001001", name: "Mariyam Naseer" }, method: "COURIER", courierName: "Malé Express" },
    { title: "Polarised Sunglasses", buyer: { phone: "+9607001002", name: "Ibrahim Shareef" }, method: "PICKUP" },
    { title: "Mini Cactus Collection", buyer: { phone: "+9607001003", name: "Aminath Zahira" }, method: "FERRY", boatName: "MV Hithadhoo Express" },
    { title: "Graphic Print Tee (L)", buyer: { phone: "+9607001004", name: "Ahmed Riyaz" }, method: "COURIER", courierName: "Malé Express" },
    { title: "Snake Plant in Ceramic Pot", buyer: { phone: "+9607001005", name: "Fathimath Shiuna" }, method: "FERRY", boatName: "Dhoni Raalhu 2" },
  ];
  for (const [i, sale] of sales.entries()) {
    const listing = await prisma.listing.findFirst({ where: { sellerId, title: sale.title } });
    if (!listing) continue;
    const buyer = await prisma.user.upsert({ where: { phone: sale.buyer.phone }, update: {}, create: sale.buyer });
    const conversation = await prisma.conversation.upsert({
      where: { listingId_buyerId: { listingId: listing.id, buyerId: buyer.id } },
      update: {},
      create: { listingId: listing.id, buyerId: buyer.id, sellerId },
    });
    if (await prisma.order.findFirst({ where: { listingId: listing.id } })) continue;
    const deliveredAt = new Date(Date.now() - (i + 2) * 86400000);
    await prisma.message.create({ data: { conversationId: conversation.id, senderId: buyer.id, text: "Hi, is this still available?", createdAt: new Date(deliveredAt.getTime() - 86400000) } });
    await prisma.order.create({
      data: {
        listingId: listing.id,
        conversationId: conversation.id,
        buyerId: buyer.id,
        sellerId,
        amount: listing.price,
        status: "DELIVERED",
        deliveryMethod: sale.method as any,
        boatName: sale.boatName ?? null,
        boatDeparture: sale.boatName ? new Date(deliveredAt.getTime() - 6 * 3600000) : null,
        courierName: sale.courierName ?? null,
        handoverCode: String(1000 + i * 1111),
        dispatchedAt: new Date(deliveredAt.getTime() - 8 * 3600000),
        deliveredAt,
        verifiedBy: "BUYER",
      },
    });
    await prisma.listing.update({ where: { id: listing.id }, data: { status: "SOLD" } });
  }
  console.log("Seeded verified deliveries.");
}

async function replacePlaceholderImages() {
  const listings = await prisma.listing.findMany({ where: { images: { isEmpty: false } } });
  let updated = 0;
  for (const l of listings) {
    if (!l.images.some((u) => u.includes("picsum.photos"))) continue;
    const keys = LEGACY_TITLE_PHOTOS[l.title];
    if (!keys) continue;
    await prisma.listing.update({ where: { id: l.id }, data: { images: keys.map(photo) } });
    updated++;
  }
  if (updated) console.log(`Replaced placeholder photos on ${updated} listing(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
