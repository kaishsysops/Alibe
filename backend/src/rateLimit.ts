import { NextFunction, Request, Response } from "express";

// Small in-memory, fixed-window limiter keyed by client IP. One backend process
// means one memory, so no Redis needed. Behind nginx, set TRUST_PROXY=1 so
// req.ip is the visitor's address rather than the proxy's.
type Rule = { name: string; max: number; windowMs: number; match: (req: Request) => boolean };

const MINUTE = 60_000;
const rules: Rule[] = [
  // Sign-in codes: each phone/email is already capped; this stops one IP
  // walking through many addresses.
  { name: "code-request", max: 10, windowMs: 15 * MINUTE, match: (r) => r.method === "POST" && /^\/auth\/(otp|email)\/request$/.test(r.path) },
  { name: "code-verify", max: 30, windowMs: 15 * MINUTE, match: (r) => r.method === "POST" && /^\/auth\/((otp|email)\/verify|staff)$/.test(r.path) },
  { name: "upload", max: 60, windowMs: 10 * MINUTE, match: (r) => r.method === "POST" && /^\/uploads\/?$/.test(r.path) },
  { name: "new-listing", max: 30, windowMs: 60 * MINUTE, match: (r) => r.method === "POST" && /^\/listings\/?$/.test(r.path) },
  // Everything else that changes something: messages, offers, reports...
  { name: "write", max: 120, windowMs: MINUTE, match: (r) => r.method !== "GET" && r.method !== "HEAD" && r.method !== "OPTIONS" },
  { name: "read", max: 600, windowMs: MINUTE, match: () => true },
];

const hits = new Map<string, { count: number; resetAt: number }>();

// Forget finished windows now and then so the map can't grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, h] of hits) if (h.resetAt <= now) hits.delete(key);
}, 5 * MINUTE).unref();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const rule = rules.find((r) => r.match(req))!;
  const key = `${rule.name}:${req.ip}`;
  const now = Date.now();
  let h = hits.get(key);
  if (!h || h.resetAt <= now) {
    h = { count: 0, resetAt: now + rule.windowMs };
    hits.set(key, h);
  }
  h.count++;
  if (h.count > rule.max) {
    const wait = Math.ceil((h.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(wait));
    return res.status(429).json({ error: `Too many tries. Please wait ${wait > 90 ? `${Math.ceil(wait / 60)} minutes` : `${wait} seconds`} and try again.` });
  }
  next();
}
