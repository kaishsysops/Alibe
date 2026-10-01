import AsyncStorage from "@react-native-async-storage/async-storage";
import { Listing } from "../api/client";
import { DRAFT_PREFIX } from "../api/AuthContext";

const MAX = 20;
// Stored under the draft prefix so it's wiped on sign-out with other per-user data.
const keyFor = (userId: string) => `${DRAFT_PREFIX}recent.${userId}`;

export async function getRecentlyViewed(userId: string): Promise<Listing[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addRecentlyViewed(userId: string, listing: Listing) {
  const list = await getRecentlyViewed(userId);
  const next = [listing, ...list.filter((l) => l.id !== listing.id)].slice(0, MAX);
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next)).catch(() => {});
}

export async function clearRecentlyViewed(userId: string) {
  await AsyncStorage.removeItem(keyFor(userId)).catch(() => {});
}
