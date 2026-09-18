import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { MapPin, Star } from "lucide-react-native";
import { Listing } from "../api/client";
import { colors, spacing, radius, conditionColors } from "../theme/theme";
import { pseudoRating, pseudoSoldCount } from "../utils/fakeStats";

export default function ListingCard({
  listing,
  onPress,
  width,
}: {
  listing: Listing;
  onPress: () => void;
  width?: number;
}) {
  return (
    <TouchableOpacity style={[styles.card, width ? { width } : styles.cardDefaultWidth]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: listing.images[0] }} style={styles.image} />
        <View style={[styles.conditionBadge, { backgroundColor: conditionColors[listing.condition] }]}>
          <Text style={styles.conditionBadgeText}>{listing.condition.replace("_", " ")}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={styles.price}>
          MVR {listing.price.toLocaleString()}
        </Text>
        <View style={styles.footerRow}>
          <View style={styles.ratingRow}>
            <Star size={11} color={colors.gold} fill={colors.gold} />
            <Text style={styles.ratingText}>{pseudoRating(listing.id)}</Text>
            <Text style={styles.soldText}>({pseudoSoldCount(listing.id)})</Text>
          </View>
          <View style={styles.metaRow}>
            <MapPin size={10} color={colors.textMuted} />
            <Text style={styles.meta} numberOfLines={1}>
              {listing.island?.name}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardDefaultWidth: { width: "48%" },
  imageWrap: { position: "relative" },
  image: { width: "100%", aspectRatio: 1, backgroundColor: colors.border },
  conditionBadge: {
    position: "absolute",
    left: spacing.sm,
    top: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  conditionBadgeText: { color: "#fff", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.3 },
  body: { padding: spacing.md },
  title: { color: colors.text, fontSize: 14, fontWeight: "500" },
  price: { fontWeight: "800", color: colors.price, fontSize: 19, marginTop: 4 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  soldText: { color: colors.textMuted, fontSize: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 2, maxWidth: "45%" },
  meta: { color: colors.textMuted, fontSize: 11 },
});
