import crypto from "node:crypto";
import { prisma } from "./db.js";

// Card payments through BML Connect (Bank of Maldives' merchant API).
//
// Three modes:
//   live       BML_API_KEY is set: real BML transactions. NOT TESTED against
//              BML yet (written from its public docs); try BML_MODE=sandbox
//              first. Lines most likely to need adjusting are marked "CHECK".
//   simulated  an admin switched on test mode (Admin > Payments, 24 hours at a
//              time): the whole flow runs, but BML's payment page is replaced
//              by Alibe's own test checkout (/pay/bml/:id) and no money moves.
//              Purchases paid this way are marked as test payments.
//   off        neither: buyers only see bank transfer.
//
// Settings (the server's .env) for live mode:
//   BML_API_KEY   from BML's merchant portal
//   BML_APP_ID    the app id shown with the key (if your account has one)
//   BML_MODE      "sandbox" while testing with BML, "production" when live
//
// Either way, a purchase only starts once the server has asked for the
// transaction itself and it's CONFIRMED for the right amount; redirects and
// webhooks alone are never trusted.

export const SIM_PREFIX = "SIM-";
const SIM_SETTING = "bmlSimulation";
const simKey = (id: string) => `bmlsim:${id}`;

const hasKey = () => !!process.env.BML_API_KEY?.trim();
const liveMode = () => (process.env.BML_MODE === "sandbox" ? "sandbox" : "production");
// CHECK: base URLs.
const baseUrl = () => (liveMode() === "sandbox" ? "https://api.uat.merchants.bankofmaldives.com.mv/public" : "https://api.merchants.bankofmaldives.com.mv/public");

// Test mode is on until this moment (null: off).
export async function simulationUntil(): Promise<Date | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: SIM_SETTING } });
  const until = row ? new Date(row.value) : null;
  return until && until > new Date() ? until : null;
}
export async function setSimulation(on: boolean) {
  if (!on) return prisma.appSetting.deleteMany({ where: { key: SIM_SETTING } });
  const value = new Date(Date.now() + 24 * 3600_000).toISOString();
  return prisma.appSetting.upsert({ where: { key: SIM_SETTING }, update: { value }, create: { key: SIM_SETTING, value } });
}

export type CardMode = "live" | "simulated" | "off";
export async function cardMode(): Promise<CardMode> {
  if (hasKey()) return "live";
  return (await simulationUntil()) ? "simulated" : "off";
}
export async function bmlStatus() {
  const mode = await cardMode();
  return { enabled: mode !== "off", mode, liveMode: liveMode(), simulatedUntil: (await simulationUntil())?.toISOString() ?? null, tested: false };
}

export type BmlTransaction = { id: string; url?: string; state?: string; amount?: number; currency?: string; localId?: string };
type SimTransaction = BmlTransaction & { purchaseId: string; redirectUrl: string; createdAt: string };

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

export async function createBmlTransaction(p: { amountMvr: number; reference: string; redirectUrl: string; purchaseId: string; site: string }) {
  const amount = laari(p.amountMvr);
  const currency = "MVR";
  if ((await cardMode()) === "simulated") {
    // Test mode: our own checkout page stands in for BML's.
    const id = `${SIM_PREFIX}${crypto.randomBytes(8).toString("hex")}`;
    const tx: SimTransaction = { id, amount, currency, localId: p.reference, state: "INITIATED", purchaseId: p.purchaseId, redirectUrl: p.redirectUrl, createdAt: new Date().toISOString(), url: `${p.site}/pay/bml/${id}` };
    await prisma.appSetting.create({ data: { key: simKey(id), value: JSON.stringify(tx) } });
    return tx as BmlTransaction;
  }
  const apiKey = process.env.BML_API_KEY!.trim();
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

export async function getBmlTransaction(id: string): Promise<BmlTransaction> {
  if (id.startsWith(SIM_PREFIX)) {
    const tx = await getSimTransaction(id);
    if (!tx) throw new Error("No such test transaction");
    return tx;
  }
  return call<BmlTransaction>("GET", `/transactions/${encodeURIComponent(id)}`);
}

// ---- test checkout (simulated mode) ------------------------------------------

export async function getSimTransaction(id: string): Promise<SimTransaction | null> {
  if (!id.startsWith(SIM_PREFIX)) return null;
  const row = await prisma.appSetting.findUnique({ where: { key: simKey(id) } });
  return row ? (JSON.parse(row.value) as SimTransaction) : null;
}

// What the test checkout's Pay / Decline buttons do: like a cardholder
// finishing on BML's page. Only moves a transaction that's still open.
export async function finishSimTransaction(id: string, approve: boolean) {
  const tx = await getSimTransaction(id);
  if (!tx || tx.state !== "INITIATED") return tx;
  const next: SimTransaction = { ...tx, state: approve ? "CONFIRMED" : "CANCELLED" };
  await prisma.appSetting.update({ where: { key: simKey(id) }, data: { value: JSON.stringify(next) } });
  return next;
}

// Paid in full for this purchase? (State, amount and currency all have to match.)
export function bmlPaid(tx: BmlTransaction, p: { amountMvr: number; reference: string }) {
  return tx.state === "CONFIRMED" && tx.amount === laari(p.amountMvr) && (tx.currency ?? "MVR") === "MVR" && (!tx.localId || tx.localId === p.reference);
}
