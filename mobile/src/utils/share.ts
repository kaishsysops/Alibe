import { Platform, Share } from "react-native";
import { Listing } from "../api/client";

// Public web address of the app, used in share links. Set
// EXPO_PUBLIC_WEB_URL once it's hosted. Locally the web build is served by
// the same machine as the API (Metro on :8081), so derive it from that.
function webBase() {
  if (process.env.EXPO_PUBLIC_WEB_URL) return process.env.EXPO_PUBLIC_WEB_URL.replace(/\/$/, "");
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  const api = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:4000";
  return api.replace(/:4000\/?$/, ":8081");
}

export function listingUrl(id: string) {
  return `${webBase()}/listing/${id}`;
}

// Returns "shared" | "copied" | "dismissed" so the caller can show the right toast.
export async function shareListing(listing: Listing): Promise<"shared" | "copied" | "dismissed"> {
  const url = listingUrl(listing.id);
  const message = `${listing.title} for MVR ${listing.price.toLocaleString()} on Alibe`;
  if (Platform.OS === "web") {
    const nav: any = typeof navigator !== "undefined" ? navigator : null;
    if (nav?.share) {
      try {
        await nav.share({ title: listing.title, text: message, url });
        return "shared";
      } catch {
        return "dismissed";
      }
    }
    await nav?.clipboard?.writeText(url);
    return "copied";
  }
  const result = await Share.share(Platform.OS === "ios" ? { message, url } : { message: `${message}\n${url}` });
  return result.action === Share.dismissedAction ? "dismissed" : "shared";
}
