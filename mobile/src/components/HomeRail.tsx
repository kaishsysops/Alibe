import React from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Listing } from "../api/client";
import ListingCard from "./ListingCard";
import { colors, spacing } from "../theme/theme";

const RAIL_CARD_WIDTH = 200;

export default function HomeRail({
  title,
  data,
  onPressItem,
  onSeeAll,
  horizontalPadding = spacing.md,
}: {
  title: string;
  data: Listing[];
  onPressItem: (l: Listing) => void;
  onSeeAll?: () => void;
  horizontalPadding?: number;
}) {
  if (!data.length) return null;
  return (
    <View style={styles.wrap}>
      <View style={[styles.headerRow, { paddingHorizontal: horizontalPadding }]}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity style={styles.seeAll} onPress={onSeeAll}>
            <Text style={styles.seeAllText}>See all</Text>
            <ChevronRight size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ paddingHorizontal: horizontalPadding, gap: spacing.md }}
        renderItem={({ item }) => (
          <ListingCard listing={item} onPress={() => onPressItem(item)} width={RAIL_CARD_WIDTH} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  title: { fontSize: 15, fontWeight: "800", color: colors.text },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { fontSize: 12, color: colors.primary, fontWeight: "700" },
});
