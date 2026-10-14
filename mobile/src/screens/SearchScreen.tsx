import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Search as SearchIcon, X, SlidersHorizontal, SearchX, ChevronDown, BellPlus, BellRing } from "lucide-react-native";
import { api, Atoll, Category, DeliveryOption, errorMessage, Listing, ListingSort } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useSingleFlight } from "../hooks/useSingleFlight";
import ProductGrid from "../components/ProductGrid";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import Tap from "../components/Tap";
import { useToast } from "../components/Toast";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, conditionColors, cardShadow, fontSize, fontWeight } from "../theme/theme";
import { categoryIcons, AllCategoriesIcon } from "../theme/categoryIcons";
import { useResponsive, MAX_CONTENT_WIDTH } from "../hooks/useResponsive";

const CONDITIONS: Array<Listing["condition"]> = ["NEW", "LIKE_NEW", "GOOD", "FAIR"];
const SORTS: Array<{ key: ListingSort; label: string }> = [
  { key: "newest", label: "Newest" },
  { key: "price_asc", label: "Lowest price" },
  { key: "price_desc", label: "Highest price" },
];
const DELIVERIES: Array<{ key: DeliveryOption; label: string }> = [
  { key: "PICKUP", label: "Pickup" },
  { key: "FERRY", label: "Ferry" },
  { key: "COURIER", label: "Courier" },
];
const FILTER_PANEL_WIDTH = 280;
const DEBOUNCE_MS = 350;

const conditionLabel = (c: string) => c.replace("_", " ").toLowerCase().replace(/^\w/, (m) => m.toUpperCase());

function Chip({ label, active, onPress, activeColor }: { label: string; active: boolean; onPress: () => void; activeColor?: string }) {
  const styles = useStyles();
  return (
    <Tap style={[styles.chip, active && styles.chipActive, active && activeColor ? { backgroundColor: activeColor, borderColor: activeColor } : null]} onPress={onPress} scaleTo={0.92}>
      <Text style={[styles.chipText, active && styles.chipTextActive, active && activeColor ? { color: "#fff" } : null]}>{label}</Text>
    </Tap>
  );
}

