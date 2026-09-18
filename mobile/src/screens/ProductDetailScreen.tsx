import React, { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { MapPin, MessageCircle } from "lucide-react-native";
import { api, Listing } from "../api/client";
import { colors, spacing, radius, conditionColors } from "../theme/theme";
import { categoryIcons } from "../theme/categoryIcons";
import WebNavBar from "../components/WebNavBar";
import { useResponsive } from "../hooks/useResponsive";

const MAX_CONTENT_WIDTH = 1100;

export default function ProductDetailScreen() {
  const route = useRoute<any>();
  const { id } = route.params;
  const { isDesktopWeb } = useResponsive();
  const [listing, setListing] = useState<Listing | null>(null);

  useEffect(() => {
    api.listing(id).then(setListing).catch(() => Alert.alert("Error", "Couldn't load listing"));
  }, [id]);

  if (!listing) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const cat = categoryIcons[listing.category.slug];
  const CategoryIcon = cat?.Icon;

  const sellerCard = (
    <View style={styles.sellerCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{listing.seller.name.charAt(0)}</Text>
      </View>
      <View>
        <Text style={styles.sellerName}>{listing.seller.name}</Text>
        <Text style={styles.sellerMeta}>Seller · {listing.seller.phone}</Text>
      </View>
    </View>
  );

  const chatButton = (
    <TouchableOpacity style={styles.chatButton} onPress={() => Alert.alert("Chat", "In-app chat is a Phase 1 follow-up — not wired up yet.")}>
      <MessageCircle size={18} color="#fff" />
      <Text style={styles.chatButtonText}>Message seller</Text>
    </TouchableOpacity>
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar />
        <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
          <View style={styles.desktopLayout}>
            <Image source={{ uri: listing.images[0] }} style={styles.desktopImage} />
            <View style={styles.desktopInfo}>
              <View style={styles.priceRow}>
                <Text style={styles.price}>MVR {listing.price.toLocaleString()}</Text>
                <View style={[styles.conditionBadgeInline, { backgroundColor: conditionColors[listing.condition] }]}>
                  <Text style={styles.conditionBadgeText}>{listing.condition.replace("_", " ")}</Text>
                </View>
              </View>
              <Text style={styles.title}>{listing.title}</Text>
              <View style={styles.metaRow}>
                <MapPin size={14} color={colors.textMuted} />
                <Text style={styles.metaLine}>
                  {listing.island?.name}{listing.island?.atoll ? `, ${listing.island.atoll.name}` : ""}
                </Text>
                {CategoryIcon && (
                  <View style={[styles.categoryPill, { backgroundColor: cat.color }]}>
                    <CategoryIcon size={12} color="#fff" />
                    <Text style={styles.categoryPillText}>{listing.category.name}</Text>
                  </View>
                )}
              </View>

              {sellerCard}
              {chatButton}

              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView>
        <View>
          <Image source={{ uri: listing.images[0] }} style={styles.image} />
          <View style={[styles.conditionBadge, { backgroundColor: conditionColors[listing.condition] }]}>
            <Text style={styles.conditionBadgeText}>{listing.condition.replace("_", " ")}</Text>
          </View>
        </View>
        <View style={styles.body}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>MVR {listing.price.toLocaleString()}</Text>
            {CategoryIcon && (
              <View style={[styles.categoryPill, { backgroundColor: cat.color }]}>
                <CategoryIcon size={12} color="#fff" />
                <Text style={styles.categoryPillText}>{listing.category.name}</Text>
              </View>
            )}
          </View>
          <Text style={styles.title}>{listing.title}</Text>
          <View style={styles.metaRow}>
            <MapPin size={13} color={colors.textMuted} />
            <Text style={styles.metaLine}>
              {listing.island?.name}{listing.island?.atoll ? `, ${listing.island.atoll.name}` : ""}
            </Text>
          </View>

          {sellerCard}

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{listing.description}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>{chatButton}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  desktopLayout: { flexDirection: "row", gap: spacing.xl, maxWidth: MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center" },
  desktopImage: { width: 460, height: 460, borderRadius: radius.lg, backgroundColor: colors.border },
  desktopInfo: { flex: 1, maxWidth: 480 },
  image: { width: "100%", aspectRatio: 1, backgroundColor: colors.border },
  conditionBadge: {
    position: "absolute",
    left: spacing.md,
    top: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  conditionBadgeInline: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
  conditionBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  body: { padding: spacing.md },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  price: { fontSize: 26, fontWeight: "800", color: colors.price },
  categoryPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.lg },
  categoryPillText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  title: { fontSize: 17, color: colors.text, marginTop: spacing.xs },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs, flexWrap: "wrap" },
  metaLine: { fontSize: 13, color: colors.textMuted },
  sellerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800" },
  sellerName: { fontWeight: "700", color: colors.text },
  sellerMeta: { color: colors.textMuted, fontSize: 12 },
  sectionTitle: { fontWeight: "700", fontSize: 15, marginTop: spacing.lg, marginBottom: spacing.xs, color: colors.text },
  description: { color: colors.text, lineHeight: 20 },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  chatButton: { flexDirection: "row", gap: spacing.xs, backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  chatButtonText: { color: "#fff", fontWeight: "700" },
});
