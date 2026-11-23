import { prisma } from "../db.js";
import { safeRouter } from "../http.js";
import { cached } from "../cache.js";
import { categoryIndex, descendants, pathOf } from "../categories.js";
import { sellerBadges } from "../sellers.js";

// What search engines and link previews (Google, WhatsApp, Viber, Facebook,
// X...) see. The app is a single page drawn with JavaScript, so on its own a
// crawler gets an almost empty page. The web container's nginx sends known
// bots here instead (mobile/nginx.conf), for Home, categories, stores, seller
// profiles and listings; people always get the app. Each page has a real
// title, description, canonical URL, structured data (schema.org) and plain
// links to the items, so Google can understand and crawl the whole site.
export const shareRouter = safeRouter();

const site = () => (process.env.WEB_ORIGIN || process.env.PUBLIC_URL || "https://alibe.online").replace(/\/$/, "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const abs = (img?: string | null) => (!img ? `${site()}/api/brand/icon-512.png` : img.startsWith("/uploads/") ? `${site()}/api${img}` : img);
const mvr = (n: number) => `MVR ${n.toLocaleString("en-US")}`;
const CONDITION: Record<string, string> = { NEW: "New", LIKE_NEW: "Like new", GOOD: "Good condition", FAIR: "Fair condition" };
const ld = (o: object) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

// The whole site's identity, on every page.
const organization = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Alibe",
  alternateName: "Alibe Maldives",
  url: `${site()}/`,
  logo: `${site()}/api/brand/icon-512.png`,
  areaServed: { "@type": "Country", name: "Maldives" },
});

type ItemRow = { id: string; title: string; price: number; images: string[]; island?: { name: string } | null };

const itemList = (items: ItemRow[]) =>
  items.length
    ? `<ul class="items">${items
        .map((l) => `<li><a href="${site()}/listing/${l.id}"><img src="${esc(abs(l.images[0]))}" alt="${esc(l.title)}" loading="lazy" width="160" height="160"><span>${esc(l.title)}</span><b>${mvr(l.price)}</b>${l.island?.name ? `<small>${esc(l.island.name)}</small>` : ""}</a></li>`)
        .join("")}</ul>`
    : "<p>Nothing for sale here right now.</p>";

function page(o: { title: string; description: string; image?: string; url: string; type?: string; jsonLd?: object[]; body: string; noindex?: boolean }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(o.url)}">
${o.noindex ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:site_name" content="Alibe">
<meta property="og:locale" content="en_MV">
<meta property="og:type" content="${o.type ?? "website"}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:image" content="${esc(o.image ?? abs(null))}">
<meta property="og:url" content="${esc(o.url)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico">
${[organization(), ...(o.jsonLd ?? [])].map(ld).join("\n")}
<style>body{font-family:system-ui,sans-serif;max-width:1000px;margin:0 auto;padding:16px;color:#222}a{color:#e85d00}.items{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}.items a{display:flex;flex-direction:column;gap:4px;text-decoration:none;color:#222}.items img{width:100%;height:auto;border-radius:8px;object-fit:cover}nav a{margin-right:12px}</style>
</head>
<body>
<nav><a href="${site()}/">Alibe</a><a href="${site()}/search">Browse</a><a href="${site()}/help">Help</a><a href="${site()}/help/faq">FAQ</a></nav>
${o.body}
<footer><p>Alibe is the marketplace for the Maldives: buy and sell phones, electronics, furniture, vehicles, boats, fashion and more, from Malé and Hulhumalé to Addu and every atoll.</p></footer>
</body>
</html>`;
}

const send = (res: import("express").Response, html: string, status = 200) => {
  res.status(status).setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(html);
};

const liveListing = { status: "ACTIVE" as const, hiddenAt: null };
const itemSelect = { id: true, title: true, price: true, images: true, island: { select: { name: true } } };

// ---- Home -------------------------------------------------------------------

shareRouter.get("/home", async (_req, res) => {
  const html = await cached("share:home", 5 * 60_000, async () => {
    const index = await categoryIndex();
    const roots = (index.children.get(null) ?? []).filter((c) => !c.hidden);
    const [latest, total] = await Promise.all([
      prisma.listing.findMany({ where: liveListing, select: itemSelect, orderBy: { createdAt: "desc" }, take: 40 }),
      prisma.listing.count({ where: liveListing }),
    ]);
    const description = `Buy and sell in the Maldives on Alibe: ${total.toLocaleString("en-US")} items for sale, from phones and furniture to cars, boats and fashion. Free to list, chat with sellers, in Malé, Hulhumalé, Addu and every atoll.`;
    return page({
      title: "Alibe Maldives: Buy and Sell Online | Phones, Cars, Furniture and More",
      description,
      url: `${site()}/`,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Alibe",
          alternateName: ["Alibe Maldives", "alibe.online"],
          url: `${site()}/`,
          // The search box Google can show under the result.
          potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${site()}/search?q={search_term_string}` }, "query-input": "required name=search_term_string" },
        },
      ],
      body: `<h1>Alibe: buy and sell across the Maldives</h1>
<p>${esc(description)}</p>
<h2>Categories</h2>
<ul>${roots.map((c) => `<li><a href="${site()}/categories/${c.slug}">${esc(c.name)} for sale in the Maldives</a></li>`).join("")}</ul>
<h2>Just listed</h2>
${itemList(latest)}`,
    });
  });
  send(res, html);
});

