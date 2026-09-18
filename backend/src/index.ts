import express from "express";
import cors from "cors";
import { categoriesRouter } from "./routes/categories.js";
import { atollsRouter } from "./routes/atolls.js";
import { listingsRouter } from "./routes/listings.js";
import { authRouter } from "./routes/auth.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, service: "alibe-backend" }));
app.use("/categories", categoriesRouter);
app.use("/atolls", atollsRouter);
app.use("/listings", listingsRouter);
app.use("/auth", authRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Alibe backend listening on http://0.0.0.0:${port}`);
});
