import React from "react";
import { Text, View } from "react-native";
import { BadgeCheck, Star } from "lucide-react-native";
import { SellerRating } from "../api/client";
import { useTheme } from "../theme/ThemeContext";
import { fontSize, fontWeight } from "../theme/theme";

export function VerifiedBadge({ size = 16 }: { size?: number }) {
  const { colors } = useTheme();
  return <BadgeCheck size={size} color="#fff" fill={colors.verified} accessibilityLabel="Verified seller" />;
}

export function Stars({ value, size = 14, gap = 2 }: { value: number; size?: number; gap?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color={colors.gold} fill={value >= i - 0.25 ? colors.gold : "transparent"} />
      ))}
    </View>
  );
}

// "4.7 (3)" with one star — compact enough for cards and headers.
export function RatingSummary({ rating, size = 13 }: { rating?: SellerRating; size?: number }) {
  const { colors } = useTheme();
  if (!rating?.count) return <Text style={{ fontSize: size, color: colors.textMuted }}>No reviews yet</Text>;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Star size={size} color={colors.gold} fill={colors.gold} />
      <Text style={{ fontSize: size, color: colors.text, fontWeight: fontWeight.bold }}>{rating.average.toFixed(1)}</Text>
      <Text style={{ fontSize: size, color: colors.textMuted }}>
        ({rating.count} review{rating.count === 1 ? "" : "s"})
      </Text>
    </View>
  );
}

export function CountBadge({ count, style }: { count: number; style?: object }) {
  const { colors } = useTheme();
  if (!count) return null;
  return (
    <View
      style={[
        { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.card },
        style,
      ]}
    >
      <Text style={{ color: "#fff", fontSize: fontSize.micro, fontWeight: fontWeight.extrabold }}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}
