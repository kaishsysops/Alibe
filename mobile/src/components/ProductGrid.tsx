import React from "react";
import { FlatList, View, Platform, useWindowDimensions } from "react-native";
import { Listing } from "../api/client";
import ListingCard from "./ListingCard";
import { GridSkeleton } from "./Skeleton";
import { spacing, tabBarClearance } from "../theme/theme";
import { FadeIn } from "./Motion";

const CARD_MIN_WIDTH = 168;
const GRID_GAP = spacing.md;
const MAX_COLUMNS = 6;
// window.innerWidth on web doesn't shrink for a vertical scrollbar, but the
// actual content box does — without this, an exact-fit flex-wrap row can
// silently lose its scrollbar's worth of width and wrap to one column.
const WEB_SCROLLBAR_BUFFER = Platform.OS === "web" ? 18 : 0;

export function computeGrid(width: number, horizontalPadding = spacing.md) {
  const usable = width - horizontalPadding * 2 - WEB_SCROLLBAR_BUFFER;
  const numColumns = Math.min(MAX_COLUMNS, Math.max(2, Math.floor((usable + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP))));
  const cardWidth = Math.floor((usable - GRID_GAP * (numColumns - 1)) / numColumns);
  return { numColumns, cardWidth, usable };
}

export default function ProductGrid({
  data,
  onPressItem,
  loading,
  ListHeaderComponent,
  ListEmptyComponent,
  refreshControl,
  containerWidth,
  horizontalPadding = spacing.md,
  bottomPadding = tabBarClearance,
  renderCard,
}: {
  data: Listing[];
  onPressItem: (l: Listing) => void;
  loading?: boolean;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement;
  refreshControl?: React.ReactElement;
  containerWidth?: number;
  horizontalPadding?: number;
  bottomPadding?: number;
  renderCard?: (l: Listing, width: number) => React.ReactElement;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const width = containerWidth ?? windowWidth;
  const { numColumns, cardWidth } = computeGrid(width, horizontalPadding);

  return (
    <FlatList
      key={numColumns}
      data={loading ? [] : data}
      keyExtractor={(l) => l.id}
      numColumns={numColumns}
      columnWrapperStyle={{ paddingHorizontal: horizontalPadding, gap: GRID_GAP }}
      contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: bottomPadding, flexGrow: 1 }}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={
        loading ? (
          <View style={{ paddingHorizontal: horizontalPadding }}>
            <GridSkeleton columns={numColumns} cardWidth={cardWidth} rows={3} gap={GRID_GAP} />
          </View>
        ) : (
          ListEmptyComponent
        )
      }
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      renderItem={({ item, index }) => (
        <FadeIn delay={Math.min(index, 8) * 45}>
          {renderCard ? renderCard(item, cardWidth) : <ListingCard listing={item} onPress={() => onPressItem(item)} width={cardWidth} />}
        </FadeIn>
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
  loading,
}: {
  data: Listing[];
  onPressItem: (l: Listing) => void;
  containerWidth: number;
  horizontalPadding?: number;
  loading?: boolean;
}) {
  const { numColumns, cardWidth } = computeGrid(containerWidth, horizontalPadding);

  if (loading) {
    return (
      <View style={{ paddingHorizontal: horizontalPadding }}>
        <GridSkeleton columns={numColumns} cardWidth={cardWidth} rows={2} gap={GRID_GAP} />
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: horizontalPadding, columnGap: GRID_GAP }}>
      {data.map((item, index) => (
        <FadeIn key={item.id} delay={Math.min(index, 8) * 45}>
          <ListingCard listing={item} onPress={() => onPressItem(item)} width={cardWidth} />
        </FadeIn>
      ))}
    </View>
  );
}
