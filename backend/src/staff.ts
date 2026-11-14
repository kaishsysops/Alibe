import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { normalizeEmail } from "./http.js";

// Who is staff. Staff sign in like everyone else (email code); being staff is
// just the isAdmin flag on their account. Two ways to get it:
//  - STAFF_EMAILS in the server's .env (comma-separated): for the first staff
//    account, which can't be added from the app because nobody is staff yet.
//  - Profile > Staff in the app: an existing staff member adds an email. If that
//    account exists it becomes staff at once; otherwise on its first sign-in.
export const STAFF_INVITES_KEY = "staffInvites";

export const envStaffEmails = () =>
  (process.env.STAFF_EMAILS ?? "")
    .split(/[,\s]+/)
    .map(normalizeEmail)
    .filter((e) => e.includes("@"));

export async function staffInvites(): Promise<string[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: STAFF_INVITES_KEY } });
  try {
    const list = JSON.parse(row?.value ?? "[]");
    return Array.isArray(list) ? list.filter((e): e is string => typeof e === "string") : [];
  } catch {
    return [];
  }
}

export async function saveStaffInvites(list: string[]) {
  const value = JSON.stringify([...new Set(list)].sort());
  await prisma.appSetting.upsert({ where: { key: STAFF_INVITES_KEY }, update: { value }, create: { key: STAFF_INVITES_KEY, value } });
}

// Called on every sign-in: turns on staff access for listed or invited emails.
export async function promoteIfStaff<T extends Prisma.UserGetPayload<object>>(user: T): Promise<T> {
  if (user.isAdmin || !user.email || user.bannedAt) return user;
  const email = normalizeEmail(user.email);
  const invites = await staffInvites();
  if (!envStaffEmails().includes(email) && !invites.includes(email)) return user;
  const updated = await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  if (invites.includes(email)) await saveStaffInvites(invites.filter((e) => e !== email));
  return updated as T;
}
