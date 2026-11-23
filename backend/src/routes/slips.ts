import path from "node:path";
import fs from "node:fs/promises";
import { mkdirSync } from "node:fs";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { safeRouter } from "../http.js";
import { UPLOAD_DIR } from "./uploads.js";

// Payment slips show bank details, so they don't stay in the public uploads
// folder. When a slip is submitted it moves here, and staff open it through a
// signed link that expires after an hour.
export const SLIP_DIR = path.resolve("private/slips");
mkdirSync(SLIP_DIR, { recursive: true });

// A fresh secret on every start is fine: links only need to last an hour.
const SECRET = process.env.SLIP_LINK_SECRET || crypto.randomBytes(32).toString("hex");
const LINK_TTL_MS = 3600_000;
const NAME = /^[\w-]+\.[a-z0-9]+$/;

const sign = (name: string, exp: number) => crypto.createHmac("sha256", SECRET).update(`${name}:${exp}`).digest("base64url");

// Turns a stored slip path (/slips/<name>) into a link staff can open.
export function signedSlipUrl(slipUrl: string | null) {
  if (!slipUrl?.startsWith("/slips/")) return slipUrl;
  const name = slipUrl.slice("/slips/".length);
  const exp = Date.now() + LINK_TTL_MS;
  return `/slips/${name}?exp=${exp}&sig=${sign(name, exp)}`;
}

// Moves a just-uploaded file (/uploads/<name>) into private storage and returns
// its new path, or null if there's no such upload.
export async function makeSlipPrivate(uploadPath: string) {
  if (!uploadPath.startsWith("/uploads/")) return uploadPath.startsWith("/slips/") ? uploadPath : null;
  const name = uploadPath.slice("/uploads/".length);
  if (!NAME.test(name)) return null;
  const from = path.join(UPLOAD_DIR, name);
  try {
    // Copy then delete: the two folders can be different Docker volumes.
    await fs.copyFile(from, path.join(SLIP_DIR, name));
    await fs.unlink(from);
  } catch {
    return null;
  }
  return `/slips/${name}`;
}

// One-off on start: slips stored before this existed get moved too.
export async function moveSlipsOutOfPublicUploads() {
  const old = await prisma.purchase.findMany({ where: { slipUrl: { startsWith: "/uploads/" } }, select: { id: true, slipUrl: true } });
  for (const p of old) {
    const moved = await makeSlipPrivate(p.slipUrl!);
    if (moved) await prisma.purchase.update({ where: { id: p.id }, data: { slipUrl: moved } });
  }
  if (old.length) console.log(`Moved ${old.length} payment slip(s) to private storage.`);
}

export const slipsRouter = safeRouter();

slipsRouter.get("/:name", async (req, res) => {
  const { name } = req.params;
  const exp = Number(req.query.exp);
  const sig = String(req.query.sig ?? "");
  const expected = NAME.test(name) && exp > Date.now() ? sign(name, exp) : null;
  const ok = expected && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) return res.status(403).json({ error: "This link has expired. Open the slip again from the admin screen." });
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(path.join(SLIP_DIR, name), (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "We couldn't find that slip." });
  });
});

// ---- ID and selfie photos (seller applications) -------------------------------
// Same idea as slips, stricter: moved out of public uploads on submit, shown to
// Seller approvers through links that expire in 10 minutes, and deleted as
// soon as the application is decided.
export const ID_DIR = path.resolve("private/ids");
mkdirSync(ID_DIR, { recursive: true });
const ID_LINK_TTL_MS = 10 * 60_000;
const signId = (name: string, exp: number) => crypto.createHmac("sha256", SECRET).update(`id:${name}:${exp}`).digest("base64url");

// Moves an uploaded photo into ID storage; returns its stored name, or null.
export async function makeIdPrivate(uploadPath: string) {
  if (!uploadPath.startsWith("/uploads/")) return null;
  const name = uploadPath.slice("/uploads/".length);
  if (!NAME.test(name)) return null;
  try {
    await fs.copyFile(path.join(UPLOAD_DIR, name), path.join(ID_DIR, name));
    await fs.unlink(path.join(UPLOAD_DIR, name));
  } catch {
    return null;
  }
  return name;
}

export async function deleteIdPhotos(names: Array<string | null | undefined>) {
  for (const n of names) if (n && NAME.test(n)) await fs.unlink(path.join(ID_DIR, n)).catch(() => {});
}

export function signedIdUrl(name: string | null) {
  if (!name) return null;
  const exp = Date.now() + ID_LINK_TTL_MS;
  return `/ids/${name}?exp=${exp}&sig=${signId(name, exp)}`;
}

export const idsRouter = safeRouter();

idsRouter.get("/:name", async (req, res) => {
  const { name } = req.params;
  const exp = Number(req.query.exp);
  const sig = String(req.query.sig ?? "");
  const expected = NAME.test(name) && exp > Date.now() ? signId(name, exp) : null;
  const ok = expected && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) return res.status(403).json({ error: "This link has expired. Open the application again." });
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(path.join(ID_DIR, name), (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "This photo was deleted (the application was decided)." });
  });
});
