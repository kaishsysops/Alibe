// In the Docker/Expo Go setup, Metro injects the host machine's LAN IP via
// EXPO_PUBLIC_API_BASE_URL (see docker-compose.yml -> mobile.environment).
// Falls back to localhost for the web/simulator case.
import { Platform } from "react-native";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:4000";

// Every failed request surfaces as an ApiError whose `message` is already a
// sentence that's safe to show a user — never a status code or JSON blob.
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// While a deploy restarts the backend, the web server answers 503 with
// code MAINTENANCE. MaintenanceOverlay listens and covers the app until
// /health answers again.
type MaintenanceListener = () => void;
const maintenanceListeners = new Set<MaintenanceListener>();
export function onMaintenance(listener: MaintenanceListener) {
  maintenanceListeners.add(listener);
  return () => {
    maintenanceListeners.delete(listener);
  };
}
export async function apiIsUp() {
  try {
    return (await fetch(`${BASE_URL}/health`, { cache: "no-store" })).ok;
  } catch {
    return false;
  }
}

// For the status page: the server's own report plus how long the round trip
// took. Never throws: "can't reach" and "updating" are answers too.
export type SystemStatus = {
  reachable: boolean;
  updating?: boolean;
  roundTripMs?: number;
  ok?: boolean;
  version?: string;
  startedAt?: string;
  uptimeSeconds?: number;
  replica?: string;
  database?: { ok: boolean; latencyMs: number | null };
  signInEmail?: { ok: boolean };
};
export async function fetchSystemStatus(): Promise<SystemStatus> {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/status`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    const roundTripMs = Date.now() - started;
    if (body?.code === "MAINTENANCE") return { reachable: true, updating: true, roundTripMs };
    return { reachable: true, roundTripMs, ...body };
  } catch {
    return { reachable: false };
  }
}

const OFFLINE_MESSAGE = "Can't reach Alibe right now. Check your connection and try again.";

function fallbackMessage(status: number) {
  if (status === 404) return "We couldn't find that. It may have been removed.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return "Something went wrong. Please try again.";
}

// Session token from sign-in, sent on every request. AuthContext owns it.
let authToken: string | null = null;
let onSignedOut: (() => void) | null = null;
// Last push token this device registered, so sign-out can unregister it.
let devicePushToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}
export function setSignedOutHandler(handler: (() => void) | null) {
  onSignedOut = handler;
}

function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

// Sends a request and turns any failure into an ApiError; returns the raw
// response so callers can read headers (paging) as well as the body.
async function send(path: string, options?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...authHeaders(), ...(options?.headers as Record<string, string>) },
    });
  } catch {
    throw new ApiError(0, OFFLINE_MESSAGE);
  }
  if (!res.ok) {
    let message = fallbackMessage(res.status);
    try {
      const body = await res.json();
      if (typeof body?.error === "string") message = body.error;
      if (res.status === 503 && body?.code === "MAINTENANCE") maintenanceListeners.forEach((l) => l());
      // The session expired or was revoked: drop back to the sign-in screen.
      if (res.status === 401 && body?.code === "SIGNED_OUT" && authToken) onSignedOut?.();
    } catch {
      // non-JSON error body — keep the generic sentence
    }
    throw new ApiError(res.status, message);
  }
  return res;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await send(path, options);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type Page<T> = { items: T[]; hasMore: boolean };

// Lists the server sends a page at a time (X-Has-More says if there's more).
async function requestPage<T>(path: string): Promise<Page<T>> {
  const res = await send(path);
  return { items: (await res.json()) as T[], hasMore: res.headers.get("X-Has-More") === "1" };
}

const query = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();

// Uploaded files come back as server-relative paths (/uploads/…); resolve
// them against whichever API host this device talks to.
export function mediaUrl(uri: string | null | undefined) {
  if (!uri) return undefined;
  return uri.startsWith("/uploads/") || uri.startsWith("/slips/") ? `${BASE_URL}${uri}` : uri;
}

export type UploadedMedia = { url: string; type: "IMAGE" | "VIDEO"; size: number };

// Uploads one local photo/video (picker URI) and returns its server path.
export async function uploadMedia(localUri: string, mimeType: string, onProgress?: (fraction: number) => void): Promise<UploadedMedia> {
  const ext = mimeType.split("/")[1]?.replace("quicktime", "mov").replace("jpeg", "jpg") ?? "bin";
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(localUri)).blob();
    form.append("file", new File([blob], `upload.${ext}`, { type: mimeType }));
  } else {
    form.append("file", { uri: localUri, name: `upload.${ext}`, type: mimeType } as any);
  }
  // XHR rather than fetch so we can report upload progress.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/uploads`);
    if (authToken) xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && body?.url) resolve(body);
      else reject(new ApiError(xhr.status, typeof body?.error === "string" ? body.error : "That upload didn't work. Please try again."));
    };
    xhr.onerror = () => reject(new ApiError(0, OFFLINE_MESSAGE));
    xhr.send(form);
  });
}

