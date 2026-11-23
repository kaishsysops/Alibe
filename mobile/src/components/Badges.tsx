import React from "react";
import { Text, View } from "react-native";
import { BadgeCheck, Star, Crown, Store } from "lucide-react-native";
import { SellerBadge, SellerRating } from "../api/client";
import { useTheme } from "../theme/ThemeContext";
import { fontSize, fontWeight, radius } from "../theme/theme";

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

// Premium (gold crown) or Store (shop) next to a name, with the blue tick
// beside it whenever the seller's ID is verified.
export function SellerBadgeIcon({ badge, verified, size = 16 }: { badge?: SellerBadge; verified?: boolean; size?: number }) {
  const b = badge ?? (verified ? "VERIFIED" : null);
  if (verified && (b === "PREMIUM" || b === "STORE")) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        <SingleBadge badge={b} size={size} />
        <VerifiedBadge size={size} />
      </View>
    );
  }
  return <SingleBadge badge={b} size={size} />;
}

function SingleBadge({ badge: b, size }: { badge: SellerBadge; size: number }) {
  const { colors } = useTheme();
  if (b === "PREMIUM") return <Crown size={size} color="#fff" fill={colors.gold} strokeWidth={1.6} accessibilityLabel="Premium seller" />;
  if (b === "STORE")
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Registered store">
        <Store size={size * 0.62} color="#fff" strokeWidth={2.4} />
      </View>
    );
  if (b === "VERIFIED") return <VerifiedBadge size={size} />;
  return null;
}

const PILL = { PREMIUM: "Premium", STORE: "Store", VERIFIED: "Verified" } as const;

// The same, with a word: for profiles and store pages. A verified Premium or
// Store seller gets the "Verified" pill too.
export function SellerBadgePill({ badge, verified }: { badge?: SellerBadge; verified?: boolean }) {
  if (verified && (badge === "PREMIUM" || badge === "STORE")) {
    return (
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        <OnePill badge={badge} />
        <OnePill badge="VERIFIED" />
      </View>
    );
  }
  return <OnePill badge={badge ?? (verified ? "VERIFIED" : null)} />;
}

function OnePill({ badge }: { badge?: SellerBadge }) {
  const { colors } = useTheme();
  if (!badge) return null;
  const tint = badge === "PREMIUM" ? colors.gold : badge === "STORE" ? colors.primary : colors.verified;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 4, paddingRight: 9, height: 24, borderRadius: radius.pill, backgroundColor: `${tint}1F` }}>
      <SingleBadge badge={badge} size={16} />
      <Text style={{ fontSize: fontSize.caption, fontWeight: fontWeight.extrabold, color: tint }}>{PILL[badge]}</Text>
    </View>
  );
}