// ---- Categories -------------------------------------------------------------

shareRouter.get("/category/:slug", async (req, res) => {
  const index = await categoryIndex();
  const cat = index.bySlug.get(req.params.slug);
  if (!cat || cat.hidden) return send(res, page({ title: "Not found · Alibe", description: "This category isn't on Alibe.", url: `${site()}/`, body: "<h1>Not found</h1>", noindex: true }), 404);
  const ids = descendants(index, cat.slug).map((d) => d.id);
  const [items, total] = await Promise.all([
    prisma.listing.findMany({ where: { ...liveListing, categoryId: { in: ids } }, select: itemSelect, orderBy: { createdAt: "desc" }, take: 60 }),
    prisma.listing.count({ where: { ...liveListing, categoryId: { in: ids } } }),
  ]);
  const trail = pathOf(index, cat.id);
  const subs = (index.children.get(cat.id) ?? []).filter((c) => !c.hidden);
  const url = `${site()}/categories/${cat.slug}`;
  const description = total
    ? `${total.toLocaleString("en-US")} ${cat.name.toLowerCase()} for sale in the Maldives on Alibe. New and used, from Malé to Addu. Chat with sellers and agree a price.`
    : `Buy and sell ${cat.name.toLowerCase()} in the Maldives on Alibe. Be the first to list one.`;
  send(
    res,
    page({
      title: `${cat.name} for sale in the Maldives | Alibe`,
      description,
      image: abs(items[0]?.images[0]),
      url,
      // An empty category isn't worth a search result.
      noindex: total === 0,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [{ "@type": "ListItem", position: 1, name: "Alibe", item: `${site()}/` }, ...trail.map((c, i) => ({ "@type": "ListItem", position: i + 2, name: c.name, item: `${site()}/categories/${c.slug}` }))],
        },
      ],
      body: `<p>${trail.map((c) => `<a href="${site()}/categories/${c.slug}">${esc(c.name)}</a>`).join(" › ")}</p>
<h1>${esc(cat.name)} for sale in the Maldives</h1>
<p>${esc(description)}</p>
${subs.length ? `<h2>More in ${esc(cat.name)}</h2><ul>${subs.map((c) => `<li><a href="${site()}/categories/${c.slug}">${esc(c.name)}</a></li>`).join("")}</ul>` : ""}
${itemList(items)}`,
    })
  );
});

// ---- Stores -----------------------------------------------------------------

