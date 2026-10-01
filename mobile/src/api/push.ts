import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { api } from "./client";

// Which chat is on screen right now; set by the open chat so its own
// messages don't buzz the phone while you're reading them.
let activeConversationId: string | null = null;
export const setActivePushConversation = (id: string | null) => {
  activeConversationId = id;
};

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const isActiveChat = n.request.content.data?.conversationId === activeConversationId;
      return { shouldShowAlert: !isActiveChat, shouldPlaySound: !isActiveChat, shouldSetBadge: true };
    },
  });
}

export async function ensureNotificationPermission() {
  if (Platform.OS === "web") return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages and offers",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

// Remote push needs an EAS project id (run `npx eas init` once). Without it
// we still show local notifications from the in-app poller.
export async function registerForPush(userId: string): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) return null;
  if (!(await ensureNotificationPermission())) return null;
  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
  if (!projectId) return null;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.registerPushToken(userId, token);
    return token;
  } catch {
    return null;
  }
}

export async function showLocalNotification(title: string, body: string, data: Record<string, string>) {
  if (Platform.OS === "web") return;
  await Notifications.scheduleNotificationAsync({ content: { title, body, data, sound: "default" }, trigger: null }).catch(() => {});
}

export async function setAppBadge(count: number) {
  if (Platform.OS === "web") return;
  await Notifications.setBadgeCountAsync(count).catch(() => {});
}
