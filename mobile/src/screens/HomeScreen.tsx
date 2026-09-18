import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ShoppingBag, X } from "lucide-react-native";
import { api, Category, Listing } from "../api/client";
import ProductGrid, { StaticProductGrid } from "../components/ProductGrid";
import HomeRail from "../components/HomeRail";
import WebNavBar from "../components/WebNavBar";
import CategorySidebar from "../components/CategorySidebar";
import HomeSearchBar from "../components/HomeSearchBar";
import { colors, spacing, radius } from "../theme/theme";
import { categoryIcons, AllCategoriesIcon } from "../theme/categoryIcons";
import { useResponsive } from "../hooks/useResponsive";

const SIDEBAR_WIDTH = 220;
const MAX_CONTENT_WIDTH = 1400;

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { isDesktopWeb, width } = useResponsive();
  const [categories, setCategories] = useState<Category[]>([]);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [cats, list] = await Promise.all([api.categories(), api.listings({})]);
      setCategories(cats);
      setAllListings(list);
    } catch (e) {
      setError("Can't reach the Alibe backend. Is docker compose up?");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onSelectCategory = async (category: Category | undefined) => {
    setActiveCategory(category);
    if (!category) return;
    setLoading(true);
    try {
      const list = await api.listings({ categorySlug: category.slug });
      setFilteredListings(list);
    } finally {
      setLoading(false);
    }
  };

  const goToProduct = (l: Listing) => navigation.navigate("ProductDetail", { id: l.id });
  const goToSearch = (q: string) => navigation.navigate("SearchTab", { q });
  const seeAllInCategory = (category: Category) => navigation.navigate("SearchTab", { categorySlug: category.slug, categoryName: category.name });

  const railsByCategory = useMemo(() => {
    return categories
      .map((c) => ({ category: c, items: allListings.filter((l) => l.category.slug === c.slug).slice(0, 10) }))
      .filter((r) => r.items.length > 0);
  }, [categories, allListings]);

  const hero = (
    <View style={styles.hero}>
      <View style={styles.heroTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Buy & sell across every atoll</Text>
          <Text style={styles.heroSubtitle}>Structured categories · Verified sellers · No more flat feeds</Text>
        </View>
        <View style={styles.heroBadge}>
          <ShoppingBag size={26} color="rgba(255,255,255,0.5)" />
        </View>
      </View>
      <HomeSearchBar onSubmit={(q) => q.trim() && goToSearch(q.trim())} style={styles.heroSearchBar} />
    </View>
  );

  const categoryRail = (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoryRail}
      contentContainerStyle={{ paddingHorizontal: spacing.md }}
      data={categories}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => {
        const cat = categoryIcons[item.slug];
        const Icon = cat?.Icon ?? AllCategoriesIcon;
        return (
          <TouchableOpacity style={styles.categoryItem} onPress={() => onSelectCategory(item)}>
            <View style={[styles.categoryCircle, { backgroundColor: cat ? cat.color : colors.primary }]}>
              <Icon size={22} color="#fff" />
            </View>
            <Text style={styles.categoryLabel} numberOfLines={1}>
              {item.name}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );

  if (loading && !allListings.length) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Desktop web
  if (isDesktopWeb) {
    const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - spacing.xl * 2;
    const gridWidth = contentWidth - SIDEBAR_WIDTH;

    return (
      <View style={styles.desktopContainer}>
        <WebNavBar active="home" onSearch={goToSearch} />
        <ScrollView>
          <View style={{ flexDirection: "row", maxWidth: MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl }}>
            <CategorySidebar categories={categories} active={activeCategory?.slug} onSelect={(slug) => onSelectCategory(categories.find((c) => c.slug === slug))} />
            <View style={{ flex: 1 }}>
              <View style={styles.promoBanner}>
                <View>
                  <Text style={styles.promoTitle}>Buy & sell across every atoll</Text>
                  <Text style={styles.promoSubtitle}>Structured categories. Verified sellers. No more scrolling a flat feed.</Text>
                </View>
                <ShoppingBag size={56} color="rgba(255,255,255,0.35)" />
              </View>

              {activeCategory ? (
                <>
                  <View style={styles.categoryFilterRow}>
                    <Text style={styles.sectionTitle}>{activeCategory.name}</Text>
                    <TouchableOpacity style={styles.clearFilter} onPress={() => onSelectCategory(undefined)}>
                      <X size={13} color={colors.textMuted} />
                      <Text style={styles.clearFilterText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                  {loading ? (
                    <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
                  ) : (
                    <ProductGrid
                      data={filteredListings}
                      onPressItem={goToProduct}
                      containerWidth={gridWidth}
                      horizontalPadding={0}
                      ListEmptyComponent={<Text style={styles.empty}>No listings yet in this category.</Text>}
                    />
                  )}
                </>
              ) : (
                <>
                  {railsByCategory.map(({ category, items }) => (
                    <HomeRail
                      key={category.id}
                      title={category.name}
                      data={items}
                      onPressItem={goToProduct}
                      onSeeAll={() => seeAllInCategory(category)}
                      horizontalPadding={0}
                    />
                  ))}
                  <Text style={styles.sectionTitle}>More to explore</Text>
                  <StaticProductGrid
                    data={allListings}
                    onPressItem={goToProduct}
                    containerWidth={gridWidth}
                    horizontalPadding={0}
                    emptyText="No listings yet."
                  />
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Mobile / native
  if (activeCategory) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.categoryFilterRow}>
          <Text style={styles.sectionTitle}>{activeCategory.name}</Text>
          <TouchableOpacity style={styles.clearFilter} onPress={() => onSelectCategory(undefined)}>
            <X size={13} color={colors.textMuted} />
            <Text style={styles.clearFilterText}>Clear</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
        ) : (
          <ProductGrid
            data={filteredListings}
            onPressItem={goToProduct}
            ListEmptyComponent={<Text style={styles.empty}>No listings yet in this category.</Text>}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} />}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      >
        {hero}
        {categoryRail}
        {railsByCategory.map(({ category, items }) => (
          <HomeRail
            key={category.id}
            title={category.name}
            data={items}
            onPressItem={goToProduct}
            onSeeAll={() => seeAllInCategory(category)}
          />
        ))}
        <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.md }]}>More to explore</Text>
        <StaticProductGrid data={allListings} onPressItem={goToProduct} containerWidth={width} emptyText="No listings yet." />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  desktopContainer: { flex: 1, backgroundColor: colors.background },
  promoBanner: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  promoTitle: { fontSize: 24, fontWeight: "800", color: "#fff", maxWidth: 420 },
  promoSubtitle: { fontSize: 13, color: "#FFE8D6", marginTop: spacing.xs, maxWidth: 420 },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + spacing.md,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  heroTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#fff", lineHeight: 27 },
  heroSubtitle: { fontSize: 12, color: "#FFE8D6", marginTop: 4 },
  heroBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroSearchBar: { marginTop: spacing.lg },
  categoryRail: { flexGrow: 0, marginTop: spacing.md, marginBottom: spacing.md },
  categoryItem: { alignItems: "center", width: 64, marginRight: spacing.sm },
  categoryCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  categoryLabel: { fontSize: 10.5, color: colors.textMuted, marginTop: spacing.xs, textAlign: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: spacing.sm },
  categoryFilterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  clearFilter: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: spacing.sm },
  clearFilterText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  errorText: { color: colors.danger, textAlign: "center" },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
});