shareRouter.get("/store/:slug", async (req, res) => {
  const store = await prisma.store.findUnique({ where: { slug: req.params.slug }, include: { user: { select: { bannedAt: true } } } });
  const badges = store ? await sellerBadges([store.userId]) : null;
  const live = !!store && store.status === "APPROVED" && !!badges?.get(store.userId)?.store && !store.user.bannedAt;
  if (!store || !live) return send(res, page({ title: "Store not found · Alibe", description: "This store isn't open on Alibe.", url: `${site()}/`, body: "<h1>Store not found</h1>", noindex: true }), 404);
  const items = await prisma.listing.findMany({ where: { ...liveListing, storeId: store.id }, select: itemSelect, orderBy: { createdAt: "desc" }, take: 60 });
  const url = `${site()}/store/${store.slug}`;
  const description = `${store.name} on Alibe: shop ${items.length} items from this registered store in the Maldives. Message the store, agree a price and arrange delivery.`;
  send(
    res,
    page({
      title: `${store.name} | Shop on Alibe Maldives`,
      description,
      image: abs(store.logoUrl),
      url,
      jsonLd: [{ "@context": "https://schema.org", "@type": "Store", name: store.name, url, logo: abs(store.logoUrl), image: abs(store.logoUrl), address: { "@type": "PostalAddress", addressCountry: "MV" } }],
      body: `<h1>${esc(store.name)}</h1>
<p>${esc(description)}</p>
${itemList(items)}`,
    })
  );
});

// ---- Seller profiles --------------------------------------------------------

shareRouter.get("/seller/:id", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, avatarUrl: true, bannedAt: true, isSystem: true, createdAt: true } });
  if (!user || user.bannedAt || user.isSystem) return send(res, page({ title: "Seller not found · Alibe", description: "This seller isn't on Alibe.", url: `${site()}/`, body: "<h1>Seller not found</h1>", noindex: true }), 404);
  const items = await prisma.listing.findMany({ where: { ...liveListing, sellerId: user.id }, select: itemSelect, orderBy: { createdAt: "desc" }, take: 60 });
  const url = `${site()}/seller/${user.id}`;
  const description = `${user.name} sells on Alibe, the Maldives marketplace. ${items.length} ${items.length === 1 ? "item" : "items"} for sale.`;
  send(res, page({ title: `${user.name} on Alibe Maldives`, description, image: abs(user.avatarUrl), url, noindex: items.length === 0, type: "profile", body: `<h1>${esc(user.name)}</h1><p>${esc(description)}</p>${itemList(items)}` }));
});

// ---- Listings ---------------------------------------------------------------