export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again.") {
  return e instanceof ApiError ? e.message : fallback;
}

// Short random id used as an idempotency key, so a retried or double-tapped
// request is recognised by the backend instead of creating a duplicate.
export function newClientId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// A question a category asks (Sell) and filters by (Search). Children inherit them.
export type AttributeDef = { key: string; label: string; type: "select" | "number"; options?: string[]; unit?: string };
export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  // The tree: any depth. Siblings are shown in sortOrder.
  parentId?: string | null;
  sortOrder?: number;
  keywords?: string[];
  attributes?: AttributeDef[] | null;
  // Everything for sale in this category and all its subcategories.
  listingCount?: number;
  photo?: string | null;
};
export type AdminCategory = Category & { hidden: boolean; ownCount: number };
export type CategorySuggestion = { slug: string; id: string; path: Array<{ slug: string; name: string }>; leaf: boolean; attributes: ListingAttributes };
export type ListingAttributes = Record<string, string | number>;
// {"brand":["Apple"],"year":{"min":2015}}
export type AttrFilters = Record<string, string[] | { min?: number; max?: number }>;
export type SearchUnderstanding = {
  filters: { q?: string; categorySlug?: string; atollId?: string; minPrice?: number; maxPrice?: number; condition?: Listing["condition"] } | null;
  categoryPath: string[] | null;
  atollName: string | null;
  source: "ai" | "rules";
};
export type HomeFeed = { latest: Listing[]; rails: Array<{ category: Category; items: Listing[] }> };
export type Island = { id: string; name: string; atollId: string };
export type Atoll = { id: string; name: string; code: string; islands: Island[] };
export type SellerRating = { average: number; count: number };
export type DeliveryOption = "PICKUP" | "FERRY" | "COURIER";
export type PublicSeller = {
  id: string;
  name: string;
  verified?: boolean;
  rating?: SellerRating;
  username?: string | null;
  avatarColor?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
  // Each contact channel is null unless the seller has switched it on.
  phone: string | null;
  whatsapp: string | null;
  viber: string | null;
};
export type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: "NEW" | "LIKE_NEW" | "GOOD" | "FAIR";
  status: "ACTIVE" | "RESERVED" | "SOLD" | "DRAFT";
  images: string[];
  deliveryOptions: DeliveryOption[];
  deliveryNote: string | null;
  category: Category;
  island: Island & { atoll?: Atoll };
  seller: PublicSeller;
  createdAt: string;
  // Set after a real price drop: shown as "was MVR X".
  previousPrice?: number | null;
  hiddenAt?: string | null;
  // Set on items from iBay mixed into a feed. These open the iBay item page.
  ibayItemId?: string;
  // Paid placement, always shown to buyers as "Featured".
  boosted?: boolean;
  // Answers to the category's questions (brand, year, bedrooms...).
  attributes?: ListingAttributes;
};
export type PaymentMethod = "CASH" | "BANK_TRANSFER";
export type User = {
  id: string;
  // Sign-in methods. An account always has at least one of them.
  phone: string | null;
  email?: string | null;
  name: string;
  createdAt?: string;
  username?: string | null;
  avatarColor?: string | null;
  avatarUrl?: string | null;
  // The island they said they live on (onboarding / profile).
  islandId?: string | null;
  // Category slugs they follow; those rows come first on Home.
  interests?: string[];
  themeColor?: string | null;
  showPhone?: boolean;
  whatsappEnabled?: boolean;
  whatsappNumber?: string | null;
  viberEnabled?: boolean;
  viberNumber?: string | null;
  verificationStatus?: "NONE" | "VERIFIED";
  isAdmin?: boolean;
};
export type FullUser = Required<Omit<User, "createdAt">> & {
  createdAt: string;
  bio: string | null;
  islandId: string | null;
  island: (Island & { atoll: Atoll }) | null;
  paymentMethod: PaymentMethod | null;
  promoOptIn: boolean;
};
export type PublicUser = PublicSeller & { bio: string | null; createdAt: string; activeListingsCount: number; rating: SellerRating; deliveredCount: number };
export type AdminSeller = {
  id: string;
  name: string;
  username: string | null;
  phone: string | null;
  email: string | null;
  avatarColor: string | null;
  avatarUrl: string | null;
  verified: boolean;
  isAdmin: boolean;
  createdAt: string;
  bannedAt: string | null;
  totalListings: number;
  activeListings: number;
  openReports: number;
  rating: SellerRating;
};
export type SellerSearchResult = PublicSeller & { createdAt: string; activeListingsCount: number; rating: SellerRating };
export type TrustLevel = "CAUTION" | "NEW" | "MEMBER" | "ESTABLISHED" | "TRUSTED";
export type TrustSummary = {
  level: TrustLevel;
  delivered: number;
  rating: { average: number; count: number };
  memberDays: number;
  replyMinutes: number | null;
  reporters: number;
  cancelledByThem: number;
};
export type MessageFlag = "PAY_FIRST" | "GIFT_CARD_CRYPTO" | "LINK" | "BANK_DETAILS" | "HANDOVER_CODE";
export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  clientId?: string | null;
  offerId?: string | null;
  mediaUrl?: string | null;
  mediaType?: "IMAGE" | "VIDEO" | null;
  flag?: MessageFlag | null;
};
export type OfferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "COUNTERED" | "WITHDRAWN";
export type Offer = { id: string; conversationId: string; listingId: string; fromId: string; amount: number; status: OfferStatus; createdAt: string };
export type OrderStatus = "AWAITING_DISPATCH" | "DISPATCHED" | "DELIVERED" | "DISPUTED" | "CANCELLED";
export type Order = {
  id: string;
  listingId: string;
  conversationId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  status: OrderStatus;
  deliveryMethod: DeliveryOption | null;
  boatName: string | null;
  boatDeparture: string | null;
  cargoReference: string | null;
  courierName: string | null;
  pickupNote: string | null;
  // Only ever sent to the buyer.
  handoverCode: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  verifiedBy: "BUYER" | "HANDOVER_CODE" | null;
  codeAttempts: number;
  problem: string | null;
  createdAt: string;
  role: "BUYER" | "SELLER";
  listing: Listing;
  buyer: PublicSeller;
  seller: PublicSeller;
  paymentMethod: PaymentMethod | null;
  cargoReceiptUrl?: string | null;
  disputeOutcome?: "DELIVERED" | "CANCELLED" | null;
  disputeNote?: string | null;
};
export type DispatchDetails = { method: DeliveryOption; boatName?: string; boatDeparture?: string; cargoReference?: string; courierName?: string; pickupNote?: string; cargoReceiptUrl?: string };
export type DisputeEvidence = { id: string; text: string; photoUrl: string | null; createdAt: string; by: { id: string; name: string }; role: "BUYER" | "SELLER" | "STAFF" };
export type DisputeInfo = { status: OrderStatus; problem: string | null; outcome: "DELIVERED" | "CANCELLED" | null; note: string | null; resolvedAt: string | null; evidence: DisputeEvidence[] };
export type StaffMember = { id: string; name: string; email: string | null; username: string | null; avatarColor: string | null; avatarUrl: string | null; fixed: boolean };

