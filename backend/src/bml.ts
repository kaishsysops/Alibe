import crypto from "node:crypto";

// Card payments through BML Connect (Bank of Maldives' merchant API).
//
// NOT TESTED: written from BML's public documentation without a merchant API
// key, so it has never talked to BML. It stays switched off until
// BML_API_KEY is set, and should be tried with BML_MODE=sandbox first. The
// parts most likely to need adjusting once you have BML's current docs and
// a sandbox key are marked "CHECK".
//
// Settings (the server's .env):
//   BML_API_KEY   from BML's merchant portal (required to switch this on)
//   BML_APP_ID    the app id shown with the key (if your account has one)
//   BML_MODE      "sandbox" while testing, "production" when live
//
// How it fits in: a purchase waiting for payment gets a BML transaction for
// its amount, tagged with its AL- reference; the buyer pays on BML's own
// page and comes back to /purchases. We never trust the redirect or a webhook
// on its own: the server asks BML for the transaction and only a CONFIRMED
// one for the right amount starts the purchase.

const mode = () => (process.env.BML_MODE === "sandbox" ? "sandbox" : "production");
// CHECK: base URLs.
const baseUrl = () => (mode() === "sandbox" ? "https://api.uat.merchants.bankofmaldives.com.mv/public" : "https://api.merchants.bankofmaldives.com.mv/public");

export const bmlEnabled = () => !!process.env.BML_API_KEY?.trim();
export const bmlStatus = () => ({ enabled: bmlEnabled(), mode: mode(), tested: false });

export type BmlTransaction = { id: string; url?: string; state?: string; amount?: number; currency?: string; localId?: string };

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    // CHECK: BML Connect takes the API key as-is in Authorization.
    headers: { Authorization: process.env.BML_API_KEY!.trim(), "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`BML ${method} ${path} failed (${res.status}): ${JSON.stringify(json)?.slice(0, 300)}`);
  return json as T;
}

// Amounts go to BML in laari (MVR x 100).
const laari = (mvr: number) => Math.round(mvr * 100);

export async function createBmlTransaction(p: { amountMvr: number; reference: string; redirectUrl: string }) {
  const apiKey = process.env.BML_API_KEY!.trim();
  const amount = laari(p.amountMvr);
  const currency = "MVR";
  // CHECK: API v2.0 signs "amount=..&currency=..&apiKey=.." with SHA-1.
  const signature = crypto.createHash("sha1").update(`amount=${amount}&currency=${currency}&apiKey=${apiKey}`).digest("hex");
  return call<BmlTransaction>("POST", "/transactions", {
    amount,
    currency,
    localId: p.reference,
    customerReference: p.reference,
    redirectUrl: p.redirectUrl,
    signMethod: "sha1",
    signature,
    apiVersion: "2.0",
    appVersion: "alibe-1.0",
    ...(process.env.BML_APP_ID ? { deviceId: process.env.BML_APP_ID.trim() } : {}),
  });
}

export const getBmlTransaction = (id: string) => call<BmlTransaction>("GET", `/transactions/${encodeURIComponent(id)}`);

// Paid in full for this purchase? (State, amount and currency all have to match.)
export function bmlPaid(tx: BmlTransaction, p: { amountMvr: number; reference: string }) {
  return tx.state === "CONFIRMED" && tx.amount === laari(p.amountMvr) && (tx.currency ?? "MVR") === "MVR" && (!tx.localId || tx.localId === p.reference);
}
