import React, { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Heart, TrendingDown, ArrowDownUp } from "lucide-react-native";
import { api, Listing } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useFavorites } from "../api/FavoritesContext";
import ProductGrid from "../components/ProductGrid";
import WebNavBar from "../components/WebNavBar";
import ScreenHeader from "../components/ScreenHeader";
import EmptyState from "../components/EmptyState";
import { useToast } from "../components/Toast";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, fontSize, fontWeight, radius } from "../theme/theme";
import { useResponsive, MAX_CONTENT_WIDTH } from "../hooks/useResponsive";

export default function FavoritesScreen() {
  const styles = useStyles();
  const { user } = useAuth();
  const { favoriteIds } = useFavorites();
  const toast = useToast();
  const navigation = useNavigation<any>();
  const { isDesktopWeb, gutter, contentWidth } = useResponsive();
  const [listings, setListings] = useState<Listing[]>([]);
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "DROPPED" | "AVAILABLE" | "GONE">("ALL");
  const [sort, setSort] = useState<"RECENT" | "LOW" | "HIGH">("RECENT");

  const load = useCallback(() => {
    if (!user) return;
    api
      .favorites(user.id)
      .then(setListings)
      .catch(() => toast.error("Couldn't load your saved items."))
      .finally(() => (setLoading(false), setRefreshing(false)));
  }, [user, toast]);
  useFocusEffect(load);

  // Un-hearting a card removes it from this list instantly (optimistic).
  const saved = listings.filter((l) => favoriteIds.has(l.id));
  const dropped = saved.filter((l) => !!l.previousPrice && l.previousPrice > l.price && l.status === "ACTIVE");
  const gone = saved.filter((l) => l.status === "SOLD" || l.status === "RESERVED");
  const savings = dropped.reduce((n, l) => n + (l.previousPrice! - l.price), 0);
  const visible = useMemo(() => {
    const list = filter === "DROPPED" ? dropped : filter === "GONE" ? gone : filter === "AVAILABLE" ? saved.filter((l) => l.status === "ACTIVE") : saved;
    if (sort === "LOW") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "HIGH") return [...list].sort((a, b) => b.price - a.price);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, favoriteIds, filter, sort]);

  const chips: Array<[typeof filter, string, number]> = [
    ["ALL", "All", saved.length],
    ["AVAILABLE", "For sale", saved.length - gone.length],
    ["DROPPED", "Price dropped", dropped.length],
    ["GONE", "Sold or reserved", gone.length],
  ];
  const header =
    !loading && saved.length > 0 ? (
      <View style={{ gap: spacing.sm + 4, marginBottom: spacing.md }}>
        {dropped.length > 0 && (
          <Tap style={styles.dropBanner} onPress={() => setFilter("DROPPED")} scaleTo={0.98}>
            <View style={styles.dropIcon}>
              <TrendingDown size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dropTitle}>
                {dropped.length} {dropped.length === 1 ? "item is" : "items are"} cheaper now
              </Text>
              <Text style={styles.dropText}>MVR {savings.toLocaleString()} less than when you saved them</Text>
            </View>
          </Tap>
        )}
        <View style={styles.controls}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} style={{ flex: 1 }}>
            {chips
              .filter(([key, , n]) => key === "ALL" || n > 0)
              .map(([key, label, n]) => {
                const on = filter === key;
                return (
                  <Tap key={key} style={[styles.chip, on && styles.chipOn]} onPress={() => setFilter(key)} scaleTo={0.95}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {label} {n}
                    </Text>
                  </Tap>
                );
              })}
          </ScrollView>
          <Tap style={styles.sort} onPress={() => setSort((s) => (s === "RECENT" ? "LOW" : s === "LOW" ? "HIGH" : "RECENT"))} scaleTo={0.95} accessibilityLabel="Change sort order">
            <ArrowDownUp size={14} color={colors.text} />
            <Text style={styles.sortText}>{sort === "RECENT" ? "Recent" : sort === "LOW" ? "Lowest price" : "Highest price"}</Text>
          </Tap>
        </View>
      </View>
    ) : null;
  const goToProduct = (l: Listing) => navigation.navigate("ProductDetail", { id: l.id });

  const grid = (
    <ProductGrid
      data={visible}
      loading={loading}
      onPressItem={goToProduct}
      containerWidth={isDesktopWeb ? contentWidth : undefined}
      horizontalPadding={isDesktopWeb ? 0 : gutter}
      bottomPadding={spacing.xl}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (setRefreshing(true), load())} tintColor={colors.primary} colors={[colors.primary]} />}
      ListEmptyComponent={
        saved.length ? (
          <EmptyState icon={Heart} title="Nothing in this filter" message="Try another one above." actionLabel="Show all" onAction={() => setFilter("ALL")} />
        ) : (
          <EmptyState icon={Heart} title="No saved items yet" message="Tap the heart on anything you like. We'll tell you if the price drops." actionLabel="Start browsing" onAction={() => navigation.navigate("Tabs", { screen: "SearchTab" })} />
        )
      }
    />
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar active="saved" />
        <View style={[styles.desktopColumn, { paddingHorizontal: gutter }]}>
          <Text style={styles.header}>Saved items</Text>
          {grid}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Saved items" subtitle={loading ? undefined : `${saved.length} saved`} />
      {grid}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  desktopColumn: { maxWidth: MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center", paddingTop: spacing.lg, flex: 1 },
  header: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: spacing.md },
  dropBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.sm + 4, borderRadius: radius.lg, backgroundColor: `${colors.success}14` },
  dropIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  dropTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  dropText: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 1 },
  controls: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  chip: { paddingHorizontal: 14, height: 36, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  chipTextOn: { color: colors.inverseText },
  sort: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 36, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sortText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
}));
