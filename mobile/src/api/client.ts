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

const OFFLINE_MESSAGE = "Can't reach Alibe right now. Check your connection and try again.";

function fallbackMessage(status: number) {
  if (status === 404) return "We couldn't find that. It may have been removed.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return "Something went wrong. Please try again.";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new ApiError(0, OFFLINE_MESSAGE);
  }
  if (!res.ok) {
    let message = fallbackMessage(res.status);
    try {
      const body = await res.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      // non-JSON error body — keep the generic sentence
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Uploaded files come back as server-relative paths (/uploads/…); resolve
// them against whichever API host this device talks to.
export function mediaUrl(uri: string | null | undefined) {
  if (!uri) return undefined;
  return uri.startsWith("/uploads/") ? `${BASE_URL}${uri}` : uri;
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

export type Category = { id: string; name: string; slug: string; icon: string | null; listingCount?: number };
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
};
export type PaymentMethod = "CASH" | "BANK_TRANSFER";
export type User = {
  id: string;
  phone: string;
  name: string;
  createdAt?: string;
  username?: string | null;
  avatarColor?: string | null;
  themeColor?: string | null;
  showPhone?: boolean;
  whatsappEnabled?: boolean;
  whatsappNumber?: string | null;
  viberEnabled?: boolean;
  viberNumber?: string | null;
  verificationStatus?: "NONE" | "VERIFIED";
};
export type FullUser = Required<Omit<User, "createdAt">> & {
  createdAt: string;
  email: string | null;
  bio: string | null;
  islandId: string | null;
  island: (Island & { atoll: Atoll }) | null;
  paymentMethod: PaymentMethod | null;
  promoOptIn: boolean;
};
export type PublicUser = PublicSeller & { bio: string | null; createdAt: string; activeListingsCount: number; rating: SellerRating; deliveredCount: number };
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
};
export type DispatchDetails = { method: DeliveryOption; boatName?: string; boatDeparture?: string; cargoReference?: string; courierName?: string; pickupNote?: string };
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
}>;
export type SavedSearch = { id: string; label: string; params: ListingFilters; newCount: number; createdAt: string };
export type NotificationItem =
  | { type: "message"; id: string; messageId: string; conversationId: string; fromName: string; listingTitle: string; image: string | null; preview: string; count: number; createdAt: string }
  | { type: "offer"; id: string; offerId: string; conversationId: string; fromName: string; listingTitle: string; image: string | null; amount: number; createdAt: string }
  | { type: "order"; id: string; orderId: string; conversationId: string; role: "BUYER" | "SELLER"; status: OrderStatus; fromName: string; listingTitle: string; image: string | null; createdAt: string }
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
  email: string | null;
  bio: string | null;
  avatarColor: string | null;
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
};

export const api = {
  health: () => request<{ ok: boolean }>("/health"),
  categories: () => request<Category[]>("/categories"),
  atolls: () => request<Atoll[]>("/atolls"),
  listings: (params: Record<string, string | undefined> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string][]
    ).toString();
    return request<Listing[]>(`/listings${qs ? `?${qs}` : ""}`);
  },
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
  requestOtp: (phone: string) => request<{ sent: boolean }>("/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, code: string, themeColor?: string) =>
    request<{ token: string; user: User }>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code, themeColor }),
    }),

  user: (id: string) => request<PublicUser>(`/users/${id}`),
  myProfile: (id: string) => request<FullUser>(`/users/${id}/me`),
  updateProfile: (id: string, data: ProfileUpdate) =>
    request<FullUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  requestPhoneChange: (id: string, phone: string) =>
    request<{ sent: boolean }>(`/users/${id}/phone/request`, { method: "POST", body: JSON.stringify({ phone }) }),
  verifyPhoneChange: (id: string, phone: string, code: string) =>
    request<FullUser>(`/users/${id}/phone/verify`, { method: "POST", body: JSON.stringify({ phone, code }) }),
  deleteAccount: (id: string) => request<void>(`/users/${id}`, { method: "DELETE" }),
  verification: (id: string) => request<VerificationProgress>(`/users/${id}/verification`),

  orders: (userId: string, role?: "BUYING" | "SELLING") => request<Order[]>(`/orders/mine/${userId}${role ? `?role=${role}` : ""}`),
  order: (id: string, userId: string) => request<Order>(`/orders/${id}?userId=${userId}`),
  sellToBuyer: (conversationId: string, sellerId: string, amount?: number) =>
    request<Order>(`/orders`, { method: "POST", body: JSON.stringify({ conversationId, sellerId, amount }) }),
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
  registerPushToken: (userId: string, token: string) =>
    request<void>(`/users/${userId}/push-tokens`, { method: "POST", body: JSON.stringify({ token }) }),
  removePushToken: (userId: string, token: string) =>
    request<void>(`/users/${userId}/push-tokens?token=${encodeURIComponent(token)}`, { method: "DELETE" }),
};
