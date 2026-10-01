import React from "react";
import { View, Text } from "react-native";
import { Category } from "../api/client";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, cardShadow, fontSize, fontWeight } from "../theme/theme";
import { categoryIcons, AllCategoriesIcon } from "../theme/categoryIcons";
import Tap from "./Tap";

export const SIDEBAR_WIDTH = 232;

export default function CategorySidebar({
  categories,
  active,
  onSelect,
}: {
  categories: Category[];
  active?: string;
  onSelect: (slug?: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const total = categories.reduce((n, c) => n + (c.listingCount ?? 0), 0);
  const rows = [{ slug: undefined as string | undefined, name: "All categories", count: total }, ...categories.map((c) => ({ slug: c.slug, name: c.name, count: c.listingCount ?? 0 }))];

  return (
    <View style={styles.sidebar}>
      {rows.map((row) => {
        const Icon = row.slug ? categoryIcons[row.slug]?.Icon ?? AllCategoriesIcon : AllCategoriesIcon;
        const isActive = active === row.slug;
        return (
          <Tap key={row.slug ?? "all"} style={[styles.row, isActive && styles.rowActive]} onPress={() => onSelect(row.slug)} scaleTo={0.98}>
            <Icon size={17} color={isActive ? colors.primary : colors.textMuted} />
            <Text style={[styles.rowText, isActive && styles.rowTextActive]} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={[styles.count, isActive && { color: colors.primary }]}>{row.count}</Text>
          </Tap>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    ...cardShadow,
    padding: spacing.sm,
    marginRight: spacing.lg,
    alignSelf: "flex-start",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 4,
    gap: spacing.sm,
    borderRadius: radius.sm,
  },
  rowActive: { backgroundColor: colors.primaryTint },
  rowText: { flex: 1, fontSize: fontSize.base, color: colors.text },
  rowTextActive: { color: colors.primary, fontWeight: fontWeight.bold },
  count: { fontSize: fontSize.caption, color: colors.textMuted, fontWeight: fontWeight.semibold },
}));
