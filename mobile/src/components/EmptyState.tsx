import React from "react";
import { View, Text } from "react-native";
import { LucideIcon } from "lucide-react-native";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import Tap from "./Tap";

// Every "nothing here" moment gets an illustration, a reason, and a way
// forward — a screen is never just blank.
export default function EmptyState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  tone = "muted",
  compact,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  tone?: "muted" | "error";
  compact?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const accent = tone === "error" ? colors.danger : colors.primary;
  return (
    <View style={[styles.container, compact && { paddingVertical: spacing.lg }]}>
      <View style={[styles.halo, { backgroundColor: `${accent}0D` }]}>
        <View style={[styles.iconBadge, { backgroundColor: `${accent}1A` }]}>
          <Icon size={30} color={accent} strokeWidth={1.75} />
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      {!!message && <Text style={styles.message}>{message}</Text>}
      {!!actionLabel && !!onAction && (
        <Tap style={[styles.button, { backgroundColor: accent }]} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Tap>
      )}
      {!!secondaryLabel && !!onSecondary && (
        <Tap style={styles.secondary} onPress={onSecondary}>
          <Text style={[styles.secondaryText, { color: accent }]}>{secondaryLabel}</Text>
        </Tap>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl * 1.5, paddingHorizontal: spacing.xl },
  halo: { width: 104, height: 104, borderRadius: 52, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  iconBadge: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, textAlign: "center" },
  message: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs, lineHeight: fontSize.base * 1.4, maxWidth: 320 },
  button: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 4, marginTop: spacing.lg },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.base },
  secondary: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.xs },
  secondaryText: { fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
}));
