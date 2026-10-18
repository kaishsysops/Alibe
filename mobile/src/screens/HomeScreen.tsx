import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { WifiOff, X, PackageOpen, Bell } from "lucide-react-native";
import { api, Category, Listing } from "../api/client";
import { StaticProductGrid } from "../components/ProductGrid";
import HomeRail from "../components/HomeRail";
import ContentCard from "../components/ContentCard";
import WebNavBar from "../components/WebNavBar";
import CategorySidebar, { SIDEBAR_WIDTH } from "../components/CategorySidebar";
import HomeSearchBar from "../components/HomeSearchBar";
import EmptyState from "../components/EmptyState";
import OrderNudge from "../components/OrderNudge";
import CategoryTile from "../components/CategoryTile";
import { CountBadge } from "../components/Badges";
import { useNotifications } from "../api/NotificationsContext";
import { getRecentlyViewed } from "../utils/recentlyViewed";
import Tap from "../components/Tap";
import { RailSkeleton, Skeleton, SkeletonGroup } from "../components/Skeleton";
import PullRefreshBadge, { usePullRefresh, invisibleRefreshProps } from "../components/PullToRefresh";
import { useAuth } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, tabBarClearance, fontSize, fontWeight } from "../theme/theme";
import { categoryIcons, AllCategoriesIcon } from "../theme/categoryIcons";
import { useResponsive, MAX_CONTENT_WIDTH } from "../hooks/useResponsive";

const HERO_IMAGE = "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1200&h=800&fit=crop&auto=format&q=75";
const SELL_IMAGE = "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=1000&h=600&fit=crop&auto=format&q=75";

