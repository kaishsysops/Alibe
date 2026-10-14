import express from "express";
import cors from "cors";
import { categoriesRouter } from "./routes/categories.js";
import { atollsRouter } from "./routes/atolls.js";
import { listingsRouter } from "./routes/listings.js";
import { authRouter } from "./routes/auth.js";
import { favoritesRouter } from "./routes/favorites.js";
import { conversationsRouter } from "./routes/conversations.js";
import { usersRouter } from "./routes/users.js";
import { reviewsRouter, reportsRouter, blocksRouter } from "./routes/trust.js";
import { savedSearchesRouter, notificationsRouter } from "./routes/engagement.js";
import { uploadsRouter, UPLOAD_DIR } from "./routes/uploads.js";
import { ordersRouter } from "./routes/orders.js";
import { startReminders } from "./reminders.js";
import { authenticate } from "./auth.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(authenticate);

app.get("/health", (_req, res) => res.json({ ok: true, service: "alibe-backend" }));
app.use("/categories", categoriesRouter);
app.use("/atolls", atollsRouter);
app.use("/listings", listingsRouter);
app.use("/auth", authRouter);
app.use("/favorites", favoritesRouter);
app.use("/conversations", conversationsRouter);
app.use("/users", usersRouter);
app.use("/reviews", reviewsRouter);
app.use("/reports", reportsRouter);
app.use("/blocks", blocksRouter);
app.use("/saved-searches", savedSearchesRouter);
app.use("/notifications", notificationsRouter);
app.use("/orders", ordersRouter);
app.use("/uploads", uploadsRouter, express.static(UPLOAD_DIR, { maxAge: "30d", immutable: true }));

app.use((_req, res) => res.status(404).json({ error: "We couldn't find what you were looking for." }));

// Last-resort handler: log the real error, give the app a sentence it can show.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err instanceof SyntaxError) return res.status(400).json({ error: "That request was malformed. Please try again." });
  res.status(500).json({ error: "Something went wrong on our side. Please try again." });
});

const port =process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, "0.0.0.0", () => {
  startReminders();
  console.log(`Alibe backend listening on http://0.0.0.0:${port}`);
});