shareRouter.get("/listing/:id", async (req, res) => {
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: { island: { include: { atoll: true } }, category: true, seller: { select: { id: true, name: true } } },
  });
  const url = `${site()}/listing/${encodeURIComponent(req.params.id)}`;
  if (!listing || listing.hiddenAt || listing.status === "PENDING" || listing.status === "REJECTED" || listing.status === "DRAFT") {
    return send(res, page({ title: "No longer on Alibe", description: "This listing is no longer on Alibe.", url: site(), body: "<h1>This listing is no longer on Alibe</h1>", noindex: true }), 404);
  }
  const index = await categoryIndex();
  const trail = listing.categoryId ? pathOf(index, listing.categoryId) : [];
  const price = mvr(listing.price);
  const where = [listing.island?.name, listing.island?.atoll?.name].filter(Boolean).join(", ");
  const sold = listing.status === "SOLD" ? "Sold · " : "";
  const description = `${sold}${price} · ${CONDITION[listing.condition] ?? ""} · ${where}. ${listing.description}`.replace(/\s+/g, " ").slice(0, 200);
  const more = await prisma.listing.findMany({
    where: { ...liveListing, categoryId: listing.categoryId, id: { not: listing.id } },
    select: itemSelect,
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  send(
    res,
    page({
      title: `${listing.title} · ${price} · ${listing.island?.name ? `${listing.island.name}, Maldives` : "Maldives"} | Alibe`,
      description,
      image: abs(listing.images[0]),
      url,
      type: "product",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: listing.title,
          description: listing.description.slice(0, 500),
          image: listing.images.slice(0, 5).map(abs),
          category: listing.category?.name,
          offers: {
            "@type": "Offer",
            price: listing.price,
            priceCurrency: "MVR",
            availability: listing.status === "ACTIVE" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
            itemCondition: listing.condition === "NEW" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
            areaServed: where || "Maldives",
            seller: { "@type": "Person", name: listing.seller.name },
            url,
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [{ "@type": "ListItem", position: 1, name: "Alibe", item: `${site()}/` }, ...trail.map((c, i) => ({ "@type": "ListItem", position: i + 2, name: c.name, item: `${site()}/categories/${c.slug}` })), { "@type": "ListItem", position: trail.length + 2, name: listing.title, item: url }],
        },
      ],
      body: `<p>${trail.map((c) => `<a href="${site()}/categories/${c.slug}">${esc(c.name)}</a>`).join(" › ")}</p>
<h1>${esc(listing.title)}</h1>
<p><b>${price}</b> · ${esc(CONDITION[listing.condition] ?? "")} · ${esc(where)}</p>
${listing.images.slice(0, 6).map((i) => `<img src="${esc(abs(i))}" alt="${esc(listing.title)}" width="320" loading="lazy">`).join("")}
<p>${esc(listing.description)}</p>
<p>Sold by <a href="${site()}/seller/${listing.seller.id}">${esc(listing.seller.name)}</a></p>
<h2>More like this</h2>
${itemList(more)}`,
    })
  );
});

// ---- Sitemap ----------------------------------------------------------------

// Home, categories with items, open stores, help pages and every live
// listing. Rebuilt at most every 30 minutes.
shareRouter.get("/sitemap.xml", async (_req, res) => {
  const xml = await cached("sitemap", 30 * 60_000, async () => {
    const index = await categoryIndex();
    const [listings, counts, stores, sellers] = await Promise.all([
      prisma.listing.findMany({ where: liveListing, select: { id: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 40_000 }),
      prisma.listing.groupBy({ by: ["categoryId"], where: liveListing, _count: { _all: true } }),
      prisma.store.findMany({ where: { status: "APPROVED" }, select: { slug: true, userId: true, updatedAt: true } }),
      prisma.listing.groupBy({ by: ["sellerId"], where: liveListing, _count: { _all: true }, orderBy: { _count: { sellerId: "desc" } }, take: 2000 }),
    ]);
    // A category counts if anything under it is for sale.
    const withItems = new Set<string>();
    for (const c of counts) for (const p of pathOf(index, c.categoryId)) withItems.add(p.slug);
    const badges = await sellerBadges(stores.map((s) => s.userId));
    const u = (loc: string, extra = "") => `<url><loc>${site()}${loc}</loc>${extra}</url>`;
    const urls = [
      u("/", "<changefreq>hourly</changefreq><priority>1.0</priority>"),
      u("/search", "<changefreq>hourly</changefreq>"),
      ...[...withItems].map((slug) => u(`/categories/${slug}`, "<changefreq>daily</changefreq><priority>0.8</priority>")),
      ...stores.filter((s) => badges.get(s.userId)?.store).map((s) => u(`/store/${s.slug}`, `<lastmod>${s.updatedAt.toISOString()}</lastmod>`)),
      ...sellers.map((s) => u(`/seller/${s.sellerId}`)),
      u("/help", "<changefreq>monthly</changefreq>"),
      u("/help/faq", "<changefreq>monthly</changefreq>"),
      ...["start", "buying", "selling", "safety", "orders", "boosts", "premium", "verify", "account"].map((t) => u(`/help/${t}`, "<changefreq>monthly</changefreq>")),
      u("/safety"),
      u("/privacy"),
      u("/terms"),
      ...listings.map((l) => u(`/listing/${l.id}`, `<lastmod>${l.updatedAt.toISOString()}</lastmod>`)),
    ];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  });
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=1800");
  res.send(xml);
});
