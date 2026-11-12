import { AppState, Platform } from "react-native";

// True while the person can actually see the app: the app is in the
// foreground on a phone, or the browser tab is showing on the web. Background
// polling checks this so hidden tabs and pocketed phones cost the server nothing.
export function appIsVisible() {
  if (Platform.OS === "web") return typeof document === "undefined" || document.visibilityState === "visible";
  return AppState.currentState === "active";
}