export default function HomeScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useAuth();
  const { isDesktopWeb, width, gutter, contentWidth } = useResponsive();
  const [categories, setCategories] = useState<Category[]>([]);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { scrollY, onScroll } = usePullRefresh();
  const { data: notifications } = useNotifications();
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Recently viewed, refreshed whenever Home comes back into view.
  useFocusEffect(
    useCallback(() => {
      if (user) getRecentlyViewed(user.id).then((list) => setRecentIds(list.map((l) => l.id)));
    }, [user])
  );

  const loadAll = useCallback(async () => {
    try {
      const [cats, list] = await Promise.all([api.categories(), api.listings({})]);
      setCategories(cats);
      setAllListings(list);
      setFailed(false);
    } catch {
      setFailed(true);
      // Content already on screen stays; only a cold start shows the error page.
      setAllListings((prev) => {
        if (prev.length) toast.error("Couldn't refresh. Showing what we had.");
        return prev;
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const goToProduct = (l: Listing) => navigation.navigate("ProductDetail", { id: l.id });
  const goToSearch = (params: Record<string, string | undefined>) => navigation.navigate("SearchTab", params);
  const seeAllInCategory = (c: Category) => goToSearch({ categorySlug: c.slug, categoryName: c.name });

  const railsByCategory = useMemo(
    () =>
      categories
        .map((c) => ({ category: c, items: allListings.filter((l) => l.category.slug === c.slug).slice(0, 12) }))
        .filter((r) => r.items.length > 0)
        .sort((a, b) => b.items.length - a.items.length),
    [categories, allListings]
  );

  // Mobile category grid: 4 square tiles per row, two rows max.
  const categoryTile = Math.floor((width - gutter * 2 - spacing.sm * 3) / 4);
  // Newest photo in each category (listings arrive newest first).
  const categoryPhoto = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of allListings) if (l.images[0] && !map.has(l.category.slug)) map.set(l.category.slug, l.images[0]);
    return map;
  }, [allListings]);
  const hasMoreCategories = categories.length > 8;
  const gridCategories = hasMoreCategories ? categories.slice(0, 7) : categories;

  // Use the live listing (current price/status) and drop anything sold or removed.
  const recentlyViewed = useMemo(() => {
    const byId = new Map(allListings.map((l) => [l.id, l]));
    return recentIds.map((id) => byId.get(id)).filter((l): l is Listing => !!l && l.status === "ACTIVE");
  }, [recentIds, allListings]);

  const filtered = activeSlug ? allListings.filter((l) => l.category.slug === activeSlug) : [];
  const activeCategory = categories.find((c) => c.slug === activeSlug);
  const firstName = user?.name?.split(" ")[0];

  if (!loading && failed && !allListings.length) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {isDesktopWeb && <WebNavBar active="home" />}
        <EmptyState
          icon={WifiOff}
          tone="error"
          title="You're offline"
          message="We couldn't load listings. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => {
            setLoading(true);
            loadAll();
          }}
        />
      </View>
    );
  }

  const noListings = !loading && !allListings.length;
  const emptyMarket = (
    <EmptyState
      icon={PackageOpen}
      title="No listings yet"
      message="Be the first to sell something on Alibe."
      actionLabel="List an item"
      onAction={() => navigation.navigate("SellTab")}
    />
  );

  // Desktop web
  if (isDesktopWeb) {
    const gridWidth = contentWidth - SIDEBAR_WIDTH - spacing.lg;
    return (
      <View style={styles.container}>
        <WebNavBar active="home" />
        <ScrollView>
          <View style={[styles.desktopColumn, { paddingHorizontal: gutter }]}>
            <View style={styles.banner}>
              <View style={styles.bannerText}>
                <Text style={styles.bannerTitle}>{firstName ? `Welcome back, ${firstName}.` : "Buy and sell across every atoll."}</Text>
                <Text style={styles.bannerSubtitle}>Fresh listings from Malé to Addu, with chat, WhatsApp and Viber built in.</Text>
                <View style={styles.bannerActions}>
                  <Tap style={styles.bannerPrimary} onPress={() => goToSearch({})}>
                    <Text style={styles.bannerPrimaryText}>Browse listings</Text>
                  </Tap>
                  <Tap style={styles.bannerSecondary} onPress={() => navigation.navigate("SellTab")}>
                    <Text style={styles.bannerSecondaryText}>Sell an item</Text>
                  </Tap>
                </View>
              </View>
              <Image source={{ uri: HERO_IMAGE }} style={styles.bannerImage} />
            </View>
            <OrderNudge style={{ marginBottom: spacing.lg }} />

            <View style={{ flexDirection: "row" }}>
              {loading ? (
                <SkeletonGroup>
                  <View style={{ width: SIDEBAR_WIDTH, marginRight: spacing.lg, gap: spacing.sm }}>
                    {Array.from({ length: 9 }).map((_, i) => (
                      <Skeleton key={i} height={36} rounded={radius.sm} />
                    ))}
                  </View>
                </SkeletonGroup>
              ) : (
                <CategorySidebar categories={categories} active={activeSlug} onSelect={setActiveSlug} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                {activeCategory ? (
                  <>
                    <View style={styles.filterRow}>
                      <Text style={styles.sectionTitle}>{activeCategory.name}</Text>
                      <Tap style={styles.clearFilter} onPress={() => setActiveSlug(undefined)}>
                        <X size={14} color={colors.textMuted} />
                        <Text style={styles.clearFilterText}>Clear</Text>
                      </Tap>
                    </View>
                    <StaticProductGrid data={filtered} onPressItem={goToProduct} containerWidth={gridWidth} horizontalPadding={0} />
                  </>
                ) : loading ? (
                  <>
                    <RailSkeleton horizontalPadding={0} cardWidth={180} />
                    <RailSkeleton horizontalPadding={0} cardWidth={180} />
                  </>
                ) : noListings ? (
                  emptyMarket
                ) : (
                  <>
                    {railsByCategory.slice(0, 3).map(({ category, items }) => (
                      <HomeRail
                        key={category.id}
                        title={category.name}
                        data={items}
                        onPressItem={goToProduct}
                        onSeeAll={() => seeAllInCategory(category)}
                        horizontalPadding={0}
                        cardWidth={180}
                      />
                    ))}
                    <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Fresh listings</Text>
                    <StaticProductGrid data={allListings.slice(0, 24)} onPressItem={goToProduct} containerWidth={gridWidth} horizontalPadding={0} />
                  </>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Mobile / native
  return (
    <View style={styles.container}>
      <PullRefreshBadge scrollY={scrollY} refreshing={refreshing} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadAll();
            }}
            {...invisibleRefreshProps}
          />
        }
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: tabBarClearance }}
      >
        <View style={[styles.hero, { paddingTop: insets.top + spacing.sm, paddingHorizontal: gutter }]}>
          <View style={styles.heroTopRow}>
            <Text style={styles.wordmark}>Alibe</Text>
            <View style={styles.heroActions}>
            <Tap style={styles.bell} onPress={() => navigation.navigate("Notifications")} scaleTo={0.88} accessibilityLabel={`Notifications${notifications.total ? `, ${notifications.total} new` : ""}`}>
              <Bell size={20} color={colors.text} />
              <CountBadge count={notifications.total} style={styles.bellBadge} />
            </Tap>
            <Tap
              style={[styles.avatar, { backgroundColor: user?.avatarColor ?? colors.primary }]}
              onPress={() => navigation.navigate("ProfileTab")}
              accessibilityLabel="Your profile"
              scaleTo={0.9}
            >
              <Text style={styles.avatarText}>{(user?.name ?? "?").charAt(0).toUpperCase()}</Text>
            </Tap>
            </View>
          </View>
          <HomeSearchBar onSubmit={(q) => goToSearch({ q })} />
          <OrderNudge style={{ marginTop: spacing.md }} />
        </View>

        {/* All categories at a glance, 4 per row, each showing a real photo
            from that category; past 8, the last tile becomes "More". */}
        <View style={[styles.categoryGrid, { paddingHorizontal: gutter }]}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} width={categoryTile} height={categoryTile} rounded={radius.md} />)
            : [
                ...gridCategories.map((c) => ({ key: c.id, name: c.name, slug: c.slug, onPress: () => seeAllInCategory(c) })),
                ...(hasMoreCategories ? [{ key: "more", name: "More", slug: "", onPress: () => goToSearch({}) }] : []),
              ].map((c) => {
                const meta = categoryIcons[c.slug];
                return (
                  <CategoryTile
                    key={c.key}
                    name={c.name}
                    image={categoryPhoto.get(c.slug)}
                    Icon={meta?.Icon ?? AllCategoriesIcon}
                    color={meta?.color ?? colors.primary}
                    size={categoryTile}
                    onPress={c.onPress}
                  />
                );
              })}
        </View>

        {loading ? (
          <>
            <RailSkeleton horizontalPadding={gutter} />
            <RailSkeleton horizontalPadding={gutter} />
          </>
        ) : noListings ? (
          emptyMarket
        ) : (
          <>
            {recentlyViewed.length >= 2 && (
              <HomeRail title="Recently viewed" data={recentlyViewed.slice(0, 12)} onPressItem={goToProduct} horizontalPadding={gutter} />
            )}
            {railsByCategory.map(({ category, items }, i) => (
              <React.Fragment key={category.id}>
                <HomeRail title={category.name} data={items} onPressItem={goToProduct} onSeeAll={() => seeAllInCategory(category)} horizontalPadding={gutter} />
                {i === 0 && (
                  <ContentCard
                    title="Sell it this afternoon"
                    subtitle="Add a photo and a price. Buyers can reach you right away."
                    ctaLabel="Start selling"
                    image={SELL_IMAGE}
                    onPress={() => navigation.navigate("SellTab")}
                    horizontalPadding={gutter}
                  />
                )}
                {i === 2 && railsByCategory[3] && (
                  <ContentCard
                    title={railsByCategory[3].category.name}
                    subtitle={`${railsByCategory[3].items.length}+ listings across the islands`}
                    ctaLabel="Explore"
                    image={railsByCategory[3].items[0]?.images[0]}
                    onPress={() => seeAllInCategory(railsByCategory[3].category)}
                    horizontalPadding={gutter}
                  />
                )}
              </React.Fragment>
            ))}
            <Text style={[styles.sectionTitle, { paddingHorizontal: gutter, marginTop: spacing.sm }]}>Fresh listings</Text>
            <StaticProductGrid data={allListings.slice(0, 20)} onPressItem={goToProduct} containerWidth={width} horizontalPadding={gutter} />
            <Tap style={[styles.moreButton, { marginHorizontal: gutter }]} onPress={() => goToSearch({})}>
              <Text style={styles.moreButtonText}>See all {allListings.length} listings</Text>
            </Tap>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  desktopColumn: { maxWidth: MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center", paddingTop: spacing.lg, paddingBottom: spacing.xl * 2 },
  banner: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.lg,
    minHeight: 260,
  },
  bannerText: { flex: 1, padding: spacing.xl, justifyContent: "center" },
  bannerTitle: { fontSize: 36, fontWeight: fontWeight.extrabold, color: colors.text, letterSpacing: -0.8, lineHeight: 42, maxWidth: 480 },
  bannerSubtitle: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.sm, maxWidth: 420, lineHeight: fontSize.md * 1.45 },
  bannerActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  bannerPrimary: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 4 },
  bannerPrimaryText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.base },
  bannerSecondary: { backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 4 },
  bannerSecondaryText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.base },
  bannerImage: { width: "42%", minHeight: 260 },
  hero: { paddingBottom: spacing.md },
  heroActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bell: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  bellBadge: { position: "absolute", top: -4, right: -4 },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  wordmark: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.primary, letterSpacing: -0.5 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: fontWeight.extrabold, fontSize: fontSize.base },
  greeting: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.md, letterSpacing: -0.3 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.lg },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: spacing.sm + 2 },
  filterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clearFilter: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: spacing.sm + 2, borderRadius: radius.pill, backgroundColor: colors.card },
  clearFilterText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  moreButton: { alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  moreButtonText: { color: colors.text, fontWeight: fontWeight.bold, fontSize: fontSize.base },
}));
