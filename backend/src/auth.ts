import crypto from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { prisma } from "./db.js";

// Session auth. Signing in returns a random token; the app sends it as
// `Authorization: Bearer <token>` and the server works out who the caller is
// from that, never from ids in the request.
//
// The routes still receive ids like `userId` / `sellerId` in bodies, queries
// and paths (so handlers didn't need rewriting), but `authenticate` rejects
// any request where such an id isn't the signed-in user. That check lives
// here, in one place, so it's easy to audit.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

// Creates a session and returns the raw token. Only its hash is stored, so a
// database leak doesn't hand out working logins.
export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.session.create({ data: { tokenHash: hash(token), userId } });
  return token;
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({ where: { tokenHash: hash(token) } });
}

function bearer(req: Request) {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

// Readable without signing in: browsing, public profiles, reviews, photos,
// and the sign-in endpoints themselves.
const PUBLIC: Array<[string, RegExp]> = [
  ["GET", /^\/health$/],
  ["GET", /^\/categories\/?$/],
  ["GET", /^\/atolls\/?$/],
  ["GET", /^\/listings\/?$/],
  ["GET", /^\/listings\/(?!mine\/)[^/]+$/],
  ["GET", /^\/users\/[^/]+$/],
  ["GET", /^\/users\/[^/]+\/trust$/],
  ["GET", /^\/reviews\/seller\/[^/]+$/],
  ["GET", /^\/uploads\/.+/],
  ["POST", /^\/auth\/otp\/(request|verify)$/],
];

// Body/query fields that name the person *doing* the action. If present they
// must be the signed-in user. (Fields naming someone else, like blockedId or
// reportedUserId, aren't listed.)
const ACTOR_FIELDS = ["userId", "sellerId", "buyerId", "fromId", "senderId", "reporterId", "reviewerId", "blockerId", "viewerId"];

// Path segments that name the caller: /orders/mine/:userId, /users/:id/me...
// Each pattern's first capture group must be the signed-in user.
const SELF_PATHS: Array<[string | null, RegExp]> = [
  [null, /^\/conversations\/mine\/([^/]+)/],
  [null, /^\/orders\/mine\/([^/]+)/],
  [null, /^\/listings\/mine\/([^/]+)/],
  [null, /^\/favorites\/([^/]+)/],
  [null, /^\/notifications\/([^/]+)/],
  [null, /^\/blocks\/([^/]+)/],
  ["GET", /^\/saved-searches\/([^/]+)$/],
  // Everything under /users/:id except the public profile and trust summary.
  [null, /^\/users\/([^/]+)\/(?!trust$).+/],
  ["PATCH", /^\/users\/([^/]+)$/],
  ["DELETE", /^\/users\/([^/]+)$/],
];

const unauthorized = (res: Response) => res.status(401).json({ error: "Please sign in again.", code: "SIGNED_OUT" });
const forbidden = (res: Response) => res.status(403).json({ error: "You can't do that from this account." });

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = bearer(req);
    if (token) {
      const session = await prisma.session.findUnique({ where: { tokenHash: hash(token) }, select: { userId: true, lastUsedAt: true } });
      if (session) {
        req.userId = session.userId;
        // Touch at most once an hour; it's only for spotting stale sessions.
        if (Date.now() - session.lastUsedAt.getTime() > 3600_000) {
          prisma.session.updateMany({ where: { tokenHash: hash(token) }, data: { lastUsedAt: new Date() } }).catch(() => {});
        }
      }
    }

    const path = req.path;
    const isPublic = PUBLIC.some(([method, re]) => method === req.method && re.test(path));
    if (!req.userId) {
      // A public read that names a viewer still needs proof of who that is.
      const namesSomeone = ACTOR_FIELDS.some((f) => req.query?.[f] !== undefined || req.body?.[f] !== undefined);
      return isPublic && !namesSomeone ? next() : unauthorized(res);
    }

    for (const field of ACTOR_FIELDS) {
      for (const value of [req.body?.[field], req.query?.[field]]) {
        if (value !== undefined && value !== req.userId) return forbidden(res);
      }
    }
    for (const [method, re] of SELF_PATHS) {
      if (method && method !== req.method) continue;
      const m = path.match(re);
      if (m && decodeURIComponent(m[1]) !== req.userId) return forbidden(res);
    }
    next();
  } catch (e) {
    next(e);
  }
}
