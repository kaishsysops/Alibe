// Tiny in-process cache for data that's read constantly and changes rarely
// (categories, the Home feed, boosted listings). Each backend replica keeps its
// own copy, so a change can take up to `ttlMs` to show everywhere.
// Concurrent misses share one load, so a traffic spike never stampedes the
// database with the same query.
type Entry = { value: unknown; expiresAt: number };
const entries = new Map<string, Entry>();
const loading = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const pending = loading.get(key);
  if (pending) return pending as Promise<T>;
  const p = load()
    .then((value) => {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => loading.delete(key));
  loading.set(key, p);
  return p;
}

// Drops entries whose key starts with `prefix` (on this replica), e.g. after
// staff change a setting, so the person who changed it sees it at once.
export function invalidate(prefix: string) {
  for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, e] of entries) if (e.expiresAt <= now) entries.delete(key);
}, 60_000).unref();
