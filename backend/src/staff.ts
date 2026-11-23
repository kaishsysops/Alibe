import { Prisma, StaffRole } from "@prisma/client";
import { PORTAL_ROLES } from "./roles.js";
import { prisma } from "./db.js";
import { normalizeEmail } from "./http.js";

// Who is staff. Staff sign in like everyone else (email code or Google).
// Admins have isAdmin; other staff have portal roles (User.staffRoles).
//  - STAFF_EMAILS in the server's .env (comma-separated): the first admins,
//    who can't be added from the site because nobody is an admin yet.
//  - admin.alibe.online > Staff and roles: an admin adds an email as admin
//    and/or with roles. If that account exists it applies at once; otherwise
//    on its first sign-in.
export const STAFF_INVITES_KEY = "staffInvites";

export const envStaffEmails = () =>
  (process.env.STAFF_EMAILS ?? "")
    .split(/[,\s]+/)
    .map(normalizeEmail)
    .filter((e) => e.includes("@"));

// An invite: what this email gets on its first sign-in. Older invites were
// plain email strings, which meant "admin".
export type StaffInvite = { email: string; admin: boolean; roles: StaffRole[] };

export async function staffInvites(): Promise<StaffInvite[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: STAFF_INVITES_KEY } });
  try {
    const list = JSON.parse(row?.value ?? "[]");
    if (!Array.isArray(list)) return [];
    return list.flatMap((i): StaffInvite[] =>
      typeof i === "string"
        ? [{ email: i, admin: true, roles: [] }]
        : i && typeof i.email === "string"
          ? [{ email: i.email, admin: !!i.admin, roles: Array.isArray(i.roles) ? i.roles.filter((r: string) => (PORTAL_ROLES as string[]).includes(r)) : [] }]
          : []
    );
  } catch {
    return [];
  }
}

export async function saveStaffInvites(list: StaffInvite[]) {
  const byEmail = new Map(list.map((i) => [i.email, i]));
  const value = JSON.stringify([...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email)));
  await prisma.appSetting.upsert({ where: { key: STAFF_INVITES_KEY }, update: { value }, create: { key: STAFF_INVITES_KEY, value } });
}

// Called on every sign-in: STAFF_EMAILS become admins, and invites apply.
export async function promoteIfStaff<T extends Prisma.UserGetPayload<object>>(user: T): Promise<T> {
  if (!user.email || user.bannedAt) return user;
  const email = normalizeEmail(user.email);
  if (envStaffEmails().includes(email) && !user.isAdmin) {
    user = (await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } })) as T;
  }
  const invites = await staffInvites();
  const invite = invites.find((i) => i.email === email);
  if (!invite) return user;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isAdmin: user.isAdmin || invite.admin, staffRoles: [...new Set([...user.staffRoles, ...invite.roles])] },
  });
  await saveStaffInvites(invites.filter((i) => i.email !== email));
  return updated as T;
}
