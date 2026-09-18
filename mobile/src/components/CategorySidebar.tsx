import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Category } from "../api/client";
import { colors, spacing, radius } from "../theme/theme";
import { categoryIcons, AllCategoriesIcon } from "../theme/categoryIcons";

export default function CategorySidebar({
  categories,
  active,
  onSelect,
}: {
  categories: Category[];
  active?: string;
  onSelect: (slug?: string) => void;
}) {
  return (
    <View style={styles.sidebar}>
      <Text style={styles.heading}>All Categories</Text>
      <TouchableOpacity style={[styles.row, !active && styles.rowActive]} onPress={() => onSelect(undefined)}>
        <AllCategoriesIcon size={17} color={!active ? colors.primary : colors.textMuted} />
        <Text style={[styles.rowText, !active && styles.rowTextActive]}>All</Text>
      </TouchableOpacity>
      {categories.map((c) => {
        const cat = categoryIcons[c.slug];
        const Icon = cat?.Icon ?? AllCategoriesIcon;
        const isActive = active === c.slug;
        return (
          <TouchableOpacity key={c.id} style={[styles.row, isActive && styles.rowActive]} onPress={() => onSelect(c.slug)}>
            <Icon size={17} color={isActive ? colors.primary : colors.textMuted} />
            <Text style={[styles.rowText, isActive && styles.rowTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 220,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    marginRight: spacing.lg,
    height: "fit-content" as any,
  },
  heading: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  rowActive: { backgroundColor: colors.primaryTint },
  rowText: { fontSize: 14, color: colors.text },
  rowTextActive: { color: colors.primary, fontWeight: "700" },
});
