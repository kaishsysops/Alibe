import { useWindowDimensions } from "react-native";
import { useConsole } from "../components/ConsoleContext";
import { spacing } from "../theme/theme";

// Every admin/portal page uses the same centred column, so the page title and
// the content line up, at any screen size. Outside the console these are no-ops.
export const CONSOLE_WIDTH = 980;
// Below this the sidebar becomes a menu (see Shell).
export const CONSOLE_WIDE = 900;

export function useConsolePadding() {
  const { width } = useWindowDimensions();
  return width < 600 ? spacing.md : spacing.lg;
}

// The centred column, for fixed rows (page title, tabs, search bars).
export function useConsoleColumn() {
  const { inConsole } = useConsole();
  const pad = useConsolePadding();
  if (!inConsole) return null;
  return { width: "100%" as const, maxWidth: CONSOLE_WIDTH + pad * 2, alignSelf: "center" as const, paddingHorizontal: pad };
}

// The same column for a scroll view's content. Content starts at the top;
// it fills the height so an empty-state message can centre itself in it.
export function useConsolePage() {
  const column = useConsoleColumn();
  return column && { ...column, flexGrow: 1 };
}
