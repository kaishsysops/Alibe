import { useWindowDimensions, Platform } from "react-native";
import { spacing } from "../theme/theme";

export const DESKTOP_BREAKPOINT = 900;
export const MAX_CONTENT_WIDTH = 1280;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isDesktopWeb = isWeb && width >= DESKTOP_BREAKPOINT;
  // Horizontal page margin: tighter on phones, roomier as the screen grows.
  const gutter = width >= 1200 ? spacing.xl : width >= 600 ? spacing.lg : spacing.md;
  // Width available to content inside a centred max-width column.
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - gutter * 2;
  return { isWeb, isDesktopWeb, width, height, gutter, contentWidth };
}
