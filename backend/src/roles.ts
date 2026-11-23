import { NextFunction, Request, Response } from "express";
import type { StaffRole } from "@prisma/client";
import { prisma } from "./db.js";

// Who may do what. Admins (User.isAdmin) can do everything and are the only
// ones who can use admin.alibe.online. Everyone else gets portal roles:
//   SELLER_APPROVER  verification and store applications (sees ID photos)
//   POST_APPROVER    posts from sellers who aren't approved yet
//   MODERATOR        reports, removing listings (not bans, not money)
//   SUPPORT          looks things up, changes nothing
export const PORTAL_ROLES: StaffRole[] = ["SELLER_APPROVER", "POST_APPROVER", "MODERATOR", "SUPPORT"];

export type Access = { admin: boolean; roles: StaffRole[] };

// Staff access only counts on a staff session (username + password on the
// admin/portal sites). The same person signed in to the marketplace with
// email or Google is just a customer there.
export function accessFor(req: Request) {
  return accessOf(req.staffSession ? req.userId : undefined);
}

export async function accessOf(userId?: string): Promise<Access> {
  if (!userId) return { admin: false, roles: [] };
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true, staffRoles: true, bannedAt: true } });
  if (!u || u.bannedAt) return { admin: false, roles: [] };
  return { admin: u.isAdmin, roles: u.staffRoles };
}

export const can = (a: Access, roles: StaffRole[]) => a.admin || roles.some((r) => a.roles.includes(r));

const forbidden = (res: Response) => res.status(403).json({ error: "Your account doesn't have access to this." });

// Route guard: admins, or anyone holding one of `roles` (none listed = admins only).
export function requireRole(...roles: StaffRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const a = await accessFor(req);
      if (!can(a, roles)) return forbidden(res);
      res.locals.access = a;
      next();
    } catch (e) {
      next(e);
    }
  };
}

// For /admin/*: most of it is admins only, but a few read-and-moderate routes
// are shared with portal roles. Anything not listed here stays admins only, so
// a new admin route is never accidentally open.
const SHARED: Array<[method: string, path: RegExp, roles: StaffRole[]]> = [
  ["GET", /^\/reports$/, ["MODERATOR"]],
  ["POST", /^\/reports\/resolve$/, ["MODERATOR"]], // bans are checked again inside: admins only
  ["GET", /^\/sellers$/, ["SUPPORT", "SELLER_APPROVER", "MODERATOR"]],
  ["GET", /^\/disputes$/, ["SUPPORT", "MODERATOR"]],
];

export async function adminGate(req: Request, res: Response, next: NextFunction) {
  try {
    const a = await accessFor(req);
    const shared = SHARED.find(([m, re]) => m === req.method && re.test(req.path));
    if (!can(a, shared ? shared[2] : [])) return forbidden(res);
    res.locals.access = a;
    next();
  } catch (e) {
    next(e);
  }
}
