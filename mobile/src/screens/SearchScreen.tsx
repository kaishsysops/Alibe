import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Search as SearchIcon, X, ChevronLeft, SlidersHorizontal, SearchX, BellPlus, BellRing, Clock, TrendingUp, ArrowUpDown, Star, ChevronRight, Sparkles, LayoutGrid } from "lucide-react-native";
import { api, Atoll, AttrFilters, AttributeDef, Category, DeliveryOption, errorMessage, Listing, ListingSort, SearchUnderstanding, SellerSearchResult } from "../api/client";
import { buildCategoryTree, matchCategories } from "../utils/categoryTree";
import { VerifiedBadge } from "../components/Badges";
import { useAuth } from "../api/AuthContext";
import { useSingleFlight } from "../hooks/useSingleFlight";
import CategoryTile from "../components/CategoryTile";
import SubcategoryCards from "../components/SubcategoryCards";
import { Sheet, useActionSheet } from "../components/Sheet";
import { FadeIn } from "../components/Motion";
import { addRecentSearch, clearRecentSearches, getRecentSearches } from "../utils/recentSearches";
import ProductGrid from "../components/ProductGrid";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import Tap from "../components/Tap";
import { useToast } from "../components/Toast";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, conditionColors, cardShadow, fontSize, fontWeight, controlHeight } from "../theme/theme";
import { AllCategoriesIcon, categoryLook } from "../theme/categoryIcons";
import { useResponsive, MAX_CONTENT_WIDTH } from "../hooks/useResponsive";
import AvatarPhoto from "../components/AvatarPhoto";
import { AtollFilter } from "../components/IslandPicker";

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
const POSTED: Array<{ days: string; label: string }> = [
  { days: "1", label: "Last 24 hours" },
  { days: "7", label: "Last 7 days" },
  { days: "30", label: "Last 30 days" },
];
const FILTER_PANEL_WIDTH = 280;
// Options shown before "Show all" in a category filter.
const OPTIONS_PREVIEW = 8;
const DEBOUNCE_MS = 350;

const conditionLabel = (c: string) => c.replace("_", " ").toLowerCase().replace(/^\w/, (m) => m.toUpperCase());

