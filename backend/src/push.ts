import { prisma } from "./db.js";

// Sends a push notification to every device the user is signed in on, via
// Expo's push service (free, no server key needed). Fire-and-forget: a
// failed push must never fail the request that triggered it.
export function notifyUser(userId: string, title: string, body: string, data: Record<string, string>) {
  void (async () => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushTokens: true } });
    const tokens = user?.pushTokens.filter((t) => t.startsWith("ExponentPushToken") || t.startsWith("ExpoPushToken")) ?? [];
    if (!tokens.length) return;
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(tokens.map((to) => ({ to, title, body, data, sound: "default", channelId: "messages" }))),
    });
    const json: any = await res.json().catch(() => null);
    // Drop tokens Expo says are dead (app uninstalled, signed out elsewhere).
    const dead = (json?.data ?? [])
      .map((r: any, i: number) => (r?.details?.error === "DeviceNotRegistered" ? tokens[i] : null))
      .filter(Boolean);
    if (dead.length) {
      await prisma.user.update({ where: { id: userId }, data: { pushTokens: { set: tokens.filter((t) => !dead.includes(t)) } } });
    }
  })().catch((e) => console.error("[push]", e));
}
