import React from "react";
import { FlatList, View, Text, useWindowDimensions } from "react-native";
import { Listing } from "../api/client";
import ListingCard from "./ListingCard";
import { spacing } from "../theme/theme";

const CARD_MIN_WIDTH = 210;
const GRID_GAP = spacing.md;
const MAX_COLUMNS = 5;

export function computeGrid(width: number, horizontalPadding = spacing.md) {
  const usable = width - horizontalPadding * 2;
  const numColumns = Math.min(MAX_COLUMNS, Math.max(2, Math.floor((usable + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP))));
  const cardWidth = (usable - GRID_GAP * (numColumns - 1)) / numColumns;
  return { numColumns, cardWidth, usable };
}

export default function ProductGrid({
  data,
  onPressItem,
  ListHeaderComponent,
  ListEmptyComponent,
  refreshControl,
  containerWidth,
  horizontalPadding = spacing.md,
}: {
  data: Listing[];
  onPressItem: (l: Listing) => void;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement;
  refreshControl?: React.ReactElement;
  containerWidth?: number;
  horizontalPadding?: number;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const width = containerWidth ?? windowWidth;
  const { numColumns, cardWidth } = computeGrid(width, horizontalPadding);

  return (
    <FlatList
      key={numColumns}
      data={data}
      keyExtractor={(l) => l.id}
      numColumns={numColumns}
      columnWrapperStyle={{ paddingHorizontal: horizontalPadding, gap: GRID_GAP }}
      contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: GRID_GAP }}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      refreshControl={refreshControl}
      renderItem={({ item }) => (
        <ListingCard listing={item} onPress={() => onPressItem(item)} width={cardWidth} />
      )}
    />
  );
}

// Non-virtualized variant for use inside an outer ScrollView (avoids nesting
// a FlatList inside a ScrollView, which React Native warns against).
export function StaticProductGrid({
  data,
  onPressItem,
  containerWidth,
  horizontalPadding = spacing.md,
  emptyText,
}: {
  data: Listing[];
  onPressItem: (l: Listing) => void;
  containerWidth: number;
  horizontalPadding?: number;
  emptyText?: string;
}) {
  const { cardWidth } = computeGrid(containerWidth, horizontalPadding);

  if (!data.length) {
    return emptyText ? <Text style={{ paddingHorizontal: horizontalPadding }}>{emptyText}</Text> : null;
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: horizontalPadding, gap: GRID_GAP }}>
      {data.map((item) => (
        <ListingCard key={item.id} listing={item} onPress={() => onPressItem(item)} width={cardWidth} />
      ))}
    </View>
  );
}
