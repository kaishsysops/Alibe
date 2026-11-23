import { prisma } from "./db.js";

export const MONEY_KEY = "moneySettings";
type Plan = "3" | "7" | "30";

export type MoneySettings = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  feePercent: number;
  feeMinimum: number;
  boostPrices: Record<Plan, number>;
  adPrices: Record<Plan, number>;
  // Seller plans (MVR). Premium is on top of Store for stores.
  sellerPlans: { storeMonthly: number; storeYearly: number; premiumMonthly: number; premiumYearly: number };
  // Free 7-day boosts a Premium seller gets each month.
  premiumFreeBoosts: number;
};

// Starting prices until staff set their own. No bank details by default: without
// them Alibe doesn't take payments at all.
const DEFAULTS: MoneySettings = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  feePercent: 15,
  feeMinimum: 0,
  boostPrices: { "3": 50, "7": 100, "30": 300 },
  adPrices: { "3": 150, "7": 300, "30": 1000 },
  sellerPlans: { storeMonthly: 500, storeYearly: 5000, premiumMonthly: 300, premiumYearly: 3000 },
  premiumFreeBoosts: 4,
};

export async function moneySettings(): Promise<MoneySettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: MONEY_KEY } });
  if (!row) return DEFAULTS;
  const saved = JSON.parse(row.value);
  return { ...DEFAULTS, ...saved, sellerPlans: { ...DEFAULTS.sellerPlans, ...(saved.sellerPlans ?? {}) } };
}

export const isReady = (m: MoneySettings) => !!(m.bankName && m.accountName && m.accountNumber);

// What a buyer pays Alibe for an iBay item, service included. This is Alibe's own
// selling price, so customers only ever see this figure, labelled as Alibe's; the
// seller's price and the margin stay on staff screens.
export const alibePrice = (m: MoneySettings, sellerPrice: number) => sellerPrice + Math.max(m.feeMinimum, Math.round((sellerPrice * m.feePercent) / 100));

// Turns filter amounts (in Alibe prices) into seller prices for the database.
export const sellerPriceBound = (m: MoneySettings, amount: number, round: (n: number) => number) => round(amount / (1 + m.feePercent / 100));
