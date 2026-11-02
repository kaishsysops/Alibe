import crypto from "node:crypto";
import { Response } from "express";
import { prisma } from "./db.js";
import type { Delivery } from "./messaging.js";

// One-time codes for signing in and for adding a phone/email to an account.
// `key` scopes a code to one purpose and destination, so a code sent for one
// thing can't be used for another.
export const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const RESEND_AFTER_MS = 30_000;
const MAX_SENDS_PER_HOUR = 5;
const HOUR_MS = 3600_000;

const hash = (key: string, code: string) => crypto.createHash("sha256").update(`${key}:${code}`).digest("hex");

// Answers a "send me a code" request. A repeat inside the resend window (a
// double tap, say) is a success that sends nothing, with the time left to wait.
export async function sendCode(res: Response, key: string, deliver: (code: string) => Promise<Delivery>) {
  const now = new Date();
  const existing = await prisma.loginCode.findUnique({ where: { key } });
  if (existing) {
    const waitMs = existing.sentAt.getTime() + RESEND_AFTER_MS - now.getTime();
    if (waitMs > 0) return res.json({ sent: true, retryIn: Math.ceil(waitMs / 1000) });
  }
  const windowOpen = existing && now.getTime() - existing.windowStart.getTime() < HOUR_MS;
  if (windowOpen && existing.sendCount >= MAX_SENDS_PER_HOUR) {
    return res.status(429).json({ error: "That's a lot of codes. Please wait an hour and try again." });
  }

  const code = crypto.randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, "0");
  const fields = { codeHash: hash(key, code), expiresAt: new Date(now.getTime() + CODE_TTL_MS), attempts: 0, sentAt: now };
  await prisma.loginCode.upsert({
    where: { key },
    create: { key, ...fields, windowStart: now },
    update: { ...fields, sendCount: windowOpen ? { increment: 1 } : 1, windowStart: windowOpen ? undefined : now },
  });
  // Old rows are only useful for the hourly cap; sweep them as we go.
  prisma.loginCode.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - HOUR_MS) } } }).catch(() => {});

  try {
    const { shownInApp } = await deliver(code);
    res.json({ sent: true, retryIn: RESEND_AFTER_MS / 1000, devCode: shownInApp ? code : undefined });
  } catch (e) {
    console.error("Couldn't deliver a sign-in code:", e);
    // Nothing arrived, so let them retry straight away.
    await prisma.loginCode.update({ where: { key }, data: { sentAt: new Date(0) } });
    res.status(503).json({ error: "We couldn't send your code right now. Please try again in a moment." });
  }
}

export type CodeCheck = "ok" | "wrong" | "expired";

// A correct code works once. Each try spends an attempt before the comparison,
// so guesses sent in parallel can't get more than MAX_ATTEMPTS between them.
export async function checkCode(key: string, code: string): Promise<CodeCheck> {
  const spent = await prisma.loginCode.updateMany({
    where: { key, attempts: { lt: MAX_ATTEMPTS }, expiresAt: { gt: new Date() } },
    data: { attempts: { increment: 1 } },
  });
  if (!spent.count) return "expired";
  const used = await prisma.loginCode.deleteMany({ where: { key, codeHash: hash(key, code) } });
  return used.count ? "ok" : "wrong";
}

// Sends the error for a failed check. Returns true when the code was good.
export function respondToCheck(res: Response, result: CodeCheck) {
  if (result === "ok") return true;
  if (result === "wrong") res.status(401).json({ error: "That code isn't right. Please try again." });
  else res.status(410).json({ error: "That code has run out. Please ask for a new one." });
  return false;
}
