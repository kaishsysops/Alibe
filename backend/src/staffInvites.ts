import crypto from "node:crypto";
import { prisma } from "./db.js";

// One-time sign-in links for staff logins. The raw token only ever exists in
// the link an admin copies; the database keeps its hash. A link works once,
// for 3 days, and making a new one for someone cancels their older links.
export const INVITE_TTL_MS = 3 * 24 * 3600_000;
export const hashInvite = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function createStaffInvite(userId: string, createdById?: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await prisma.$transaction([
    prisma.staffInvite.deleteMany({ where: { userId } }),
    prisma.staffInvite.create({ data: { tokenHash: hashInvite(token), userId, createdById, expiresAt } }),
  ]);
  return { token, expiresAt };
}

// The invite behind a token, if it's still usable (staff, not banned, not expired).
export async function findStaffInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const invite = await prisma.staffInvite.findUnique({ where: { tokenHash: hashInvite(token) }, include: { user: true } });
  if (!invite || invite.expiresAt < new Date()) return null;
  const u = invite.user;
  if (u.bannedAt || (!u.isAdmin && !u.staffRoles.length)) return null;
  return invite;
}
