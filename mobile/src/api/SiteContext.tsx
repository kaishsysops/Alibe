import React, { createContext, useContext, useEffect, useState } from "react";
import { api, PromoKind, SiteNow } from "./client";

// What admins are running right now (banners, events, discounts, the seasonal
// look), loaded once and refreshed every few minutes.
const EMPTY: SiteNow = { banners: [], events: [], discounts: [], season: null };
const SiteContext = createContext<SiteNow>(EMPTY);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState<SiteNow>(EMPTY);
  useEffect(() => {
    const load = () => api.siteNow().then(setNow).catch(() => {});
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, []);
  return <SiteContext.Provider value={now}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);

// The best discount running for this kind of purchase, if any. The server
// applies the same one when the purchase is made.
export function useDiscount(kind: PromoKind) {
  const { discounts } = useSite();
  return discounts.filter((d) => d.appliesTo.includes(kind)).sort((a, b) => b.percent - a.percent)[0] ?? null;
}
export const discounted = (amount: number, percent?: number) => (percent ? Math.max(0, Math.round(amount * (1 - percent / 100))) : amount);
