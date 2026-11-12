import express from "express";
import cors from "cors";
import { categoriesRouter } from "./routes/categories.js";
import { atollsRouter } from "./routes/atolls.js";
import { listingsRouter } from "./routes/listings.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { ibayRouter } from "./routes/ibay.js";
import { adsRouter, purchasesRouter } from "./routes/purchases.js";
import { favoritesRouter } from "./routes/favorites.js";
import { conversationsRouter } from "./routes/conversations.js";
import { usersRouter } from "./routes/users.js";
import { reviewsRouter, reportsRouter, blocksRouter } from "./routes/trust.js";
import { savedSearchesRouter, notificationsRouter } from "./routes/engagement.js";
import { uploadsRouter, UPLOAD_DIR } from "./routes/uploads.js";
import { ordersRouter } from "./routes/orders.js";
import { startReminders } from "./reminders.js";
import { authenticate } from "./auth.js";
import { ipCeiling, accountLimits } from "./rateLimit.js";
import { slipsRouter, moveSlipsOutOfPublicUploads } from "./routes/slips.js";

const app = express();
// Behind nginx (TRUST_PROXY=1) the visitor's IP comes from X-Forwarded-For.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.disable("x-powered-by");
// CORS_ORIGINS (or WEB_ORIGIN, the app's own web address) limits which websites
// may call the API from a browser. Native apps send no Origin and aren't affected.
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.WEB_ORIGIN)?.split(",").map((o) => o.trim()).filter(Boolean);
// X-Has-More tells paged lists (listings) whether to ask for another page.
app.use(cors({ ...(allowedOrigins?.length ? { origin: allowedOrigins } : {}), exposedHeaders: ["X-Has-More"] }));
app.use(ipCeiling);
app.use(express.json({ limit: "1mb" }));
app.use(authenticate);
app.use(accountLimits);

app.get("/health", (_req, res) => res.json({ ok: true, service: "alibe-backend" }));
app.use("/categories", categoriesRouter);
app.use("/atolls", atollsRouter);
app.use("/listings", listingsRouter);
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/ibay", ibayRouter);
app.use("/purchases", purchasesRouter);
app.use("/ads", adsRouter);
app.use("/favorites", favoritesRouter);
app.use("/conversations", conversationsRouter);
app.use("/users", usersRouter);
app.use("/reviews", reviewsRouter);
app.use("/reports", reportsRouter);
app.use("/blocks", blocksRouter);
app.use("/saved-searches", savedSearchesRouter);
app.use("/notifications", notificationsRouter);
app.use("/orders", ordersRouter);
app.use("/slips", slipsRouter);
app.use("/uploads", uploadsRouter, express.static(UPLOAD_DIR, { maxAge: "30d", immutable: true }));

app.use((_req, res) => res.status(404).json({ error: "We couldn't find what you were looking for." }));

// Last-resort handler: log the real error, give the app a sentence it can show.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err instanceof SyntaxError) return res.status(400).json({ error: "That request was malformed. Please try again." });
  res.status(500).json({ error: "Something went wrong on our side. Please try again." });
});

const port =process.env.PORT ? Number(process.env.PORT) : 4000;
const server = app.listen(port, "0.0.0.0", () => {
  startReminders();
  moveSlipsOutOfPublicUploads().catch((e) => console.error("Couldn't move payment slips:", e));
  console.log(`Alibe backend listening on http://0.0.0.0:${port}`);
});

// nginx keeps connections to each replica open and reuses them (upstream
// keepalive_timeout 30s). Node must hold them longer, or it can close one just
// as nginx sends a request on it, which nginx sees as a failed replica.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
