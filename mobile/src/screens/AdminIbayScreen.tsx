import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, Linking, Switch, TextInput, ActivityIndicator } from "react-native";
import { ExternalLink, Search, Store } from "lucide-react-native";
import { api, errorMessage, IbayItem } from "../api/client";
import { useToast } from "../components/Toast";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import { ListingImage } from "../components/ListingCard";
import { RowSkeleton } from "../components/Skeleton";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

// Staff only: every item copied from iBay, including ones the public showcase
// leaves out, plus the switch for the showcase itself.
export default function AdminIbayScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { isDesktopWeb, gutter } = useResponsive();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<IbayItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showcaseOn, setShowcaseOn] = useState(false);
  const page = useRef(0);
  // Ignores answers to searches the person has already typed past.
  const latest = useRef(0);

  const load = useCallback(
    async (q: string, nextPage: number) => {
      const ticket = ++latest.current;
      try {
        const res = await api.adminIbay(q, nextPage);
        if (ticket !== latest.current) return;
        page.current = nextPage;
        setItems((prev) => (nextPage === 0 ? res.items : [...(prev ?? []), ...res.items]));
        setTotal(res.total);
        setHasMore(res.hasMore);
        setShowcaseOn(res.showcaseOn);
      } catch (e) {
        if (ticket === latest.current) {
          setItems((prev) => prev ?? []);
          toast.error(errorMessage(e));
        }
      }
    },
    [toast]
  );

  useEffect(() => {
    const t = setTimeout(() => load(query.trim(), 0), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await load(query.trim(), page.current + 1);
    setLoadingMore(false);
  };

  // Optimistic: flips at once, and flips back if the server refuses.
  const toggleShowcase = (on: boolean) => {
    setShowcaseOn(on);
    api.setIbayShowcase(on).then(() => toast.success(on ? "iBay items are showing to everyone." : "iBay items are hidden from everyone.")).catch((e) => {
      setShowcaseOn(!on);
      toast.error(errorMessage(e));
    });
  };

  const toggleHidden = (item: IbayItem) => {
    const hidden = !item.hiddenAt;
    const apply = (hiddenAt: string | null) => setItems((list) => list?.map((i) => (i.id === item.id ? { ...i, hiddenAt } : i)) ?? list);
    apply(hidden ? new Date().toISOString() : null);
    api.hideIbayItem(item.id, hidden).catch((e) => {
      apply(item.hiddenAt);
      toast.error(errorMessage(e));
    });
  };

  const open = (item: IbayItem) => Linking.openURL(item.url).catch(() => toast.error("Couldn't open iBay. Please try again."));

  const renderItem = ({ item }: { item: IbayItem }) => (
    <Tap style={styles.row} onPress={() => open(item)} scaleTo={0.98} accessibilityLabel={`Open ${item.title} on iBay`}>
      <ListingImage uri={item.imageUrl ?? undefined} style={styles.thumb} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.price}>{item.price !== null ? `${item.currency ?? "MVR"} ${item.price.toLocaleString()}` : "No price given"}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[item.category, item.condition].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Tap style={styles.hide} nested onPress={() => toggleHidden(item)} scaleTo={0.92} accessibilityLabel={item.hiddenAt ? "Show this item" : "Hide this item"}>
        <Text style={[styles.hideText, !!item.hiddenAt && { color: colors.primary }]}>{item.hiddenAt ? "Show" : "Hide"}</Text>
      </Tap>
      <ExternalLink size={16} color={colors.textMuted} />
    </Tap>
  );

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="iBay items" />}
      <View style={[styles.searchWrap, { paddingHorizontal: gutter }]}>
        <View style={styles.search}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search iBay items"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            accessibilityLabel="Search iBay items"
          />
        </View>
        {!!items && (
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Show iBay items in the app</Text>
              <Text style={styles.count}>{total.toLocaleString()} items. {showcaseOn ? "Everyone can see recent ones." : "Only staff can see these."}</Text>
            </View>
            <Switch value={showcaseOn} onValueChange={toggleShowcase} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" accessibilityLabel="Show iBay items in the app" />
          </View>
        )}
      </View>
      {!items ? (
        <View style={{ paddingHorizontal: gutter }}>
          <RowSkeleton count={6} />
        </View>
      ) : (
        <FlatList showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: spacing.md }} /> : undefined}
          ListEmptyComponent={<EmptyState icon={Store} title={query ? "No matches" : "No iBay items yet"} message={query ? "Try a different word." : "They appear here once the import has run."} />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  searchWrap: { paddingTop: spacing.md, width: "100%", maxWidth: contentWidth.list, alignSelf: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: controlHeight.input, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, height: "100%", fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  switchLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  count: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  hide: { paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm },
  hideText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textMuted },
  list: { paddingVertical: spacing.md, gap: spacing.sm, width: "100%", maxWidth: contentWidth.list, alignSelf: "center", flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm + 2, ...cardShadow },
  thumb: { width: 76, height: 76, borderRadius: radius.md },
  title: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  price: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: 2 },
  meta: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
}));