export type AdminDispute = {
  id: string;
  amount: number;
  problem: string | null;
  updatedAt: string;
  deliveryMethod: DeliveryOption | null;
  cargoReceiptUrl: string | null;
  listing: { id: string; title: string; images: string[] };
  buyer: { id: string; name: string };
  seller: { id: string; name: string };
  evidenceCount: number;
};
export type VerificationProgress = { verificationStatus: "NONE" | "VERIFIED"; verifiedAt: string | null; delivered: number; required: number };
export type Thread = { messages: Message[]; offers: Offer[]; otherLastReadAt: string | null; blocked: boolean; order: { id: string; status: OrderStatus; amount: number } | null };
export type Review = {
  id: string;
  rating: number;
  text: string | null;
  createdAt: string;
  reviewer: PublicSeller;
  listing: { id: string; title: string };
};
export type ReportReason = "SCAM" | "PROHIBITED" | "WRONG_CATEGORY" | "OFFENSIVE" | "OTHER";
export type BlockedUser = { id: string; createdAt: string; user: PublicSeller };
export type ListingFilters = Partial<{
  q: string;
  categorySlug: string;
  atollId: string;
  condition: Listing["condition"];
  minPrice: string;
  maxPrice: string;
  delivery: DeliveryOption;
  islandId: string;
  attrs: AttrFilters;
}>;
export type SavedSearch = { id: string; label: string; params: ListingFilters; newCount: number; createdAt: string };
export type NotificationItem =
  | { type: "message"; id: string; messageId: string; conversationId: string; fromName: string; listingTitle: string; image: string | null; preview: string; count: number; createdAt: string }
  | { type: "offer"; id: string; offerId: string; conversationId: string; fromName: string; listingTitle: string; image: string | null; amount: number; createdAt: string }
  | { type: "order"; id: string; orderId: string; conversationId: string; role: "BUYER" | "SELLER"; status: OrderStatus; fromName: string; listingTitle: string; image: string | null; createdAt: string }
  | { type: "purchase"; id: string; purchaseId: string; label: string; amount: number; createdAt: string }
  | { type: "price_drop"; id: string; listingId: string; listingTitle: string; image: string | null; price: number; previousPrice: number; createdAt: string }
  | { type: "saved_search"; id: string; savedSearchId: string; label: string; params: ListingFilters; newCount: number; createdAt: string };
