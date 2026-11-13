import { NextFunction, Request, Response } from "express";

// In-memory, fixed-window limits. Two layers:
//  1. ipCeiling, before sign-in is checked: a high per-IP cap that only stops
//     floods. It's high on purpose: Maldivian mobile carriers put many phones
//     behind one public IP (carrier NAT).
//  2. accountLimits, after sign-in is checked: everyday limits keyed by the
//     signed-in account, so neighbours sharing an IP don't use up each
//     other's allowance. Anonymous requests fall back to the IP.
// Each backend replica counts on its own; sign-in code limits that must hold
// across replicas are enforced by nginx in front (mobile/nginx.conf).
// Behind proxies, TRUST_PROXY makes req.ip the visitor's address.
type Rule = { name: string; max: number; windowMs: number; match: (req: Request) => boolean };

const MINUTE = 60_000;
const isWrite = (r: Request) => r.method !== "GET" && r.method !== "HEAD" && r.method !== "OPTIONS";

const ipRules: Rule[] = [{ name: "ip", max: 3000, windowMs: MINUTE, match: () => true }];

const accountRules: Rule[] = [
  { name: "code-request", max: 10, windowMs: 15 * MINUTE, match: (r) => r.method === "POST" && /^\/auth\/(otp|email)\/request$/.test(r.path) },
  { name: "code-verify", max: 30, windowMs: 15 * MINUTE, match: (r) => r.method === "POST" && /^\/auth\/((otp|email)\/verify|staff|create)$/.test(r.path) },
  { name: "upload", max: 60, windowMs: 10 * MINUTE, match: (r) => r.method === "POST" && /^\/uploads\/?$/.test(r.path) },
  { name: "new-listing", max: 30, windowMs: 60 * MINUTE, match: (r) => r.method === "POST" && /^\/listings\/?$/.test(r.path) },
  { name: "write", max: 120, windowMs: MINUTE, match: isWrite },
  { name: "read", max: 600, windowMs: MINUTE, match: () => true },
];

const hits = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, h] of hits) if (h.resetAt <= now) hits.delete(key);
}, 5 * MINUTE).unref();

function limiter(rules: Rule[], who: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const rule = rules.find((r) => r.match(req));
    if (!rule) return next();
    const key = `${rule.name}:${who(req)}`;
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + rule.windowMs };
      hits.set(key, h);
    }
    h.count++;
    if (h.count <= rule.max) return next();
    const wait = Math.ceil((h.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(wait));
    res.status(429).json({ error: `Too many tries. Please wait ${wait > 90 ? `${Math.ceil(wait / 60)} minutes` : `${wait} seconds`} and try again.` });
  };
}

export const ipCeiling = limiter(ipRules, (req) => `ip:${req.ip}`);
export const accountLimits = limiter(accountRules, (req) => (req.userId ? `user:${req.userId}` : `ip:${req.ip}`));
