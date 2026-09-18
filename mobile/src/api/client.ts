// In the Docker/Expo Go setup, Metro injects the host machine's LAN IP via
// EXPO_PUBLIC_API_BASE_URL (see docker-compose.yml -> mobile.environment).
// Falls back to localhost for the web/simulator case.
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:4000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export type Category = { id: string; name: string; slug: string; icon: string | null };
export type Island = { id: string; name: string; atollId: string };
export type Atoll = { id: string; name: string; code: string; islands: Island[] };
export type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: "NEW" | "LIKE_NEW" | "GOOD" | "FAIR";
  status: "ACTIVE" | "SOLD" | "DRAFT";
  images: string[];
  category: Category;
  island: Island & { atoll?: Atoll };
  seller: { id: string; name: string; phone: string };
  createdAt: string;
};
export type User = { id: string; phone: string; name: string; createdAt?: string };

export const api = {
  health: () => request<{ ok: boolean }>("/health"),
  categories: () => request<Category[]>("/categories"),
  atolls: () => request<Atoll[]>("/atolls"),
  listings: (params: Record<string, string | undefined> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString();
    return request<Listing[]>(`/listings${qs ? `?${qs}` : ""}`);
  },
  listing: (id: string) => request<Listing>(`/listings/${id}`),
  myListings: (sellerId: string) => request<Listing[]>(`/listings/mine/${sellerId}`),
  createListing: (data: {
    title: string;
    description: string;
    price: number;
    condition: Listing["condition"];
    categoryId: string;
    islandId: string;
    sellerId: string;
    images: string[];
  }) => request<Listing>("/listings", { method: "POST", body: JSON.stringify(data) }),
  requestOtp: (phone: string) => request<{ sent: boolean }>("/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, code: string) =>
    request<{ token: string; user: User }>("/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone, code }) }),
};