export type Notifications = { unreadChats: number; total: number; items: NotificationItem[] };
export type Conversation = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  buyer: PublicSeller;
  seller: PublicSeller;
  listing: Listing;
  messages: Message[];
  updatedAt: string;
  unreadCount?: number;
};
export type ProfileUpdate = Partial<{
  name: string;
  username: string | null;
  bio: string | null;
  avatarColor: string | null;
  avatarUrl: string | null;
  interests: string[];
  themeColor: string | null;
  islandId: string | null;
  paymentMethod: PaymentMethod | null;
  promoOptIn: boolean;
  showPhone: boolean;
  whatsappEnabled: boolean;
  whatsappNumber: string | null;
  viberEnabled: boolean;
  viberNumber: string | null;
}>;
export type PurchaseKind = "BOOST" | "AD" | "BUY_FOR_YOU";
export type PurchaseStatus = "REQUESTED" | "AWAITING_PAYMENT" | "SUBMITTED" | "ACTIVE" | "COMPLETED" | "REJECTED" | "CANCELLED";
export type Purchase = {
  id: string;
  kind: PurchaseKind;
  status: PurchaseStatus;
  amount: number;
  reference: string;
  slipUrl: string | null;
  note: string | null;
  days: number | null;
  endsAt: string | null;
  listingId: string | null;
  adTitle: string | null;
  adImage: string | null;
  adUrl: string | null;
  impressions: number;
  clicks: number;
  itemTitle: string | null;
  itemUrl: string | null;
  // Staff screens only.
  itemPrice?: number | null;
  deliveryNote: string | null;
  contactPhone: string | null;
  createdAt: string;
  user?: { id: string; name: string; phone: string | null; email: string | null };
};
export type PlanPrices = { "3": number; "7": number; "30": number };
export type MoneySettings = { bankName: string; accountName: string; accountNumber: string; feePercent: number; feeMinimum: number; boostPrices: PlanPrices; adPrices: PlanPrices };
export type MoneyConfig = Pick<MoneySettings, "boostPrices" | "adPrices"> & { ready: boolean };
export type BankDetails = Pick<MoneySettings, "bankName" | "accountName" | "accountNumber">;
export type RunningAd = { id: string; adTitle: string; adImage: string; adUrl: string | null; listingId: string | null };
export type NewPurchase =
  | { kind: "BOOST"; listingId: string; days: number }
  | { kind: "AD"; days: number; adTitle: string; adImage: string; listingId?: string; adUrl?: string }
  | { kind: "BUY_FOR_YOU"; ibayItemId: string; deliveryNote: string; contactPhone: string };
