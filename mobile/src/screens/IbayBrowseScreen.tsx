import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useRoute } from "@react-navigation/native";
import { Search, Store } from "lucide-react-native";
import { api, Category, errorMessage, IbayItemSummary } from "../api/client";
import Tap from "../components/Tap";
import { AllCategoriesIcon, categoryIcons } from "../theme/categoryIcons";
import { useToast } from "../components/Toast";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import IbayCard from "../components/IbayCard";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, controlHeight, fontWeight } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

const MAX_WIDTH = 1120;
const TARGET_CARD = 180;
const GAP = spacing.sm + 4;

export default function IbayBrowseScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const route = useRoute<any>();
  const { width } = useWindowDimensions();
  const { isDesktopWeb, gutter } = useResponsive();
  const [query, setQuery] = useState<string>(route.params?.q ?? "");
  const [categorySlug, setCategorySlug] = useState<string | undefined>(route.params?.categorySlug);
  const [categories, setCategories] = useState<Category[]>([]);
  // Condition and price carry over from search, so "See all" shows the same items.
  const carried = { condition: route.params?.condition, minPrice: route.params?.minPrice, maxPrice: route.params?.maxPrice };
  const [items, setItems] = useState<IbayItemSummary[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const page = useRef(0);
  const latest = useRef(0);

  const contentWidth = Math.min(width, MAX_WIDTH) - gutter * 2;
  const columns = Math.max(2, Math.floor((contentWidth + GAP) / (TARGET_CARD + GAP)));
  const cardWidth = (contentWidth - GAP * (columns - 1)) / columns;

  const load = useCallback(
    async (q: string, slug: string | undefined, nextPage: number) => {
      const ticket = ++latest.current;
      try {
        const res = await api.ibayItems({ ...carried, q, categorySlug: slug }, nextPage);
        if (ticket !== latest.current) return;
        page.current = nextPage;
        setItems((prev) => (nextPage === 0 ? res.items : [...(prev ?? []), ...res.items]));
        setHasMore(res.hasMore);
      } catch (e) {
        if (ticket === latest.current) {
          setItems((prev) => prev ?? []);
          toast.error(errorMessage(e, "Couldn't load iBay items. Please try again."));
        }
      }
    },
    [toast]
  );

  useEffect(() => {
    const t = setTimeout(() => load(query.trim(), categorySlug, 0), 300);
    return () => clearTimeout(t);
  }, [query, categorySlug, load]);

  useEffect(() => {
    api.categories().then((list) => setCategories(list.filter((c) => !c.parentId))).catch(() => {});
  }, []);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await load(query.trim(), categorySlug, page.current + 1);
    setLoadingMore(false);
  };

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar /> : <ScreenHeader title="From iBay" />}
      <View style={{ width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center", paddingHorizontal: gutter, paddingTop: spacing.md }}>
        <View style={styles.search}>
          <Search size={18} color={colors.textMuted} />
          <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search iBay items" placeholderTextColor={colors.textMuted} autoCorrect={false} accessibilityLabel="Search iBay items" />
        </View>
        <Text style={styles.note}>Found on iBay. Buy through Alibe at the price shown, and we handle the rest.</Text>
        <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {[{ slug: undefined as string | undefined, name: "All" }, ...categories.map((c) => ({ slug: c.slug as string | undefined, name: c.name }))].map(({ slug, name }) => {
            const active = categorySlug === slug;
            const Icon = slug ? categoryIcons[slug]?.Icon ?? AllCategoriesIcon : AllCategoriesIcon;
            return (
              <Tap key={name} style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setCategorySlug(slug)} scaleTo={0.94} accessibilityState={{ selected: active }}>
                <Icon size={15} color={active ? "#fff" : colors.textMuted} />
                <Text style={[styles.chipText, active && { color: "#fff" }]}>{name}</Text>
              </Tap>
            );
          })}
        </ScrollView>
      </View>
      {!items ? (
        <SkeletonGroup>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP, padding: gutter, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" }}>
            {Array.from({ length: columns * 2 }).map((_, i) => (
              <Skeleton key={i} width={cardWidth} height={cardWidth + 78} rounded={radius.lg} />
            ))}
          </View>
        </SkeletonGroup>
      ) : (
        <FlatList showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
          key={columns}
          data={items}
          numColumns={columns}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <IbayCard item={item} width={cardWidth} />}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP, padding: gutter, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center", flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: spacing.md }} /> : undefined}
          ListEmptyComponent={<EmptyState icon={Store} title={query ? "No matches" : "Nothing here right now"} message={query ? "Try a different word." : "Check back soon."} />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: controlHeight.input, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, height: "100%", fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  note: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm },
  chips: { gap: spacing.sm, paddingTop: spacing.sm + 4 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
}));
