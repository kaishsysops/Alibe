import { prisma } from "../db.js";
import { safeRouter } from "../http.js";
import { cached } from "../cache.js";

// What link previews (WhatsApp, Viber, Facebook, X...) and search engines see.
// The app is a single page that draws itself with JavaScript, so on its own a
// shared listing shows no title or photo. The web container's nginx sends
// those bots here instead (mobile/nginx.conf); people still get the app.
export const shareRouter = safeRouter();

const site = () => (process.env.WEB_ORIGIN || "https://alibe.online").replace(/\/$/, "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const abs = (img?: string | null) => (!img ? `${site()}/api/brand/icon-512.png` : img.startsWith("/uploads/") ? `${site()}/api${img}` : img);
const CONDITION: Record<string, string> = { NEW: "New", LIKE_NEW: "Like new", GOOD: "Good condition", FAIR: "Fair condition" };

function page(o: { title: string; description: string; image: string; url: string; type?: string; jsonLd?: object }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(o.url)}">
<meta property="og:site_name" content="Alibe">
<meta property="og:type" content="${o.type ?? "website"}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:image" content="${esc(o.image)}">
<meta property="og:url" content="${esc(o.url)}">
<meta name="twitter:card" content="summary_large_image">
${o.jsonLd ? `<script type="application/ld+json">${JSON.stringify(o.jsonLd).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body>
<h1>${esc(o.title)}</h1>
<p>${esc(o.description)}</p>
<img src="${esc(o.image)}" alt="">
<p><a href="${esc(o.url)}">Open on Alibe</a></p>
</body>
</html>`;
}

shareRouter.get("/listing/:id", async (req, res) => {
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: { island: { include: { atoll: true } }, category: true },
  });
  const url = `${site()}/listing/${encodeURIComponent(req.params.id)}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  if (!listing || listing.hiddenAt) {
    return res.status(404).send(page({ title: "Alibe", description: "This listing is no longer on Alibe.", image: abs(null), url: site() }));
  }
  const price = `MVR ${listing.price.toLocaleString("en-US")}`;
  const where = [listing.island?.name, listing.island?.atoll?.name].filter(Boolean).join(", ");
  const sold = listing.status === "SOLD" ? "Sold · " : "";
  const description = `${sold}${price} · ${CONDITION[listing.condition] ?? ""} · ${where}. ${listing.description}`.replace(/\s+/g, " ").slice(0, 200);
  res.send(
    page({
      title: `${listing.title} · ${price} · Alibe`,
      description,
      image: abs(listing.images[0]),
      url,
      type: "product",
      // Lets Google show the price and availability in results.
      jsonLd: {
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
          url,
        },
      },
    })
  );
});

// Every active listing plus the main pages, for search engines. Rebuilt at
// most every 30 minutes.
shareRouter.get("/sitemap.xml", async (_req, res) => {
  const xml = await cached("sitemap", 30 * 60_000, async () => {
    const listings = await prisma.listing.findMany({
      where: { status: "ACTIVE", hiddenAt: null },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 45_000,
    });
    const urls = [
      `<url><loc>${site()}/</loc><changefreq>hourly</changefreq></url>`,
      `<url><loc>${site()}/search</loc><changefreq>hourly</changefreq></url>`,
      ...listings.map((l) => `<url><loc>${site()}/listing/${l.id}</loc><lastmod>${l.updatedAt.toISOString()}</lastmod></url>`),
    ];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  });
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=1800");
  res.send(xml);
});