export type ReportAction = "DISMISS" | "REMOVE_LISTING" | "BAN";
export type ReportGroup = {
  key: string;
  listing: { id: string; title: string; images: string[]; price: number; hiddenAt: string | null } | null;
  user: { id: string; name: string; createdAt: string } | null;
  reports: { id: string; reason: ReportReason; details: string | null; createdAt: string }[];
};
export type IbayFilters = { q?: string; categorySlug?: string; condition?: Listing["condition"]; minPrice?: string; maxPrice?: string };
export type IbayItemSummary = { id: string; categorySlug: string | null; title: string; imageUrl: string | null; price: number | null; currency: string | null; condition: string | null; category: string };
export type IbayItemDetail = IbayItemSummary & {
  url: string;
  description: string | null;
  images: string[];
  lastUpdated: string | null;
  contact: { phone: string | null; whatsapp: string | null; viber: string | null };
  isMine: boolean;
  myPhoneMissing: boolean;
};
export type IbayItem = { id: string; title: string; url: string; imageUrl: string | null; price: number | null; currency: string | null; condition: string | null; category: string; firstSeenAt: string; hiddenAt: string | null };
// `devCode` only comes back in development, where nothing is really sent.
export type CodeRequest = { sent: boolean; retryIn: number; devCode?: string };
export type SignedIn = { token: string; user: User; needsName: boolean; linked?: "phone" | "email" };
// Verifying a code for a phone/email Alibe doesn't know yet returns a link
// token instead of an account: the person says if they're new or not.
export type NewContact = { newContact: true; linkToken: string };
export type VerifyResult = SignedIn | NewContact;
export type ListingSort = "newest" | "price_asc" | "price_desc";
export type ListingInput = {
  title: string;
  description: string;
  price: number;
  condition: Listing["condition"];
  categoryId: string;
  islandId: string;
  images: string[];
  deliveryOptions: DeliveryOption[];
  deliveryNote: string | null;
  attributes?: ListingAttributes;
};

