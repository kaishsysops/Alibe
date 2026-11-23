import { Platform } from "react-native";

// One app, three sites, decided by the address it was opened on:
//   alibe.online (and www, beta)  the marketplace
//   admin.alibe.online            admins: everything
//   portal.alibe.online           staff with portal roles: their queues
// On a dev machine, add ?site=admin or ?site=portal to the URL (remembered
// for the tab) to try the other two.
export type Site = "main" | "admin" | "portal";

function detect(): Site {
  if (Platform.OS !== "web" || typeof window === "undefined") return "main";
  const host = window.location.hostname;
  if (host.startsWith("admin.")) return "admin";
  if (host.startsWith("portal.")) return "portal";
  const forced = new URLSearchParams(window.location.search).get("site") ?? window.sessionStorage?.getItem("alibe-site");
  if (forced === "admin" || forced === "portal") {
    window.sessionStorage?.setItem("alibe-site", forced);
    return forced;
  }
  return "main";
}

export const SITE: Site = detect();

// The marketplace's own domain (alibe.online), from whichever site we're on.
export function rootDomain() {
  if (Platform.OS !== "web" || typeof window === "undefined") return "alibe.online";
  const host = window.location.hostname;
  if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  return host.split(".").slice(-2).join(".");
}

// Links between the sites (null on a dev machine, where ?site= is used).
export function siteUrl(site: Site) {
  const root = rootDomain();
  if (!root) return null;
  return `https://${site === "main" ? root : `${site}.${root}`}`;
}

// From the admin/portal sites, marketplace pages (a seller, a listing, an
// order) open in a new tab on the marketplace.
export function openOnMarketplace(path: string) {
  if (typeof window === "undefined") return;
  const base = siteUrl("main") ?? `${window.location.origin}`;
  window.open(`${base}/${path.replace(/^\//, "")}`, "_blank", "noopener");
}

// A one-time staff sign-in link, on the site it's for.
export function staffInviteUrl(site: "admin" | "portal", token: string) {
  const base = siteUrl(site);
  if (base) return `${base}/?invite=${token}`;
  // Dev machine: same address, with the site picked by ?site=.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/?site=${site}&invite=${token}`;
}

// The invite token in this page's address, if any (read once, then removed
// from the address bar so it isn't left in history or shared by accident).
export function takeInviteToken(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("invite");
  if (!token) return null;
  params.delete("invite");
  const rest = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
  return token;
}