function Chip({ label, active, onPress, activeColor, icon }: { label: string; active: boolean; onPress: () => void; activeColor?: string; icon?: React.ReactNode }) {
  const styles = useStyles();
  return (
    <Tap style={[styles.chip, active && styles.chipActive, active && activeColor ? { backgroundColor: activeColor, borderColor: activeColor } : null]} onPress={onPress} scaleTo={0.92}>
      {icon}
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
  const { isDesktopWeb, gutter, contentWidth, width, height } = useResponsive();

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
  // The category's own filters: {"brand":["Apple"],"year":{"min":2015}}.
  const [attrs, setAttrs] = useState<AttrFilters>({});
  const [islandId, setIslandId] = useState<string | undefined>();
  const [postedWithin, setPostedWithin] = useState<string | undefined>();
  const [reduced, setReduced] = useState(false);
  const [alibeOnly, setAlibeOnly] = useState(false);
  // "iphone under 5000 in addu" -> a one-tap filter suggestion.
  const [understanding, setUnderstanding] = useState<SearchUnderstanding | null>(null);
  // Key of the filter combination the user last saved, so the button can
  // show "Saved" until they change something.
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const { user } = useAuth();
  const showSheet = useActionSheet();
  const [recent, setRecent] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (user) getRecentSearches(user.id).then(setRecent);
  }, [user]);
  // What people really searched this week (or, early on, what's being listed most).
  const [popular, setPopular] = useState<string[]>([]);
  useEffect(() => {
    api.popularSearches().then((p) => setPopular(p.terms)).catch(() => {});
  }, []);
  const remember = (q: string) => {
    if (user && q.trim()) addRecentSearch(user.id, q).then(setRecent);
    // Only searches that found something count towards "Popular right now".
    if (q.trim() && resultsRef.current > 0) api.logSearch(q.trim()).catch(() => {});
  };
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Results arrive a page at a time; more load as the person scrolls.
  const [results, setResults] = useState<Listing[]>([]);
  const resultsRef = useRef(0);
  resultsRef.current = results.length;
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const page = useRef(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  // Sellers whose name or @username matches what's typed, shown above the items.
  const [sellers, setSellers] = useState<SellerSearchResult[]>([]);
  const sellerRequestId = useRef(0);

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const categoryAttributes = useMemo(() => tree.attributesOf(categorySlug), [tree, categorySlug]);
  const attrCount = Object.values(attrs).filter((v) => (Array.isArray(v) ? v.length : v.min !== undefined || v.max !== undefined)).length;
  const activeFilterCount =
    (atollId ? 1 : 0) + (islandId ? 1 : 0) + (condition ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (delivery ? 1 : 0) + (postedWithin ? 1 : 0) + (reduced ? 1 : 0) + (alibeOnly ? 1 : 0) + attrCount;
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
      setAttrs(p.attrs ?? {});
      setIslandId(p.islandId);
      setPostedWithin(p.postedWithin);
      setReduced(!!p.reduced);
      setAlibeOnly(!!p.alibeOnly);
      setQuery(p.q ?? "");
    }
  }, [route.params]);

  // A different category asks different questions: drop answers it doesn't ask.
  useEffect(() => {
    const keys = new Set(categoryAttributes.map((a) => a.key));
    setAttrs((prev) => {
      const kept = Object.fromEntries(Object.entries(prev).filter(([k]) => keys.has(k)));
      return Object.keys(kept).length === Object.keys(prev).length ? prev : kept;
    });
  }, [categoryAttributes]);
  const attrsParam = attrCount ? JSON.stringify(attrs) : undefined;

  const searchParams = useCallback(
    () => ({
      mix: "1",
      q: query.trim() || undefined,
      atollId,
      categorySlug,
      condition,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      delivery,
      sort,
      attrs: attrsParam,
      islandId,
      postedWithin,
      reduced: reduced ? "1" : undefined,
      alibeOnly: alibeOnly ? "1" : undefined,
    }),
    [query, atollId, categorySlug, condition, minPrice, maxPrice, delivery, sort, attrsParam, islandId, postedWithin, reduced, alibeOnly]
  );

  const runSearch = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const first = await api.listingsPage(searchParams(), 0);
      // Ignore responses for searches the user has already typed past.
      if (id !== requestId.current) return;
      page.current = 0;
      setResults(first.items);
      setHasMore(first.hasMore);
    } catch {
      if (id === requestId.current) toast.error("Couldn't load results. Pull down to try again.");
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [searchParams, toast]);

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const next = await api.listingsPage(searchParams(), page.current + 1);
      if (id !== requestId.current) return;
      page.current += 1;
      // A newly posted item can shift pages by one: skip anything already shown.
      setResults((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        return [...prev, ...next.items.filter((l) => !seen.has(l.id))];
      });
      setHasMore(next.hasMore);
    } catch {
      toast.error("Couldn't load more. Scroll down to try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  // Search as you type, debounced; filter taps apply immediately.
  const lastQuery = useRef(query);
  useEffect(() => {
    setLoading(true);
    const typing = lastQuery.current !== query;
    lastQuery.current = query;
    const t = setTimeout(runSearch, typing ? DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
  }, [runSearch, query]);

  useEffect(() => {
    const q = query.trim();
    const id = ++sellerRequestId.current;
    if (q.replace(/^@/, "").length < 2) {
      setSellers([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .searchSellers(q)
        .then((list) => id === sellerRequestId.current && setSellers(list))
        .catch(() => id === sellerRequestId.current && setSellers([]));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Longer searches may name a category, price or place: offer them as filters.
  useEffect(() => {
    const q = query.trim();
    setUnderstanding(null);
    if (q.split(/\s+/).length < 2 && !/\d/.test(q)) return;
    let live = true;
    const t = setTimeout(() => {
      api
        .understandSearch(q)
        .then((u) => live && setUnderstanding(u.filters ? u : null))
        .catch(() => {});
    }, 700);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  const applyUnderstanding = () => {
    const f = understanding?.filters;
    if (!f) return;
    setQuery(f.q ?? "");
    if (f.categorySlug) setCategorySlug(f.categorySlug);
    if (f.atollId) setAtollId(f.atollId);
    if (f.minPrice !== undefined) setMinPrice(String(f.minPrice));
    if (f.maxPrice !== undefined) setMaxPrice(String(f.maxPrice));
    if (f.condition) setCondition(f.condition);
    setUnderstanding(null);
  };

  // Typing a category's own name ("phones") opens that category instead of searching the word.
  const openCategory = (c: Category) => {
    const q = query.trim().toLowerCase();
    if (q && (c.name.toLowerCase() === q || (c.keywords ?? []).includes(q))) setQuery("");
    setCategorySlug(c.slug);
  };

  const goToSeller = (s: SellerSearchResult) => {
    remember(query);
    navigation.navigate("SellerProfile", { id: s.id });
  };

  const clearAll = () => {
    setQuery("");
    setCategorySlug(undefined);
    setAtollId(undefined);
    setCondition(undefined);
    setMinPrice("");
    setMaxPrice("");
    setDelivery(undefined);
    setAttrs({});
    setIslandId(undefined);
    setPostedWithin(undefined);
    setReduced(false);
    setAlibeOnly(false);
    setUnderstanding(null);
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
    attrs: attrCount ? attrs : undefined,
    islandId,
    postedWithin,
    reduced: reduced ? "1" : undefined,
    alibeOnly: alibeOnly ? "1" : undefined,
  };
  const filtersKey = JSON.stringify(currentFilters);
  const isSaved = savedKey === filtersKey;
  const [saveSearch, saving] = useSingleFlight(async () => {
    if (!user || isSaved) return;
    const atoll = atolls.find((a) => a.id === atollId);
    const what = query.trim() ? `"${query.trim()}"` : tree.bySlug.get(categorySlug ?? "")?.name ?? "New listings";
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

  const goToProduct = (l: Listing) => {
    remember(query);
    navigation.navigate("ProductDetail", { id: l.id });
  };
  const activeCategory = categorySlug ? tree.bySlug.get(categorySlug) : undefined;

  const searchBar = (
    <View style={[styles.searchBar, focused && styles.searchBarFocused]}>
      <SearchIcon size={20} color={focused ? colors.primary : colors.textMuted} />
      <TextInput
        style={styles.input}
        placeholder="Search items or sellers"
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        onSubmitEditing={() => remember(query)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
        accessibilityLabel="Search items and sellers"
      />
      {query.length > 0 && (
        <Tap style={styles.clearInput} onPress={() => setQuery("")} hitSlop={10} scaleTo={0.85} accessibilityLabel="Clear search">
          <X size={14} color={colors.textMuted} strokeWidth={2.6} />
        </Tap>
      )}
    </View>
  );

  // No category: the top categories as chips. In a category: where you are
  // (tap any step to go back up) and its subcategories, at any depth.
  const crumbs = tree.pathOf(categorySlug);
  const categoryChips = !categorySlug ? (
    <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} style={styles.hRow} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: isDesktopWeb ? 0 : gutter }} keyboardShouldPersistTaps="handled">
      <Chip label="All" active onPress={() => setCategorySlug(undefined)} />
      {tree.roots.map((c) => {
        const { Icon, color } = categoryLook(c, tree);
        return <Chip key={c.id} label={c.name} active={false} icon={<Icon size={15} color={color} strokeWidth={2.2} />} onPress={() => openCategory(c)} />;
      })}
      <Chip label="All categories" active={false} icon={<LayoutGrid size={15} color={colors.primary} />} onPress={() => navigation.navigate("Categories")} />
    </ScrollView>
  ) : (
    <View>
      {/* Where you are, in one line that always fits: a step back up, and the
          current category (its X clears the category altogether). */}
      <View style={[styles.crumbs, { paddingHorizontal: isDesktopWeb ? 0 : gutter }]}>
        <Tap style={styles.crumbBack} onPress={() => setCategorySlug(crumbs[crumbs.length - 2]?.slug)} scaleTo={0.94} accessibilityLabel={`Back to ${crumbs[crumbs.length - 2]?.name ?? "all categories"}`}>
          <ChevronLeft size={16} color={colors.text} strokeWidth={2.4} />
          <Text style={styles.crumbBackText} numberOfLines={1}>
            {crumbs[crumbs.length - 2]?.name ?? "All"}
          </Text>
        </Tap>
        <Tap style={styles.crumbCurrent} onPress={() => setCategorySlug(undefined)} scaleTo={0.94} accessibilityLabel={`Clear ${activeCategory?.name ?? "category"}`}>
          <Text style={styles.crumbCurrentText} numberOfLines={1}>
            {activeCategory?.name}
          </Text>
          <X size={14} color={colors.inverseText} strokeWidth={2.8} />
        </Tap>
      </View>
      <View style={{ paddingTop: spacing.sm }}>
        <SubcategoryCards tree={tree} slug={categorySlug} onPress={(c) => setCategorySlug(c.slug)} horizontalPadding={isDesktopWeb ? 0 : gutter} large={isDesktopWeb} />
      </View>
    </View>
  );

  // The category's own filters (brand, year, bedrooms...).
  const [expandedAttrs, setExpandedAttrs] = useState<string[]>([]);
  const [showAllFilterCats, setShowAllFilterCats] = useState(false);
  const setAttrOption = (def: AttributeDef, option: string) =>
    setAttrs((prev) => {
      const current = Array.isArray(prev[def.key]) ? (prev[def.key] as string[]) : [];
      const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
      const { [def.key]: _drop, ...rest } = prev;
      return next.length ? { ...rest, [def.key]: next } : rest;
    });
  const setAttrRange = (def: AttributeDef, end: "min" | "max", text: string) =>
    setAttrs((prev) => {
      const current = prev[def.key] && !Array.isArray(prev[def.key]) ? (prev[def.key] as { min?: number; max?: number }) : {};
      const digits = text.replace(/\D/g, "");
      const next = { ...current, [end]: digits ? Number(digits) : undefined };
      const { [def.key]: _drop, ...rest } = prev;
      return next.min === undefined && next.max === undefined ? rest : { ...rest, [def.key]: next };
    });
  const attributeFilters = categoryAttributes.length > 0 && (
    <View style={{ gap: spacing.md }}>
      {categoryAttributes.map((def) => {
        const value = attrs[def.key];
        return (
          <View key={def.key}>
            <Text style={styles.filterLabel}>
              {def.label}
              {def.unit ? ` (${def.unit})` : ""}
            </Text>
            {def.type === "select" ? (
              <View style={styles.wrapRow}>
                {/* Long lists start short; chosen options always stay visible. */}
                {(def.options ?? [])
                  .filter((o, i) => expandedAttrs.includes(def.key) || i < OPTIONS_PREVIEW || (Array.isArray(value) && value.includes(o)))
                  .map((o) => (
                    <Chip key={o} label={o} active={Array.isArray(value) && value.includes(o)} onPress={() => setAttrOption(def, o)} />
                  ))}
                {(def.options?.length ?? 0) > OPTIONS_PREVIEW && !expandedAttrs.includes(def.key) && (
                  <Chip label={`Show all ${def.options!.length}`} active={false} onPress={() => setExpandedAttrs((k) => [...k, def.key])} />
                )}
              </View>
            ) : (
              <View style={styles.priceRow}>
                <TextInput style={styles.priceInput} placeholder="From" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={value && !Array.isArray(value) && value.min !== undefined ? String(value.min) : ""} onChangeText={(t) => setAttrRange(def, "min", t)} accessibilityLabel={`${def.label} from`} />
                <Text style={styles.priceDash}>to</Text>
                <TextInput style={styles.priceInput} placeholder="To" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={value && !Array.isArray(value) && value.max !== undefined ? String(value.max) : ""} onChangeText={(t) => setAttrRange(def, "max", t)} accessibilityLabel={`${def.label} to`} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  const filterAtoll = atolls.find((a) => a.id === atollId);
  const filterControls = (
    <View style={{ gap: spacing.md }}>
      <View>
        <Text style={styles.filterLabel}>Category</Text>
        {/* Where you are: a step back and the current category (X = any category). */}
        {activeCategory && (
          <View style={styles.filterPath}>
            <Tap style={styles.filterBack} onPress={() => setCategorySlug(crumbs[crumbs.length - 2]?.slug)} scaleTo={0.94} accessibilityLabel={`Back to ${crumbs[crumbs.length - 2]?.name ?? "all categories"}`}>
              <ChevronLeft size={16} color={colors.text} strokeWidth={2.4} />
              <Text style={styles.filterBackText} numberOfLines={1}>
                {crumbs[crumbs.length - 2]?.name ?? "All categories"}
              </Text>
            </Tap>
            <Tap style={styles.filterCurrent} onPress={() => setCategorySlug(undefined)} scaleTo={0.96} accessibilityLabel={`Clear ${activeCategory.name}`}>
              {(() => {
                const { Icon } = categoryLook(activeCategory, tree);
                return <Icon size={16} color={colors.inverseText} strokeWidth={2.4} />;
              })()}
              <Text style={styles.filterCurrentText} numberOfLines={1}>
                {activeCategory.name}
              </Text>
              <X size={15} color={colors.inverseText} strokeWidth={2.8} />
            </Tap>
          </View>
        )}
        {/* What's inside, as a readable list: icon, name, how many, and a > when there's more inside. */}
        {(() => {
          const options = tree.childrenOf(categorySlug).filter((c) => (c.listingCount ?? 0) > 0);
          const shown = showAllFilterCats ? options : options.slice(0, 6);
          return (
            <View style={styles.filterCatList}>
              {shown.map((c) => {
                const { Icon, color } = categoryLook(c, tree);
                const deeper = tree.childrenOf(c.slug).some((k) => (k.listingCount ?? 0) > 0);
                return (
                  <Tap key={c.id} style={styles.filterCatRow} onPress={() => (setShowAllFilterCats(false), setCategorySlug(c.slug))} scaleTo={0.98} accessibilityLabel={`${c.name}, ${c.listingCount ?? 0} items`}>
                    <View style={[styles.filterCatIcon, { backgroundColor: color + "1F" }]}>
                      <Icon size={16} color={color} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.filterCatName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.filterCatCount}>{(c.listingCount ?? 0).toLocaleString()}</Text>
                    {deeper && <ChevronRight size={16} color={colors.textMuted} />}
                  </Tap>
                );
              })}
              {options.length > 6 && !showAllFilterCats && (
                <Tap style={styles.filterCatMore} onPress={() => setShowAllFilterCats(true)} scaleTo={0.97}>
                  <Text style={styles.filterCatMoreText}>Show all {options.length}</Text>
                </Tap>
              )}
            </View>
          );
        })()}
      </View>
      {attributeFilters && (
        <View style={styles.detailsBox}>
          <Text style={styles.detailsTitle}>{activeCategory?.name} details</Text>
          {attributeFilters}
        </View>
      )}
      <View>
        <Text style={styles.filterLabel}>Location</Text>
        <AtollFilter
          atolls={atolls}
          value={atollId}
          onChange={(id) => {
            setAtollId(id);
            setIslandId(undefined);
          }}
        />
        {filterAtoll && filterAtoll.islands.length > 1 && (
          <View style={[styles.wrapRow, { marginTop: spacing.sm }]}>
            <Chip label={`All of ${filterAtoll.name}`} active={!islandId} onPress={() => setIslandId(undefined)} />
            {filterAtoll.islands.map((i) => (
              <Chip key={i.id} label={i.name} active={islandId === i.id} onPress={() => setIslandId(islandId === i.id ? undefined : i.id)} />
            ))}
          </View>
        )}
      </View>
      <View>
        <Text style={styles.filterLabel}>Posted</Text>
        <View style={styles.wrapRow}>
          <Chip label="Any time" active={!postedWithin} onPress={() => setPostedWithin(undefined)} />
          {POSTED.map((p) => (
            <Chip key={p.days} label={p.label} active={postedWithin === p.days} onPress={() => setPostedWithin(postedWithin === p.days ? undefined : p.days)} />
          ))}
        </View>
      </View>
      <View>
        <Text style={styles.filterLabel}>Deals and sellers</Text>
        <View style={styles.wrapRow}>
          <Chip label="Price dropped" active={reduced} onPress={() => setReduced(!reduced)} />
          <Chip label="Alibe sellers only" active={alibeOnly} onPress={() => setAlibeOnly(!alibeOnly)} />
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

  // Every active filter as a removable pill, so it's obvious what's applied.
  const atollName = atolls.find((a) => a.id === atollId)?.name;
  const activePills: Array<{ key: string; label: string; clear: () => void }> = [
    ...(atollName ? [{ key: "atoll", label: atollName, clear: () => (setAtollId(undefined), setIslandId(undefined)) }] : []),
    ...(islandId ? [{ key: "island", label: atolls.flatMap((a) => a.islands).find((i) => i.id === islandId)?.name ?? "Island", clear: () => setIslandId(undefined) }] : []),
    ...(postedWithin ? [{ key: "posted", label: POSTED.find((p) => p.days === postedWithin)!.label, clear: () => setPostedWithin(undefined) }] : []),
    ...(reduced ? [{ key: "reduced", label: "Price dropped", clear: () => setReduced(false) }] : []),
    ...(alibeOnly ? [{ key: "alibeOnly", label: "Alibe sellers only", clear: () => setAlibeOnly(false) }] : []),
    ...(condition ? [{ key: "condition", label: conditionLabel(condition), clear: () => setCondition(undefined) }] : []),
    ...(minPrice ? [{ key: "min", label: `From MVR ${Number(minPrice).toLocaleString()}`, clear: () => setMinPrice("") }] : []),
    ...(maxPrice ? [{ key: "max", label: `Up to MVR ${Number(maxPrice).toLocaleString()}`, clear: () => setMaxPrice("") }] : []),
    ...(delivery ? [{ key: "delivery", label: DELIVERIES.find((d) => d.key === delivery)!.label, clear: () => setDelivery(undefined) }] : []),
    ...categoryAttributes.flatMap((def) => {
      const v = attrs[def.key];
      if (!v) return [];
      if (Array.isArray(v)) return v.map((o) => ({ key: `${def.key}:${o}`, label: o, clear: () => setAttrOption(def, o) }));
      const unit = def.unit ? ` ${def.unit}` : "";
      const label = v.min !== undefined && v.max !== undefined ? `${def.label} ${v.min}-${v.max}${unit}` : v.min !== undefined ? `${def.label} from ${v.min}${unit}` : `${def.label} up to ${v.max}${unit}`;
      return [{ key: def.key, label, clear: () => setAttrs(({ [def.key]: _drop, ...rest }) => rest) }];
    }),
  ];
  const pillsRow = activePills.length > 0 && (
    <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} style={styles.hRow} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: isDesktopWeb ? 0 : gutter, paddingTop: spacing.sm }}>
      {activePills.map((p) => (
        <Tap key={p.key} style={styles.activePill} onPress={p.clear} scaleTo={0.92} accessibilityLabel={`Remove ${p.label}`}>
          <Text style={styles.activePillText}>{p.label}</Text>
          <X size={13} color={colors.primary} strokeWidth={2.8} />
        </Tap>
      ))}
    </ScrollView>
  );

  const sortLabel = SORTS.find((x) => x.key === sort)!.label;
  const sortPill = (
    <Tap
      style={styles.sortPill}
      scaleTo={0.94}
      onPress={() => showSheet({ title: "Sort by", actions: SORTS.map((x) => ({ label: x.key === sort ? `${x.label}  ✓` : x.label, onPress: () => setSort(x.key) })) })}
      accessibilityLabel={`Sort: ${sortLabel}`}
    >
      <ArrowUpDown size={14} color={colors.text} />
      <Text style={styles.sortText}>{sortLabel}</Text>
    </Tap>
  );

  // Before typing: recent searches, popular ideas and photo category cards.
  const startBlock = (
    <View>
      {recent.length > 0 && (
        <FadeIn style={{ marginBottom: spacing.lg }}>
          <View style={styles.blockHead}>
            <Text style={styles.sectionTitle}>Recent searches</Text>
            <Tap
              onPress={() => {
                if (user) clearRecentSearches(user.id);
                setRecent([]);
              }}
              hitSlop={8}
              scaleTo={0.9}
            >
              <Text style={styles.clearText}>Clear</Text>
            </Tap>
          </View>
          <View style={styles.wrapRow}>
            {recent.map((q) => (
              <Tap key={q} style={styles.suggestion} onPress={() => setQuery(q)} scaleTo={0.94}>
                <Clock size={14} color={colors.textMuted} />
                <Text style={styles.suggestionText}>{q}</Text>
              </Tap>
            ))}
          </View>
        </FadeIn>
      )}
      {popular.length > 0 && (
      <FadeIn delay={60} style={{ marginBottom: spacing.lg }}>
        <Text style={styles.sectionTitle}>Popular right now</Text>
        <View style={styles.wrapRow}>
          {popular.map((q) => (
            <Tap key={q} style={styles.suggestion} onPress={() => setQuery(q)} scaleTo={0.94}>
              <TrendingUp size={14} color={colors.primary} />
              <Text style={styles.suggestionText}>{q}</Text>
            </Tap>
          ))}
        </View>
      </FadeIn>
      )}
    </View>
  );

  // Category tiles: shown while the user is browsing rather than searching.
  const tileColumns = isDesktopWeb ? 4 : width >= 600 ? 4 : 2;
  // "40+" while more pages exist: the full count isn't known without loading them.
  const resultCount = `${results.length}${hasMore ? "+" : ""}`;
  const latestPhoto = new Map<string, string>();
  for (const c of categories) if (c.photo) latestPhoto.set(c.slug, c.photo);
  for (const l of results) {
    const top = tree.topOf(l.category.slug);
    if (l.images[0] && top && !latestPhoto.has(top.slug)) latestPhoto.set(top.slug, l.images[0]);
  }
  const tileAreaWidth = isDesktopWeb ? contentWidth - FILTER_PANEL_WIDTH - spacing.lg : width - gutter * 2;
  const tileWidth = Math.floor((tileAreaWidth - spacing.sm * (tileColumns - 1)) / tileColumns);
  // Only categories with something in them, busiest first, in full rows:
  // 8 tiles on a phone (or 7 + "All categories"), so the grid stays balanced
  // and listings start within a scroll.
  const [allTiles, setAllTiles] = useState(false);
  // Top categories with something in them, in their set order.
  const stocked = tree.roots.filter((c) => (c.listingCount ?? 0) > 0);
  const tileLimit = tileColumns * (isDesktopWeb || width >= 600 ? 2 : 4);
  const overflow = !allTiles && stocked.length > tileLimit;
  const shownTiles = overflow ? stocked.slice(0, tileLimit - 1) : stocked;
  const categoryTiles = (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.sectionTitle}>Browse by category</Text>
      <View style={styles.tileGrid}>
        {shownTiles.map((c) => {
          const { Icon, color: tint } = categoryLook(c, tree);
          return (
            <CategoryTile
              key={c.id}
              name={c.name}
              subtitle={`${(c.listingCount ?? 0).toLocaleString()} ${c.listingCount === 1 ? "listing" : "listings"}`}
              image={latestPhoto.get(c.slug)}
              Icon={Icon}
              color={tint}
              size={tileWidth}
              height={Math.round(tileWidth * 0.62)}
              onPress={() => openCategory(c)}
            />
          );
        })}
        {overflow && (
          <Tap style={[styles.moreTile, { width: tileWidth, height: Math.round(tileWidth * 0.62) }]} onPress={() => navigation.navigate("Categories")} scaleTo={0.96} accessibilityLabel="Show all categories">
            <AllCategoriesIcon size={22} color={colors.primary} />
            <Text style={styles.moreTileText}>All categories</Text>
            <Text style={styles.moreTileMeta}>+{stocked.length - shownTiles.length} more</Text>
          </Tap>
        )}
      </View>
    </View>
  );

  const sellersBlock = sellers.length > 0 && (
    <FadeIn style={{ marginBottom: spacing.lg }}>
      <Text style={styles.sectionTitle}>Sellers</Text>
      <ScrollView showsVerticalScrollIndicator={false}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.hRow, !isDesktopWeb && { marginHorizontal: -gutter }]}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: isDesktopWeb ? 0 : gutter, paddingBottom: 4 }}
        keyboardShouldPersistTaps="handled"
      >
        {sellers.map((s) => (
          <Tap key={s.id} style={styles.sellerCard} onPress={() => goToSeller(s)} scaleTo={0.96} accessibilityLabel={`Open ${s.name}'s profile`}>
            <View style={[styles.sellerAvatar, { backgroundColor: s.avatarColor ?? colors.primary }]}>
              <Text style={styles.sellerAvatarText}>{s.name.charAt(0).toUpperCase()}</Text>
              <AvatarPhoto uri={s.avatarUrl} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {s.name}
                </Text>
                {s.verified && <VerifiedBadge size={14} />}
              </View>
              {!!s.username && (
                <Text style={styles.sellerMeta} numberOfLines={1}>
                  @{s.username}
                </Text>
              )}
              <View style={styles.sellerStats}>
                {s.rating.count > 0 ? (
                  <>
                    <Star size={12} color={colors.gold} fill={colors.gold} />
                    <Text style={styles.sellerStatText}>
                      {s.rating.average.toFixed(1)} ({s.rating.count})
                    </Text>
                  </>
                ) : (
                  <Text style={styles.sellerMeta}>No reviews yet</Text>
                )}
                <Text style={styles.sellerMeta}> · {s.activeListingsCount} for sale</Text>
              </View>
            </View>
          </Tap>
        ))}
      </ScrollView>
    </FadeIn>
  );

  // Categories matching what's typed ("pho" -> Mobile phones, Phone accessories).
  const typedCategories = query.trim() ? matchCategories(tree, query, 4).filter((c) => c.slug !== categorySlug) : [];
  const understandingCard = understanding?.filters && (
    <FadeIn style={styles.understandCard}>
      <View style={styles.understandIcon}>
        <Sparkles size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.understandTitle}>Narrow this down?</Text>
        <View style={styles.understandChips}>
          {[
            understanding.categoryPath?.[understanding.categoryPath.length - 1],
            understanding.filters.condition && conditionLabel(understanding.filters.condition),
            understanding.filters.minPrice !== undefined && understanding.filters.maxPrice !== undefined
              ? `MVR ${understanding.filters.minPrice.toLocaleString()} to ${understanding.filters.maxPrice.toLocaleString()}`
              : understanding.filters.maxPrice !== undefined
              ? `up to MVR ${understanding.filters.maxPrice.toLocaleString()}`
              : understanding.filters.minPrice !== undefined && `from MVR ${understanding.filters.minPrice.toLocaleString()}`,
            understanding.atollName,
          ]
            .filter((x): x is string => !!x)
            .map((label) => (
              <View key={label} style={styles.understandChip}>
                <Text style={styles.understandChipText} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            ))}
        </View>
      </View>
      <Tap style={styles.understandApply} onPress={applyUnderstanding} scaleTo={0.94} accessibilityLabel="Apply these filters">
        <Text style={styles.understandApplyText}>Apply</Text>
      </Tap>
    </FadeIn>
  );
  const typedCategoriesBlock = typedCategories.length > 0 && (
    <FadeIn style={{ marginBottom: spacing.md }}>
      <Text style={styles.sectionTitle}>Categories</Text>
      <View style={{ gap: spacing.xs }}>
        {typedCategories.map((c) => {
          const { Icon, color } = categoryLook(c, tree);
          const parent = tree.pathOf(c.slug).slice(0, -1).map((p) => p.name).join(" › ");
          return (
            <Tap key={c.id} style={styles.typedRow} onPress={() => openCategory(c)} scaleTo={0.98} accessibilityLabel={`Open ${c.name}`}>
              <View style={[styles.subIcon, { backgroundColor: color + "1F" }]}>
                <Icon size={18} color={color} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.subName} numberOfLines={1}>
                  {c.name}
                </Text>
                {!!parent && (
                  <Text style={styles.subMeta} numberOfLines={1}>
                    in {parent}
                  </Text>
                )}
              </View>
              <Text style={styles.subMeta}>{(c.listingCount ?? 0).toLocaleString()}</Text>
              <ChevronRight size={16} color={colors.textMuted} />
            </Tap>
          );
        })}
      </View>
    </FadeIn>
  );

  const resultsHeader = (
    <View style={{ paddingHorizontal: isDesktopWeb ? 0 : gutter }}>
      {understandingCard}
      {typedCategoriesBlock}
      {isBrowsing && startBlock}
      {sellersBlock}
      {isBrowsing && categories.length > 0 && categoryTiles}
      <View style={styles.resultsRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]} numberOfLines={1}>
            {isBrowsing ? "Latest listings" : activeCategory && !query.trim() ? activeCategory.name : query.trim() ? `"${query.trim()}"` : "Results"}
          </Text>
          {!loading && <Text style={styles.resultsCount}>{resultCount} {results.length === 1 && !hasMore ? "item" : "items"}</Text>}
        </View>
        {sortPill}
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
      title={sellers.length > 0 ? "No items match" : "No matches"}
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
            {/* Top categories fit beside the search bar; a chosen category's path and
                subcategories get their own row below, so this row never changes height. */}
            <View style={{ flex: 1, minWidth: 0 }}>{!isBrowsing && !categorySlug && categoryChips}</View>
          </View>

          <View style={{ flexDirection: "row", flex: 1, gap: spacing.lg }}>
            <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={{ width: FILTER_PANEL_WIDTH, flexGrow: 0 }} contentContainerStyle={styles.filterCard}>
              {filterControls}
            </ScrollView>
            <View style={{ flex: 1, minWidth: 0 }}>
              {/* Inside the results column, so the filter panel never moves. */}
              {!!categorySlug && <View style={{ marginBottom: spacing.md }}>{categoryChips}</View>}
              <ProductGrid
                data={results}
                loading={loading && results.length === 0}
                onEndReached={loadMore}
                loadingMore={loadingMore}
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
      <Text style={[styles.pageTitle, { paddingHorizontal: gutter }]}>Search</Text>
      <View style={[styles.mobileTop, { paddingHorizontal: gutter }]}>
        <View style={{ flex: 1 }}>{searchBar}</View>
        <Tap style={[styles.filtersButton, activeFilterCount > 0 && styles.filtersButtonActive]} onPress={() => setFiltersOpen(true)} scaleTo={0.9} accessibilityLabel="Filters">
          <SlidersHorizontal size={20} color={activeFilterCount > 0 ? "#fff" : colors.text} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Tap>
      </View>
      {/* While browsing, the category tiles below do this job. */}
      {!isBrowsing && categoryChips}
      {pillsRow}
      <View style={{ height: spacing.sm + 4 }} />
      <ProductGrid
        data={results}
        loading={loading && results.length === 0}
        onPressItem={goToProduct}
        horizontalPadding={gutter}
        ListHeaderComponent={resultsHeader}
        ListEmptyComponent={empty}
        refreshControl={refreshControl}
        onEndReached={loadMore}
        loadingMore={loadingMore}
      />

      <Sheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={{ maxHeight: height * 0.6 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }} keyboardShouldPersistTaps="handled">
          {filterControls}
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Tap style={styles.doneButton} onPress={() => setFiltersOpen(false)} scaleTo={0.97}>
            <Text style={styles.doneText}>{loading ? "Searching..." : `Show ${resultCount} ${results.length === 1 && !hasMore ? "item" : "items"}`}</Text>
          </Tap>
        </View>
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  desktopColumn: { maxWidth: MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center", flex: 1, paddingTop: spacing.lg },
  desktopTop: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginBottom: spacing.lg },
  hRow: { flexGrow: 0, flexShrink: 0 },
  crumbs: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  crumbBack: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 1, height: 44, paddingLeft: spacing.sm, paddingRight: spacing.md, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  crumbBackText: { flexShrink: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  crumbCurrent: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 44 },
  crumbCurrentText: { flexShrink: 1, fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.inverseText },
  subCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: spacing.sm, paddingLeft: spacing.sm, paddingRight: spacing.md, ...cardShadow },
  subIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  subName: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  subMeta: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 1 },
  typedRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm, ...cardShadow },
  understandCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, backgroundColor: colors.primaryTint, borderRadius: radius.lg, padding: spacing.sm + 4, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.primaryLight },
  understandIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  understandTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  understandChips: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  understandChip: { backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  understandChipText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.text },
  understandApply: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.md + 2, height: 38, alignItems: "center", justifyContent: "center" },
  understandApplyText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  // Stacked so long names fit even in the narrow desktop panel.
  filterPath: { gap: spacing.xs, marginBottom: spacing.sm, alignItems: "flex-start" },
  filterBack: { flexDirection: "row", alignItems: "center", gap: 2, maxWidth: "100%", height: 32, paddingRight: spacing.sm },
  filterBackText: { flexShrink: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted },
  filterCurrent: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "stretch", height: 44, paddingHorizontal: spacing.sm + 4, borderRadius: radius.md, backgroundColor: colors.primary },
  filterCurrentText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.inverseText },
  filterCatList: { borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  filterCatRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, minHeight: 48, paddingHorizontal: spacing.sm + 2 },
  filterCatIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  filterCatName: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  filterCatCount: { fontSize: fontSize.caption, color: colors.textMuted, fontWeight: fontWeight.semibold },
  filterCatMore: { minHeight: 44, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderTopColor: colors.border },
  filterCatMoreText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  detailsBox: { gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primaryTint },
  detailsTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  pageTitle: { fontSize: fontSize.display, fontWeight: fontWeight.extrabold, color: colors.text, letterSpacing: -0.5, marginBottom: spacing.sm + 4 },
  mobileTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    height: 52,
    paddingHorizontal: spacing.md + 2,
    gap: spacing.sm + 2,
    ...cardShadow,
  },
  searchBarFocused: { borderColor: colors.primary },
  input: { flex: 1, height: "100%", fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  clearInput: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  filtersButton: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filtersButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterBadge: { position: "absolute", top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.text, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  filterBadgeText: { color: colors.inverseText, fontSize: fontSize.micro, fontWeight: fontWeight.extrabold },
  filterCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow, marginBottom: spacing.xl },
  filterLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.sm },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  priceRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  priceInput: { flex: 1, minWidth: 0, width: 0, height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, color: colors.text, fontSize: fontSize.base, backgroundColor: colors.background, outlineStyle: "none" as any },
  priceDash: { color: colors.textMuted, fontSize: fontSize.sm },
  resetButton: { alignSelf: "flex-start", paddingVertical: spacing.xs },
  resetText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  doneButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.primary, borderRadius: radius.pill, height: controlHeight.primary, marginTop: spacing.sm },
  doneText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 38, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  chipTextActive: { color: colors.inverseText },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: spacing.sm + 2 },
  moreTile: { borderRadius: radius.lg, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center", gap: 2 },
  moreTileText: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold, color: colors.primary },
  moreTileMeta: { fontSize: fontSize.caption, color: colors.primary },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  saveSearch: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", marginTop: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  saveSearchDone: { backgroundColor: `${colors.success}18` },
  saveSearchText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  resultsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.sm },
  resultsCount: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  sortPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sortText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  activePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.sm + 4, height: 32, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  activePillText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  blockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clearText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.sm + 2 },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.sm + 6, height: 38, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sellerCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, width: 248, padding: spacing.sm + 4, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sellerAvatarText: { color: "#fff", fontWeight: fontWeight.extrabold, fontSize: fontSize.lg },
  sellerNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  sellerName: { flexShrink: 1, fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  sellerMeta: { fontSize: fontSize.sm, color: colors.textMuted },
  sellerStats: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  sellerStatText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  suggestionText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
}));
