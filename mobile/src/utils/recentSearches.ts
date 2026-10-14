import AsyncStorage from "@react-native-async-storage/async-storage";
import { DRAFT_PREFIX } from "../api/AuthContext";

const MAX = 8;
// Under the draft prefix so sign-out wipes it with other per-user data.
const keyFor = (userId: string) => `${DRAFT_PREFIX}recentSearches.${userId}`;

export async function getRecentSearches(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Most recent first, no duplicates (case-insensitive).
export async function addRecentSearch(userId: string, query: string) {
  const q = query.trim();
  if (q.length < 2) return getRecentSearches(userId);
  const list = await getRecentSearches(userId);
  const next = [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX);
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next)).catch(() => {});
  return next;
}

export async function clearRecentSearches(userId: string) {
  await AsyncStorage.removeItem(keyFor(userId)).catch(() => {});
}
