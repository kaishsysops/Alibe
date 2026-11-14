import { cached } from "./cache.js";

// Cloudflare Workers AI (free tier: 10,000 "neurons" a day; one call here costs
// roughly 5-20). Optional: with CF_ACCOUNT_ID and CF_AI_TOKEN unset, or if
// Cloudflare is slow or down, callers fall back to keyword matching and nothing
// breaks. Get both from dash.cloudflare.com: the Account ID is on the account
// home page; the token from My Profile > API Tokens > "Workers AI" template.

const MODEL = process.env.CF_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct-fast";
const TIMEOUT_MS = 7000;

export const aiEnabled = () => !!process.env.CF_ACCOUNT_ID && !!process.env.CF_AI_TOKEN;

// After a failure, stop calling for a minute instead of slowing every request.
let pausedUntil = 0;

async function runModel(system: string, user: string): Promise<unknown | null> {
  if (!aiEnabled() || Date.now() < pausedUntil) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${MODEL}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CF_AI_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 300,
        temperature: 0,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[ai] Cloudflare answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
      pausedUntil = Date.now() + 60_000;
      return null;
    }
    const body = (await res.json()) as { result?: { response?: unknown } };
    const out = body.result?.response;
    if (out && typeof out === "object") return out;
    if (typeof out !== "string") return null;
    const json = out.match(/\{[\s\S]*\}/)?.[0];
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.warn(`[ai] ${(e as Error).name === "AbortError" ? "timed out" : (e as Error).message}`);
    pausedUntil = Date.now() + 60_000;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const DAY = 24 * 60 * 60_000;
const key = (...parts: string[]) => parts.map((p) => p.toLowerCase().trim().slice(0, 400)).join("|");

// Which category an item belongs to, from the list of category paths given.
export async function aiPickCategory(title: string, description: string, paths: Array<{ slug: string; path: string }>): Promise<string | null> {
  if (!aiEnabled()) return null;
  return cached(`ai:cat:${key(title, description)}`, DAY, async () => {
    const list = paths.map((p) => `${p.slug}: ${p.path}`).join("\n");
    const out = (await runModel(
      `You sort listings on a Maldives marketplace into categories. Reply with JSON {"slug": "<slug>"} using one slug from this list, the most specific one that fits. If nothing fits, use "other".\n\n${list}`,
      `Title: ${title}\nDescription: ${description.slice(0, 500) || "(none)"}`
    )) as { slug?: unknown } | null;
    const slug = typeof out?.slug === "string" ? out.slug.trim() : null;
    return slug && paths.some((p) => p.slug === slug) ? slug : null;
  });
}

// Reads category details (brand, year, size...) out of a title and description.
export async function aiExtractAttributes(
  title: string,
  description: string,
  defs: Array<{ key: string; label: string; type: string; options?: string[]; unit?: string }>
): Promise<Record<string, unknown> | null> {
  if (!aiEnabled() || !defs.length) return null;
  return cached(`ai:attrs:${key(title, description, defs.map((d) => d.key).join(","))}`, DAY, async () => {
    const fields = defs.map((d) => `- ${d.key} (${d.label}): ${d.type === "select" ? `one of ${JSON.stringify(d.options)}` : `a number${d.unit ? ` in ${d.unit}` : ""}`}`).join("\n");
    const out = await runModel(
      `Extract details from a marketplace listing. Reply with JSON using only these keys, and leave a key out if the listing doesn't say:\n${fields}`,
      `Title: ${title}\nDescription: ${description.slice(0, 800) || "(none)"}`
    );
    return out && typeof out === "object" ? (out as Record<string, unknown>) : null;
  });
}

export type QueryUnderstanding = { keywords?: string; categorySlug?: string; atoll?: string; minPrice?: number; maxPrice?: number; condition?: string };

// Turns "cheap iphone in addu under 5000" into filters.
export async function aiUnderstandQuery(q: string, categories: Array<{ slug: string; path: string }>, atolls: string[]): Promise<QueryUnderstanding | null> {
  if (!aiEnabled()) return null;
  return cached(`ai:q:${key(q)}`, DAY, async () => {
    const out = (await runModel(
      `You turn a shopper's search on a Maldives marketplace (prices in MVR, "k" = thousand) into filters. Reply with JSON with any of these keys:
- keywords: the product words to search for (no prices, places or filler)
- categorySlug: one slug from the category list, only if the search clearly names that kind of item
- atoll: one name from the atoll list, if a place is named (islands belong to their atoll, Male is Kaafu)
- minPrice, maxPrice: numbers in MVR
- condition: one of NEW, LIKE_NEW, GOOD, FAIR, only if asked for
Categories:
${categories.map((c) => `${c.slug}: ${c.path}`).join("\n")}
Atolls: ${atolls.join(", ")}`,
      q
    )) as QueryUnderstanding | null;
    return out && typeof out === "object" ? out : null;
  });
}
