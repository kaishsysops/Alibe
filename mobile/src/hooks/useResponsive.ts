import { useWindowDimensions, Platform } from "react-native";

export const DESKTOP_BREAKPOINT = 900;

export function useResponsive() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isDesktopWeb = isWeb && width >= DESKTOP_BREAKPOINT;
  return { isWeb, isDesktopWeb, width };
}
