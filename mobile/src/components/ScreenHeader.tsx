import React from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, fontSize, fontWeight } from "../theme/theme";
import Tap from "./Tap";

export function useGoBack() {
  const navigation = useNavigation<any>();
  return () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Tabs"));
}

export function BackButton({ variant = "plain" }: { variant?: "plain" | "floating" }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const goBack = useGoBack();
  return (
    <Tap
      style={[styles.backButton, variant === "floating" && styles.backButtonFloating]}
      onPress={goBack}
      hitSlop={10}
      scaleTo={0.88}
      accessibilityLabel="Go back"
    >
      <ChevronLeft size={22} color={colors.text} strokeWidth={2.4} />
    </Tap>
  );
}

// Compact in-app header used by every pushed screen instead of the native
// stack header — one row, safe-area aware, no dead space above the content.
export default function ScreenHeader({
  title,
  subtitle,
  right,
  floating,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  // Overlay variant: transparent bar with circular buttons, drawn on top of a
  // full-bleed hero image (product detail).
  floating?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  return (
    <View
      style={[floating ? styles.floatingBar : styles.bar, { paddingTop: insets.top + (floating ? spacing.sm : spacing.xs) }]}
      pointerEvents="box-none"
    >
      <BackButton variant={floating ? "floating" : "plain"} />
      <View style={styles.titleWrap} pointerEvents="none">
        {!!title && (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
    gap: spacing.xs,
  },
  floatingBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  backButtonFloating: {
    backgroundColor: colors.floating,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  subtitle: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
}));
