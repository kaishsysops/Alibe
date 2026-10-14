import React from "react";
import { View, Text, FlatList } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Listing } from "../api/client";
import ListingCard from "./ListingCard";
import Tap from "./Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, fontSize, fontWeight } from "../theme/theme";
import { FadeIn } from "./Motion";

const RAIL_CARD_WIDTH = 164;

export default function HomeRail({
  title,
  data,
  onPressItem,
  onSeeAll,
  horizontalPadding = spacing.md,
  cardWidth = RAIL_CARD_WIDTH,
}: {
  title: string;
  data: Listing[];
  onPressItem: (l: Listing) => void;
  onSeeAll?: () => void;
  horizontalPadding?: number;
  cardWidth?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!data.length) return null;
  return (
    <View style={styles.wrap}>
      <View style={[styles.headerRow, { paddingHorizontal: horizontalPadding }]}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAll && (
          <Tap style={styles.seeAll} onPress={onSeeAll} hitSlop={8}>
            <Text style={styles.seeAllText}>See all</Text>
            <ChevronRight size={15} color={colors.primary} />
          </Tap>
        )}
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ paddingHorizontal: horizontalPadding, gap: spacing.md }}
        renderItem={({ item, index }) => (
          <FadeIn delay={Math.min(index, 4) * 60} distance={10}>
            <ListingCard listing={item} onPress={() => onPressItem(item)} width={cardWidth} />
          </FadeIn>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { marginBottom: spacing.sm },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm + 2 },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 4 },
  seeAllText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.bold },
}));