export const api = {
  health: () => request<{ ok: boolean }>("/health"),
  categories: () => request<Category[]>("/categories"),
  suggestCategory: (title: string, description = "") =>
    request<{ suggestions: CategorySuggestion[]; source: "ai" | "keywords" | "none" }>("/categories/suggest", { method: "POST", body: JSON.stringify({ title, description }) }),
  understandSearch: (q: string) => request<SearchUnderstanding>(`/categories/understand?${query({ q })}`),
  adminCategories: () => request<AdminCategory[]>("/admin/categories"),
  addCategory: (name: string, parentId: string | null) => request<AdminCategory>("/admin/categories", { method: "POST", body: JSON.stringify({ name, parentId }) }),
  updateCategory: (id: string, data: Partial<{ name: string; keywords: string[]; hidden: boolean; parentId: string | null }>) =>
    request<AdminCategory>(`/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  moveCategory: (id: string, direction: "up" | "down") => request<void>(`/admin/categories/${id}/move`, { method: "POST", body: JSON.stringify({ direction }) }),
  deleteCategory: (id: string) => request<{ ok: boolean; movedTo: string | null }>(`/admin/categories/${id}`, { method: "DELETE" }),
  atolls: () => request<Atoll[]>("/atolls"),
  // One page of listings (40 by default). `page` counts from 0.
  listingsPage: (params: Record<string, string | undefined> = {}, page = 0, limit?: number) =>
    requestPage<Listing>(`/listings?${query({ ...params, page, limit })}`),
  // How many listings match (e.g. everything for sale in one atoll).
  countListings: async (params: Record<string, string | undefined>) => {
    const res = await send(`/listings?${query({ ...params, limit: 1, count: "1" })}`);
    return Number(res.headers.get("X-Total") ?? 0);
  },
  listingsByIds: (ids: string[]) => (ids.length ? request<Listing[]>(`/listings?${query({ ids: ids.join(",") })}`) : Promise.resolve([])),
  // Home's newest items and one row per category, built by the server.
  home: () => request<HomeFeed>("/listings/home"),
  listing: (id: string) => request<Listing>(`/listings/${id}`),
  myListings: (sellerId: string, status?: Listing["status"]) =>
    request<Listing[]>(`/listings/mine/${sellerId}${status ? `?status=${status}` : ""}`),
  createListing: (data: ListingInput & { sellerId: string; clientRequestId: string }) =>
    request<Listing>("/listings", { method: "POST", body: JSON.stringify(data) }),
  updateListing: (id: string, sellerId: string, data: Partial<ListingInput>) =>
    request<Listing>(`/listings/${id}`, { method: "PATCH", body: JSON.stringify({ ...data, sellerId }) }),
  updateListingStatus: (id: string, sellerId: string, status: Listing["status"]) =>
    request<Listing>(`/listings/${id}`, { method: "PATCH", body: JSON.stringify({ status, sellerId }) }),
  deleteListing: (id: string, sellerId: string) => request<void>(`/listings/${id}?sellerId=${encodeURIComponent(sellerId)}`, { method: "DELETE" }),
  requestOtp: (phone: string) => request<CodeRequest & { staffEntry?: boolean }>("/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, code: string, themeColor?: string, linkToken?: string) =>
    request<VerifyResult>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code, themeColor, linkToken }),
    }),
  staffSignIn: (entryCode: string, username: string, password: string) =>
    request<SignedIn>("/auth/staff", { method: "POST", body: JSON.stringify({ entryCode, username, password }) }),
  requestEmailCode: (email: string) => request<CodeRequest>("/auth/email/request", { method: "POST", body: JSON.stringify({ email }) }),
  verifyEmailCode: (email: string, code: string, themeColor?: string, linkToken?: string) =>
    request<VerifyResult>("/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ email, code, themeColor, linkToken }),
    }),
  // Which sign-in methods can deliver a code right now (no SMS gateway yet = email only).
  authMethods: () => request<{ email: boolean; phone: boolean }>("/auth/methods"),
  createAccount: (linkToken: string, themeColor?: string) => request<SignedIn>("/auth/create", { method: "POST", body: JSON.stringify({ linkToken, themeColor }) }),

  user: (id: string) => request<PublicUser>(`/users/${id}`),
  searchSellers: (q: string) => request<SellerSearchResult[]>(`/users?q=${encodeURIComponent(q)}`),
  // Someone else's items for sale (seller profile). Active only.
  sellerListings: (sellerId: string, page = 0) => requestPage<Listing>(`/listings?${query({ seller: sellerId, page, limit: 40 })}`),
  trust: (id: string) => request<TrustSummary>(`/users/${id}/trust`),
  myProfile: (id: string) => request<FullUser>(`/users/${id}/me`),
  updateProfile: (id: string, data: ProfileUpdate) =>
    request<FullUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  requestPhoneChange: (id: string, phone: string) =>
    request<CodeRequest>(`/users/${id}/phone/request`, { method: "POST", body: JSON.stringify({ phone }) }),
  verifyPhoneChange: (id: string, phone: string, code: string) =>
    request<FullUser>(`/users/${id}/phone/verify`, { method: "POST", body: JSON.stringify({ phone, code }) }),
  requestEmailChange: (id: string, email: string) =>
    request<CodeRequest>(`/users/${id}/email/request`, { method: "POST", body: JSON.stringify({ email }) }),
  verifyEmailChange: (id: string, email: string, code: string) =>
    request<FullUser>(`/users/${id}/email/verify`, { method: "POST", body: JSON.stringify({ email, code }) }),
  moneyConfig: () => request<MoneyConfig>("/purchases/config"),
  myPurchases: () => request<{ purchases: Purchase[]; bank: BankDetails }>("/purchases/mine"),
  createPurchase: (data: NewPurchase, clientRequestId: string) => request<Purchase>("/purchases", { method: "POST", body: JSON.stringify({ ...data, clientRequestId }) }),
  submitSlip: (id: string, slipUrl: string) => request<void>(`/purchases/${id}/slip`, { method: "POST", body: JSON.stringify({ slipUrl }) }),
  cancelPurchase: (id: string) => request<void>(`/purchases/${id}/cancel`, { method: "POST", body: "{}" }),
  ads: () => request<RunningAd[]>("/ads"),
  adClicked: (id: string) => request<void>(`/ads/${id}/click`, { method: "POST", body: "{}" }),
  adminMoney: () => request<{ settings: MoneySettings; purchases: Purchase[] }>("/admin/money"),
  saveMoneySettings: (settings: MoneySettings) => request<MoneySettings>("/admin/money/settings", { method: "PUT", body: JSON.stringify(settings) }),
  purchaseAction: (id: string, body: { action: "QUOTE"; amount: number } | { action: "APPROVE" } | { action: "COMPLETE" } | { action: "REJECT"; note: string }) =>
    request<void>(`/admin/purchases/${id}`, { method: "POST", body: JSON.stringify(body) }),
  adminReports: () => request<ReportGroup[]>("/admin/reports"),
  resolveReports: (target: { listingId: string } | { reportedUserId: string }, action: ReportAction) =>
    request<void>("/admin/reports/resolve", { method: "POST", body: JSON.stringify({ ...target, action }) }),
  adminSellers: (q: string, page: number, bannedOnly: boolean) =>
    request<{ sellers: AdminSeller[]; total: number; hasMore: boolean }>(`/admin/sellers?q=${encodeURIComponent(q)}&page=${page}${bannedOnly ? "&banned=1" : ""}`),
  banUser: (id: string) => request<void>(`/admin/users/${id}/ban`, { method: "POST" }),
  unbanUser: (id: string) => request<void>(`/admin/users/${id}/unban`, { method: "POST" }),
  adminIbay: (q: string, page: number) =>
    request<{ items: IbayItem[]; total: number; hasMore: boolean; showcaseOn: boolean }>(`/admin/ibay?q=${encodeURIComponent(q)}&page=${page}`),
  setIbayShowcase: (on: boolean) => request<{ showcaseOn: boolean }>("/admin/ibay/showcase", { method: "POST", body: JSON.stringify({ on }) }),
  hideIbayItem: (id: string, hidden: boolean) => request<void>(`/admin/ibay/${id}/hide`, { method: "POST", body: JSON.stringify({ hidden }) }),
  ibayItems: (filters: IbayFilters, page: number, limit?: number) => {
    const qs = new URLSearchParams(Object.entries({ ...filters, page: String(page), limit: limit ? String(limit) : undefined }).filter(([, v]) => !!v) as [string, string][]).toString();
    return request<{ items: IbayItemSummary[]; hasMore: boolean }>(`/ibay/items?${qs}`);
  },
  ibayItem: (id: string) => request<IbayItemDetail>(`/ibay/items/${id}`),
  claimIbayItem: (id: string) => request<Listing>(`/ibay/items/${id}/claim`, { method: "POST", body: "{}" }),
  removeIbayItem: (id: string) => request<void>(`/ibay/items/${id}/remove`, { method: "POST", body: "{}" }),
  reportIbayItem: (id: string) => request<void>(`/ibay/items/${id}/report`, { method: "POST", body: "{}" }),
  markPriceDropSeen: (userId: string, listingId: string) => request<void>(`/notifications/${userId}/price-drops/${listingId}/seen`, { method: "POST", body: "{}" }),
  deleteAccount: (id: string) => request<void>(`/users/${id}`, { method: "DELETE" }),
  verification: (id: string) => request<VerificationProgress>(`/users/${id}/verification`),

  orders: (userId: string, role?: "BUYING" | "SELLING") => request<Order[]>(`/orders/mine/${userId}${role ? `?role=${role}` : ""}`),
  order: (id: string, userId: string) => request<Order>(`/orders/${id}?userId=${userId}`),
  sellToBuyer: (conversationId: string, sellerId: string, amount?: number) =>
    request<Order>(`/orders`, { method: "POST", body: JSON.stringify({ conversationId, sellerId, amount }) }),
  orderDispute: (id: string) => request<DisputeInfo>(`/orders/${id}/dispute`),
  addDisputeEvidence: (id: string, userId: string, text: string, photoUrl?: string) =>
    request<{ ok: true }>(`/orders/${id}/evidence`, { method: "POST", body: JSON.stringify({ userId, text, photoUrl }) }),
  resolveDispute: (id: string, outcome: "DELIVERED" | "CANCELLED", note: string) => request<void>(`/orders/${id}/resolve`, { method: "POST", body: JSON.stringify({ outcome, note }) }),
  adminStaff: () => request<{ staff: StaffMember[]; invites: string[] }>("/admin/staff"),
  addStaff: (email: string) => request<{ added: "now" | "invite"; name?: string }>("/admin/staff", { method: "POST", body: JSON.stringify({ email }) }),
  removeStaff: (id: string) => request<void>(`/admin/staff/${id}`, { method: "DELETE" }),
  cancelStaffInvite: (email: string) => request<void>(`/admin/staff/invites/${encodeURIComponent(email)}`, { method: "DELETE" }),
  adminDisputes: () => request<AdminDispute[]>("/admin/disputes"),
  dispatchOrder: (id: string, userId: string, details: DispatchDetails) =>
    request<Order>(`/orders/${id}/dispatch`, { method: "POST", body: JSON.stringify({ userId, ...details }) }),
  // Only the seller confirms, and only with the buyer's handover code.
  confirmDelivery: (id: string, sellerId: string, code: string) =>
    request<{ order: Order; becameVerified: boolean; delivered?: number }>(`/orders/${id}/confirm`, { method: "POST", body: JSON.stringify({ userId: sellerId, code }) }),
  newHandoverCode: (id: string, buyerId: string) => request<Order>(`/orders/${id}/new-code`, { method: "POST", body: JSON.stringify({ userId: buyerId }) }),
  shareHandoverCode: (id: string, buyerId: string) => request<void>(`/orders/${id}/share-code`, { method: "POST", body: JSON.stringify({ userId: buyerId }) }),
  reportOrderProblem: (id: string, userId: string, details: string) =>
    request<Order>(`/orders/${id}/problem`, { method: "POST", body: JSON.stringify({ userId, details }) }),
  cancelOrder: (id: string, userId: string) => request<Order>(`/orders/${id}/cancel`, { method: "POST", body: JSON.stringify({ userId }) }),

  thread: (conversationId: string, userId: string) => request<Thread>(`/conversations/${conversationId}/thread?userId=${userId}`),
  makeOffer: (conversationId: string, fromId: string, amount: number, clientId: string) =>
    request<Offer>(`/conversations/${conversationId}/offers`, { method: "POST", body: JSON.stringify({ fromId, amount, clientId }) }),
  respondToOffer: (offerId: string, userId: string, action: "ACCEPT" | "DECLINE" | "WITHDRAW") =>
    request<Offer & { orderId?: string | null }>(`/conversations/offers/${offerId}/respond`, { method: "POST", body: JSON.stringify({ userId, action }) }),

  sellerReviews: (sellerId: string) => request<Review[]>(`/reviews/seller/${sellerId}`),
  reviewEligibility: (reviewerId: string, listingId: string) =>
    request<{ eligible: boolean; existing: { rating: number; text: string | null } | null }>(`/reviews/eligibility?reviewerId=${reviewerId}&listingId=${listingId}`),
  submitReview: (data: { reviewerId: string; listingId: string; rating: number; text: string | null }) =>
    request(`/reviews`, { method: "POST", body: JSON.stringify(data) }),

  report: (data: { reporterId: string; listingId?: string; reportedUserId?: string; reason: ReportReason; details?: string }) =>
    request(`/reports`, { method: "POST", body: JSON.stringify(data) }),
  blockedUsers: (userId: string) => request<BlockedUser[]>(`/blocks/${userId}`),
  block: (blockerId: string, blockedId: string) => request(`/blocks`, { method: "POST", body: JSON.stringify({ blockerId, blockedId }) }),
  unblock: (blockerId: string, blockedId: string) => request<void>(`/blocks/${blockerId}/${blockedId}`, { method: "DELETE" }),

  savedSearches: (userId: string) => request<SavedSearch[]>(`/saved-searches/${userId}`),
  saveSearch: (userId: string, label: string, params: ListingFilters) =>
    request<SavedSearch>(`/saved-searches`, { method: "POST", body: JSON.stringify({ userId, label, params }) }),
  markSearchSeen: (id: string) => request<void>(`/saved-searches/${id}/seen`, { method: "POST" }),
  deleteSavedSearch: (id: string) => request<void>(`/saved-searches/${id}`, { method: "DELETE" }),

  notifications: (userId: string) => request<Notifications>(`/notifications/${userId}`),

  favorites: (userId: string) => request<Listing[]>(`/favorites/${userId}`),
  addFavorite: (userId: string, listingId: string) =>
    request(`/favorites`, { method: "POST", body: JSON.stringify({ userId, listingId }) }),
  removeFavorite: (userId: string, listingId: string) =>
    request(`/favorites/${userId}/${listingId}`, { method: "DELETE" }),

  myConversations: (userId: string) => request<Conversation[]>(`/conversations/mine/${userId}`),
  conversation: (id: string) => request<Conversation>(`/conversations/${id}`),
  startConversation: (listingId: string, buyerId: string) =>
    request<Conversation>(`/conversations`, { method: "POST", body: JSON.stringify({ listingId, buyerId }) }),
  messages: (conversationId: string) => request<Message[]>(`/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, senderId: string, text: string, clientId: string, media?: { url: string; type: "IMAGE" | "VIDEO" }) =>
    request<Message>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ senderId, text, clientId, mediaUrl: media?.url, mediaType: media?.type }),
    }),
  registerPushToken: (userId: string, token: string) => {
    devicePushToken = token;
    return request<void>(`/users/${userId}/push-tokens`, { method: "POST", body: JSON.stringify({ token }) });
  },
  logout: () => request<void>("/auth/logout", { method: "POST", body: JSON.stringify({ pushToken: devicePushToken ?? undefined }) }),
};
