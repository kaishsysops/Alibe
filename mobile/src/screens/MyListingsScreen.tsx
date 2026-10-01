import React, { useCallback, useState } from "react";
import { View, Text, RefreshControl } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { PackagePlus, BadgeCheck } from "lucide-react-native";
import { api, errorMessage, Listing } from "../api/client";
import { useAuth } from "../api/AuthContext";
import ProductGrid from "../components/ProductGrid";
import ListingCard from "../components/ListingCard";
import WebNavBar from "../components/WebNavBar";
import ScreenHeader from "../components/ScreenHeader";
import EmptyState from "../components/EmptyState";
import Tap from "../components/Tap";
import { useToast } from "../components/Toast";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { useResponsive, MAX_CONTENT_WIDTH } from "../hooks/useResponsive";

const TABS: Array<{ key: Listing["status"]; label: string }> = [
  { key: "ACTIVE", label: "Active" },
  { key: "RESERVED", label: "Reserved" },
  { key: "SOLD", label: "Sold" },
];

export default function MyListingsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<any>();
  const { isDesktopWeb, gutter, contentWidth } = useResponsive();
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [tab, setTab] = useState<Listing["status"]>("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setAllListings(await api.myListings(user.id));
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't load your listings."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, toast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Optimistic sold/active toggle straight from the grid.
  const toggleSold = async (listing: Listing) => {
    const next = listing.status === "ACTIVE" ? "SOLD" : "ACTIVE";
    setAllListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, status: next } : l)));
    try {
      await api.updateListingStatus(listing.id, user!.id, next);
      toast.success(next === "SOLD" ? `"${listing.title}" marked as sold.` : `"${listing.title}" is available again.`, {
        label: "Undo",
        onPress: () => restore(listing),
      });
    } catch (e) {
      setAllListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, status: listing.status } : l)));
      toast.error(errorMessage(e, "Couldn't update the listing."));
    }
  };

  // Undo puts the listing back exactly how it was (active, reserved or sold).
  const restore = async (listing: Listing) => {
    setAllListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, status: listing.status } : l)));
    await api.updateListingStatus(listing.id, user!.id, listing.status).catch(() => toast.error("Couldn't undo. Try again from the listing."));
  };

  const goToProduct = (l: Listing) => navigation.navigate("ProductDetail", { id: l.id });
  const listings = allListings.filter((l) => l.status === tab);

  const tabRow = (
    <View style={[styles.tabRow, { paddingHorizontal: isDesktopWeb ? 0 : gutter }]}>
      {TABS.map((t) => {
        const count = allListings.filter((l) => l.status === t.key).length;
        const active = tab === t.key;
        return (
          <Tap key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(t.key)} scaleTo={0.94}>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>
              {t.label} {loading ? "" : count}
            </Text>
          </Tap>
        );
      })}
    </View>
  );

  const empty =
    tab === "ACTIVE" ? (
      <EmptyState icon={PackagePlus} title="Nothing for sale yet" message="List something in under a minute. Buyers can message you straight away." actionLabel="List an item" onAction={() => navigation.navigate("Tabs", { screen: "SellTab" })} />
    ) : tab === "RESERVED" ? (
      <EmptyState icon={BadgeCheck} title="Nothing reserved" message="When you accept an offer, the item is reserved for that buyer and shows here." />
    ) : (
      <EmptyState icon={BadgeCheck} title="No sold items yet" message="Tap the tick on a listing once it's sold so buyers stop asking about it." />
    );

  const grid = (
    <ProductGrid
      data={listings}
      loading={loading}
      onPressItem={goToProduct}
      containerWidth={isDesktopWeb ? contentWidth : undefined}
      horizontalPadding={isDesktopWeb ? 0 : gutter}
      bottomPadding={spacing.xl}
      ListEmptyComponent={empty}
      renderCard={(l, width) => <ListingCard listing={l} width={width} onPress={() => goToProduct(l)} sellerView onToggleSold={() => toggleSold(l)} onEdit={() => navigation.navigate("EditListing", { id: l.id })} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    />
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar active="mylistings" />
        <View style={[styles.desktopColumn, { paddingHorizontal: gutter }]}>
          <Text style={styles.header}>My listings</Text>
          {tabRow}
          {grid}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="My listings" />
      {tabRow}
      {grid}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  desktopColumn: { maxWidth: MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center", paddingTop: spacing.lg, flex: 1 },
  header: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: spacing.md },
  tabRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  tab: { paddingHorizontal: spacing.md, height: 38, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.text, borderColor: colors.text },
  tabText: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.semibold },
  tabTextActive: { color: colors.inverseText },
}));
