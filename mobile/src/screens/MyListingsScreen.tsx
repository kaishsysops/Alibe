import React, { useCallback, useState } from "react";
import { View, Text, RefreshControl, ScrollView } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { PackagePlus, BadgeCheck, Clock, AlertCircle, Eye, Heart, ArrowUpCircle } from "lucide-react-native";
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
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";
import { useResponsive, MAX_CONTENT_WIDTH } from "../hooks/useResponsive";
import PremiumPromo from "../components/PremiumPromo";
import FirstTimeTip from "../components/FirstTimeTip";

type TabKey = "ACTIVE" | "REVIEW" | "RESERVED" | "SOLD";
const TABS: Array<{ key: TabKey; label: string; statuses: Listing["status"][] }> = [
  { key: "ACTIVE", label: "For sale", statuses: ["ACTIVE"] },
  { key: "REVIEW", label: "In review", statuses: ["PENDING", "REJECTED"] },
  { key: "RESERVED", label: "Reserved", statuses: ["RESERVED"] },
  { key: "SOLD", label: "Sold", statuses: ["SOLD"] },
];

export default function MyListingsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<any>();
  const { isDesktopWeb, gutter, contentWidth } = useResponsive();
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [tab, setTab] = useState<TabKey>("ACTIVE");
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

  // Premium: back to the top of "newest" (once a day per item).
  const bump = async (l: Listing) => {
    try {
      await api.bumpListing(l.id);
      toast.success(`"${l.title}" is back at the top.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const goToProduct = (l: Listing) => navigation.navigate("ProductDetail", { id: l.id });
  const current = TABS.find((t) => t.key === tab)!;
  const listings = allListings.filter((l) => current.statuses.includes(l.status));
  const rejected = allListings.filter((l) => l.status === "REJECTED");
  const soldValue = allListings.filter((l) => l.status === "SOLD").reduce((n, l) => n + l.price, 0);
  const forSale = allListings.filter((l) => l.status === "ACTIVE").length;

  const tabRow = (
    <View style={{ paddingHorizontal: isDesktopWeb ? 0 : gutter, gap: spacing.sm + 4, marginBottom: spacing.sm }}>
      {!loading && allListings.length > 0 && (
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{forSale}</Text>
            <Text style={styles.statLabel}>For sale</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{allListings.filter((l) => l.status === "SOLD").length}</Text>
            <Text style={styles.statLabel}>Sold</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue} numberOfLines={1}>
              {soldValue >= 10000 ? `${Math.round(soldValue / 1000)}k` : soldValue.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>MVR sold</Text>
          </View>
        </View>
      )}
      <FirstTimeTip id="mylistings" title="Managing your listings" text="Tap the tick on an item once it's sold so buyers stop asking, or the pencil to edit it. Posts our team is checking show under In review." topic="selling" />
      {!loading && allListings.length > 0 && <PremiumPromo variant="banner" />}
      {rejected.length > 0 && tab !== "REVIEW" && (
        <Tap style={styles.alert} onPress={() => setTab("REVIEW")} scaleTo={0.98}>
          <AlertCircle size={18} color={colors.danger} />
          <Text style={styles.alertText}>
            {rejected.length === 1 ? "1 post wasn't approved." : `${rejected.length} posts weren't approved.`} See why and fix it.
          </Text>
        </Tap>
      )}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
      {TABS.map((t) => {
        const count = allListings.filter((l) => t.statuses.includes(l.status)).length;
        if (t.key === "REVIEW" && !count) return null;
        const active = tab === t.key;
        return (
          <Tap key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(t.key)} scaleTo={0.94}>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>
              {t.label} {loading ? "" : count}
            </Text>
          </Tap>
        );
      })}
    </ScrollView>
    </View>
  );

  const empty =
    tab === "ACTIVE" ? (
      <EmptyState icon={PackagePlus} title="Nothing for sale yet" message="List something in under a minute. Buyers can message you straight away." actionLabel="List an item" onAction={() => navigation.navigate("Tabs", { screen: "SellTab" })} />
    ) : tab === "REVIEW" ? (
      <EmptyState icon={Clock} title="Nothing waiting" message="Posts from sellers who aren't verified are checked by our team before going live." actionLabel="Get verified" onAction={() => navigation.navigate("Verify")} />
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
      renderCard={(l, width) => (
        <View style={{ width }}>
          <ListingCard listing={l} width={width} onPress={() => goToProduct(l)} sellerView onToggleSold={() => toggleSold(l)} onEdit={() => navigation.navigate("EditListing", { id: l.id })} />
          {l.status === "REJECTED" && (
            <Tap style={styles.reason} onPress={() => navigation.navigate("EditListing", { id: l.id })} scaleTo={0.98}>
              <Text style={styles.reasonText} numberOfLines={3}>
                {l.rejectReason ?? "Not approved."}
              </Text>
              <Text style={styles.reasonAction}>Edit and resend</Text>
            </Tap>
          )}
          {l.status === "PENDING" && <Text style={styles.pendingText}>Our team is checking it</Text>}
          {l.stats && (
            <View style={styles.statsRow}>
              <Eye size={13} color={colors.textMuted} />
              <Text style={styles.statsText}>{l.stats.views}</Text>
              <Heart size={13} color={colors.textMuted} />
              <Text style={styles.statsText}>{l.stats.saves}</Text>
              {l.status === "ACTIVE" && (
                <Tap style={styles.bump} onPress={() => bump(l)} scaleTo={0.94} accessibilityLabel="Bump to the top">
                  <ArrowUpCircle size={13} color={colors.gold} />
                  <Text style={styles.bumpText}>Bump</Text>
                </Tap>
              )}
            </View>
          )}
        </View>
      )}
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
  tabRow: { flexDirection: "row", gap: spacing.sm },
  stats: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: spacing.md, ...cardShadow },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  statLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.textMuted },
  statDivider: { width: 1, height: 30, backgroundColor: colors.border },
  alert: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm + 4, borderRadius: radius.md, backgroundColor: `${colors.danger}12` },
  alertText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  reason: { marginTop: -spacing.sm, marginBottom: spacing.md, padding: spacing.sm + 2, borderRadius: radius.md, backgroundColor: `${colors.danger}10`, gap: 4 },
  reasonText: { fontSize: fontSize.caption, color: colors.text, lineHeight: 16 },
  reasonAction: { fontSize: fontSize.caption, fontWeight: fontWeight.extrabold, color: colors.danger },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: -spacing.sm, marginBottom: spacing.md },
  statsText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.textMuted, marginRight: 6 },
  bump: { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: "auto", paddingHorizontal: 8, height: 24, borderRadius: 12, backgroundColor: `${colors.gold}1F` },
  bumpText: { fontSize: fontSize.caption, fontWeight: fontWeight.extrabold, color: colors.gold },
  pendingText: { marginTop: -spacing.sm, marginBottom: spacing.md, fontSize: fontSize.caption, color: colors.textMuted, fontWeight: fontWeight.semibold },
  tab: { paddingHorizontal: spacing.md, height: 38, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.text, borderColor: colors.text },
  tabText: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.semibold },
  tabTextActive: { color: colors.inverseText },
}));
