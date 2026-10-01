import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { api, Notifications as NotificationsData } from "./client";
import { useAuth } from "./AuthContext";
import { useToast } from "../components/Toast";
import { navigationRef } from "../navigation/navigationRef";
import { ensureNotificationPermission, registerForPush, setActivePushConversation, setAppBadge, showLocalNotification } from "./push";

type NotificationsState = {
  data: NotificationsData;
  refresh: () => Promise<void>;
  // The chat currently on screen: its new messages don't trigger alerts.
  setActiveConversation: (id: string | null) => void;
};

const EMPTY: NotificationsData = { unreadChats: 0, total: 0, items: [] };
const POLL_MS = 6000;
const NotificationsContext = createContext<NotificationsState | undefined>(undefined);

const openChat = (conversationId: string) => {
  if (navigationRef.isReady()) (navigationRef as any).navigate("ChatThread", { id: conversationId });
};

const openOrder = (orderId: string) => {
  if (navigationRef.isReady()) (navigationRef as any).navigate("Orders", { orderId });
};

// Desktop web: browser notification when the Alibe tab is in the background.
function webNotify(title: string, body: string) {
  if (Platform.OS !== "web" || typeof window === "undefined" || !("Notification" in window)) return;
  const N = (window as any).Notification;
  if (N.permission === "granted" && document.hidden) {
    const n = new N(title, { body, tag: "alibe-message" });
    n.onclick = () => window.focus();
  }
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<NotificationsData>(EMPTY);
  const seen = useRef<Set<string> | null>(null);
  const activeConversation = useRef<string | null>(null);
  const hasRemotePush = useRef(false);

  const refresh = useCallback(async () => {
    if (!user) return setData(EMPTY);
    try {
      const next = await api.notifications(user.id);
      setData(next);
      setAppBadge(next.unreadChats);

      // Messages and incoming offers each have a stable id; anything not seen
      // on the previous poll is new and gets announced.
      const alertable = next.items.filter((i) => i.type !== "saved_search");
      if (seen.current) {
        for (const item of alertable) {
          if (seen.current.has(item.id) || item.type === "saved_search") continue;
          if (item.conversationId === activeConversation.current) continue;
          const title =
            item.type === "message"
              ? item.fromName
              : item.type === "offer"
              ? `${item.fromName} made an offer`
              : item.role === "SELLER"
              ? `Send ${item.listingTitle} to ${item.fromName}`
              : `${item.listingTitle} is on its way`;
          const body =
            item.type === "message"
              ? item.preview
              : item.type === "offer"
              ? `MVR ${item.amount.toLocaleString()} for ${item.listingTitle}`
              : item.role === "SELLER"
              ? "You're responsible for delivery. Open the order to send it."
              : "Confirm in the app once you have it.";
          if (AppState.currentState === "active") {
            toast.info(`${title}: ${body}`, {
              label: "Open",
              onPress: () => (item.type === "order" ? openOrder(item.orderId) : openChat(item.conversationId)),
            });
          } else if (!hasRemotePush.current) {
            // No server push configured: raise a local system notification instead.
            showLocalNotification(title, body, { conversationId: item.conversationId });
          }
          webNotify(title, body);
        }
      }
      seen.current = new Set(alertable.map((i) => i.id));
    } catch {
      // Best-effort: retried on the next poll.
    }
  }, [user, toast]);

  useEffect(() => {
    seen.current = null;
    setData(EMPTY);
    if (!user) return;
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());

    let pushToken: string | null = null;
    if (Platform.OS === "web") {
      const N = typeof window !== "undefined" ? (window as any).Notification : undefined;
      if (N?.permission === "default") N.requestPermission().catch(() => {});
    } else {
      registerForPush(user.id).then((token) => {
        pushToken = token;
        hasRemotePush.current = !!token;
        if (!token) ensureNotificationPermission();
      });
    }
    // Tapping a system notification opens that conversation.
    const tapSub =
      Platform.OS !== "web"
        ? Notifications.addNotificationResponseReceivedListener((r) => {
            const { orderId, conversationId } = r.notification.request.content.data ?? {};
            if (typeof orderId === "string") openOrder(orderId);
            else if (typeof conversationId === "string") openChat(conversationId);
          })
        : null;

    return () => {
      clearInterval(interval);
      sub.remove();
      tapSub?.remove();
      if (pushToken) api.removePushToken(user.id, pushToken).catch(() => {});
    };
  }, [user, refresh]);

  // Web: "(3) Alibe" in the browser tab while there are unread chats.
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") document.title = data.unreadChats ? `(${data.unreadChats}) Alibe` : "Alibe";
  }, [data.unreadChats]);

  const setActiveConversation = useCallback((id: string | null) => {
    activeConversation.current = id;
    setActivePushConversation(id);
  }, []);

  return <NotificationsContext.Provider value={{ data, refresh, setActiveConversation }}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