export default function SearchScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { isDesktopWeb, gutter, contentWidth, width } = useResponsive();

  const [query, setQuery] = useState<string>(route.params?.q ?? "");
  const [categorySlug, setCategorySlug] = useState<string | undefined>(route.params?.categorySlug);
  const [categories, setCategories] = useState<Category[]>([]);
  const [atolls, setAtolls] = useState<Atoll[]>([]);
  const [atollId, setAtollId] = useState<string | undefined>();
  const [condition, setCondition] = useState<Listing["condition"] | undefined>();
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<ListingSort>("newest");
  const [delivery, setDelivery] = useState<DeliveryOption | undefined>();
  // Key of the filter combination the user last saved, so the button can
  // show "Saved" until they change something.
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const { user } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [results, setResults] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const activeFilterCount = (atollId ? 1 : 0) + (condition ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (delivery ? 1 : 0);
  const isBrowsing = !query.trim() && !categorySlug && activeFilterCount === 0;

  useEffect(() => {
    api.categories().then(setCategories).catch(() => {});
    api.atolls().then(setAtolls).catch(() => {});
  }, []);

  // New params arrive when Home's "See all" or a category tile is tapped
  // while this tab is already mounted.
  useEffect(() => {
    const p = route.params;
    if (!p) return;
    if (p.q !== undefined) setQuery(p.q);
    if ("categorySlug" in p) setCategorySlug(p.categorySlug);
    // Opening a saved search restores every filter it was saved with.
    if (p.fromSaved) {
      setAtollId(p.atollId);
      setCondition(p.condition);
      setMinPrice(p.minPrice ?? "");
      setMaxPrice(p.maxPrice ?? "");
      setDelivery(p.delivery);
      setQuery(p.q ?? "");
    }
  }, [route.params]);

  const runSearch = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const list = await api.listings({
        q: query.trim() || undefined,
        atollId,
        categorySlug,
        condition,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        delivery,
        sort,
      });
      // Ignore responses for searches the user has already typed past.
      if (id === requestId.current) setResults(list);
    } catch {
      if (id === requestId.current) toast.error("Couldn't load results. Pull down to try again.");
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [query, atollId, categorySlug, condition, minPrice, maxPrice, delivery, sort, toast]);

  // Search as you type, debounced; filter taps apply immediately.
  const lastQuery = useRef(query);
  useEffect(() => {
    setLoading(true);
    const typing = lastQuery.current !== query;
    lastQuery.current = query;
    const t = setTimeout(runSearch, typing ? DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
  }, [runSearch, query]);

  const clearAll = () => {
    setQuery("");
    setCategorySlug(undefined);
    setAtollId(undefined);
    setCondition(undefined);
    setMinPrice("");
    setMaxPrice("");
    setDelivery(undefined);
    setSort("newest");
    navigation.setParams({ q: undefined, categorySlug: undefined, categoryName: undefined });
  };

  const currentFilters = {
    q: query.trim() || undefined,
    categorySlug,
    atollId,
    condition,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
    delivery,
  };
  const filtersKey = JSON.stringify(currentFilters);
  const isSaved = savedKey === filtersKey;
  const [saveSearch, saving] = useSingleFlight(async () => {
    if (!user || isSaved) return;
    const atoll = atolls.find((a) => a.id === atollId);
    const what = query.trim() ? `"${query.trim()}"` : categories.find((c) => c.slug === categorySlug)?.name ?? "New listings";
    const label = atoll ? `${what} in ${atoll.name}` : what;
    setSavedKey(filtersKey);
    try {
      await api.saveSearch(user.id, label, currentFilters);
      toast.success("Saved. We'll let you know when new matches appear.", { label: "View", onPress: () => navigation.navigate("SavedSearches") });
    } catch (e) {
      setSavedKey(null);
      toast.error(errorMessage(e, "Couldn't save this search. Please try again."));
    }
  });

  const goToProduct = (l: Listing) => navigation.navigate("ProductDetail", { id: l.id });
  const activeCategory = categories.find((c) => c.slug === categorySlug);

  const searchBar = (
    <View style={styles.searchBar}>
      <SearchIcon size={18} color={colors.textMuted} />
      <TextInput
        style={styles.input}
        placeholder="Search Alibe"
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel="Search listings"
      />
      {query.length > 0 && (
        <Tap style={styles.clearInput} onPress={() => setQuery("")} hitSlop={10} scaleTo={0.85} accessibilityLabel="Clear search">
          <X size={14} color={colors.textMuted} strokeWidth={2.6} />
        </Tap>
      )}
    </View>
  );

  const categoryChips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: isDesktopWeb ? 0 : gutter }} keyboardShouldPersistTaps="handled">
      <Chip label="All" active={!categorySlug} onPress={() => setCategorySlug(undefined)} />
      {categories.map((c) => (
        <Chip key={c.id} label={c.name} active={categorySlug === c.slug} onPress={() => setCategorySlug(categorySlug === c.slug ? undefined : c.slug)} />
      ))}
    </ScrollView>
  );

  const filterControls = (
    <View style={{ gap: spacing.md }}>
      <View>
        <Text style={styles.filterLabel}>Sort by</Text>
        <View style={styles.wrapRow}>
          {SORTS.map((s) => (
            <Chip key={s.key} label={s.label} active={sort === s.key} onPress={() => setSort(s.key)} />
          ))}
        </View>
      </View>
      <View>
        <Text style={styles.filterLabel}>Location</Text>
        <View style={styles.wrapRow}>
          <Chip label="Anywhere" active={!atollId} onPress={() => setAtollId(undefined)} />
          {atolls.map((a) => (
            <Chip key={a.id} label={a.name} active={atollId === a.id} onPress={() => setAtollId(atollId === a.id ? undefined : a.id)} />
          ))}
        </View>
      </View>
      <View>
        <Text style={styles.filterLabel}>Condition</Text>
        <View style={styles.wrapRow}>
          {CONDITIONS.map((c) => (
            <Chip key={c} label={conditionLabel(c)} active={condition === c} activeColor={conditionColors[c]} onPress={() => setCondition(condition === c ? undefined : c)} />
          ))}
        </View>
      </View>
      <View>
        <Text style={styles.filterLabel}>Price (MVR)</Text>
        <View style={styles.priceRow}>
          <TextInput style={styles.priceInput} placeholder="Min" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={minPrice} onChangeText={(t) => setMinPrice(t.replace(/\D/g, ""))} accessibilityLabel="Minimum price" />
          <Text style={styles.priceDash}>to</Text>
          <TextInput style={styles.priceInput} placeholder="Max" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={maxPrice} onChangeText={(t) => setMaxPrice(t.replace(/\D/g, ""))} accessibilityLabel="Maximum price" />
        </View>
      </View>
      <View>
        <Text style={styles.filterLabel}>Delivery</Text>
        <View style={styles.wrapRow}>
          <Chip label="Any" active={!delivery} onPress={() => setDelivery(undefined)} />
          {DELIVERIES.map((d) => (
            <Chip key={d.key} label={d.label} active={delivery === d.key} onPress={() => setDelivery(delivery === d.key ? undefined : d.key)} />
          ))}
        </View>
      </View>
      {(activeFilterCount > 0 || sort !== "newest") && (
        <Tap style={styles.resetButton} onPress={clearAll}>
          <Text style={styles.resetText}>Reset all</Text>
        </Tap>
      )}
    </View>
  );

  // Category tiles: shown while the user is browsing rather than searching.
  const tileColumns = isDesktopWeb ? 4 : width >= 600 ? 4 : 2;
  const tileAreaWidth = isDesktopWeb ? contentWidth - FILTER_PANEL_WIDTH - spacing.lg : width - gutter * 2;
  const tileWidth = Math.floor((tileAreaWidth - spacing.sm * (tileColumns - 1)) / tileColumns);
  const categoryTiles = (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.sectionTitle}>Browse categories</Text>
      <View style={styles.tileGrid}>
        {categories.map((c) => {
          const meta = categoryIcons[c.slug];
          const Icon = meta?.Icon ?? AllCategoriesIcon;
          const tint = meta?.color ?? colors.primary;
          return (
            <Tap key={c.id} style={[styles.tile, { width: tileWidth, backgroundColor: `${tint}12` }]} onPress={() => setCategorySlug(c.slug)} scaleTo={0.95}>
              <View style={[styles.tileIcon, { backgroundColor: `${tint}22` }]}>
                <Icon size={20} color={tint} strokeWidth={2} />
              </View>
              <Text style={styles.tileName} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.tileCount}>{c.listingCount ?? 0} listings</Text>
            </Tap>
          );
        })}
      </View>
    </View>
  );

  const resultsHeader = (
    <View style={{ paddingHorizontal: isDesktopWeb ? 0 : gutter }}>
      {isBrowsing && categories.length > 0 && categoryTiles}
      <View style={styles.resultsRow}>
        <Text style={styles.sectionTitle}>
          {isBrowsing ? "Latest listings" : activeCategory && !query.trim() ? activeCategory.name : query.trim() ? `Results for "${query.trim()}"` : "Results"}
        </Text>
        {!loading && <Text style={styles.resultsCount}>{results.length} found</Text>}
      </View>
      {!isBrowsing && (
        <Tap style={[styles.saveSearch, isSaved && styles.saveSearchDone]} onPress={saveSearch} disabled={saving || isSaved} scaleTo={0.96}>
          {isSaved ? <BellRing size={16} color={colors.success} /> : <BellPlus size={16} color={colors.primary} />}
          <Text style={[styles.saveSearchText, isSaved && { color: colors.success }]}>{isSaved ? "Saved. We'll alert you to new matches" : "Alert me when new matches appear"}</Text>
        </Tap>
      )}
    </View>
  );

  const empty = (
    <EmptyState
      icon={SearchX}
      title="No matches"
      message={query.trim() ? `Nothing for "${query.trim()}" yet. Try another word or widen your filters.` : "Nothing matches these filters. Try widening them."}
      actionLabel="Clear search and filters"
      onAction={clearAll}
    />
  );

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        runSearch();
      }}
      tintColor={colors.primary}
      colors={[colors.primary]}
    />
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar active="search" onSearch={setQuery} />
        <View style={[styles.desktopColumn, { paddingHorizontal: gutter }]}>
          <View style={styles.desktopTop}>
            <View style={{ width: FILTER_PANEL_WIDTH }}>{searchBar}</View>
            <View style={{ flex: 1, minWidth: 0 }}>{categoryChips}</View>
          </View>
          <View style={{ flexDirection: "row", flex: 1, gap: spacing.lg }}>
            <ScrollView style={{ width: FILTER_PANEL_WIDTH, flexGrow: 0 }} contentContainerStyle={styles.filterCard}>
              {filterControls}
            </ScrollView>
            <View style={{ flex: 1, minWidth: 0 }}>
              <ProductGrid
                data={results}
                loading={loading && results.length === 0}
                onPressItem={goToProduct}
                containerWidth={contentWidth - FILTER_PANEL_WIDTH - spacing.lg}
                horizontalPadding={0}
                bottomPadding={spacing.xl}
                ListHeaderComponent={resultsHeader}
                ListEmptyComponent={empty}
              />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={[styles.mobileTop, { paddingHorizontal: gutter }]}>
        <View style={{ flex: 1 }}>{searchBar}</View>
        <Tap style={[styles.filtersButton, (filtersOpen || activeFilterCount > 0) && styles.filtersButtonActive]} onPress={() => setFiltersOpen((v) => !v)} scaleTo={0.9} accessibilityLabel="Filters">
          <SlidersHorizontal size={18} color={filtersOpen || activeFilterCount > 0 ? "#fff" : colors.text} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Tap>
      </View>
      <View style={{ marginBottom: spacing.sm }}>{categoryChips}</View>
      {filtersOpen && (
        <View style={[styles.filterSheet, { marginHorizontal: gutter }]}>
          {filterControls}
          <Tap style={styles.doneButton} onPress={() => setFiltersOpen(false)}>
            <Text style={styles.doneText}>Show {loading ? "" : `${results.length} `}results</Text>
            <ChevronDown size={16} color="#fff" />
          </Tap>
        </View>
      )}
      {!filtersOpen && (
        <ProductGrid
          data={results}
          loading={loading && results.length === 0}
          onPressItem={goToProduct}
          horizontalPadding={gutter}
          ListHeaderComponent={resultsHeader}
          ListEmptyComponent={empty}
          refreshControl={refreshControl}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  desktopColumn: { maxWidth: MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center", flex: 1, paddingTop: spacing.lg },
  desktopTop: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginBottom: spacing.lg },
  mobileTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm + 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    height: 48,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  input: { flex: 1, height: "100%", fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  clearInput: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  filtersButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filtersButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterBadge: { position: "absolute", top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.text, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  filterBadgeText: { color: colors.inverseText, fontSize: fontSize.micro, fontWeight: fontWeight.extrabold },
  filterSheet: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow, gap: spacing.md },
  filterCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow, marginBottom: spacing.xl },
  filterLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.sm },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  priceRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  priceInput: { flex: 1, height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, color: colors.text, fontSize: fontSize.base, backgroundColor: colors.background, outlineStyle: "none" as any },
  priceDash: { color: colors.textMuted, fontSize: fontSize.sm },
  resetButton: { alignSelf: "flex-start", paddingVertical: spacing.xs },
  resetText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  doneButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.primary, borderRadius: radius.pill, height: 48 },
  doneText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.base },
  chip: { paddingHorizontal: spacing.md, height: 36, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  chipTextActive: { color: colors.inverseText },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: spacing.sm + 2 },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: { borderRadius: radius.md, padding: spacing.md, gap: 2 },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  tileName: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  tileCount: { fontSize: fontSize.caption, color: colors.textMuted },
  saveSearch: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", marginTop: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  saveSearchDone: { backgroundColor: `${colors.success}18` },
  saveSearchText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  resultsRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  resultsCount: { fontSize: fontSize.sm, color: colors.textMuted },
}));
