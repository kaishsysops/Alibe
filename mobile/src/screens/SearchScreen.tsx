import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Search as SearchIcon, X } from "lucide-react-native";
import { api, Atoll, Listing } from "../api/client";
import ProductGrid from "../components/ProductGrid";
import WebNavBar from "../components/WebNavBar";
import { colors, spacing, radius } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

const MAX_CONTENT_WIDTH = 1400;

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDesktopWeb, width } = useResponsive();
  const [query, setQuery] = useState(route.params?.q ?? "");
  const [categorySlug, setCategorySlug] = useState<string | undefined>(route.params?.categorySlug);
  const [categoryName, setCategoryName] = useState<string | undefined>(route.params?.categoryName);
  const [atolls, setAtolls] = useState<Atoll[]>([]);
  const [atollId, setAtollId] = useState<string | undefined>(undefined);
  const [results, setResults] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.atolls().then(setAtolls).catch(() => {});
  }, []);

  const search = async (q?: string, catSlug?: string) => {
    setLoading(true);
    try {
      const list = await api.listings({ q: (q ?? query) || undefined, atollId, categorySlug: catSlug ?? categorySlug });
      setResults(list);
    } finally {
      setLoading(false);
    }
  };

  // Re-run whenever this screen receives new navigation params (e.g. tapping
  // "See all" on a Home rail while already on this tab).
  useEffect(() => {
    const q = route.params?.q ?? "";
    const cat = route.params?.categorySlug;
    setQuery(q);
    setCategorySlug(cat);
    setCategoryName(route.params?.categoryName);
    search(q, cat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.q, route.params?.categorySlug]);

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atollId]);

  const clearCategory = () => {
    setCategorySlug(undefined);
    setCategoryName(undefined);
    search(query, undefined);
  };

  const goToProduct = (l: Listing) => navigation.navigate("ProductDetail", { id: l.id });
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - spacing.xl * 2;

  const categoryFilterBadge = categoryName ? (
    <TouchableOpacity style={styles.categoryFilter} onPress={clearCategory}>
      <Text style={styles.categoryFilterText}>{categoryName}</Text>
      <X size={13} color="#fff" />
    </TouchableOpacity>
  ) : null;

  const atollChips = (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipRow}
      contentContainerStyle={{ paddingHorizontal: isDesktopWeb ? 0 : spacing.md }}
      data={[{ id: "all", name: "All atolls" }, ...atolls]}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.chip, (item.id === "all" ? !atollId : atollId === item.id) && styles.chipActive]}
          onPress={() => setAtollId(item.id === "all" ? undefined : item.id)}
        >
          <Text style={[styles.chipText, (item.id === "all" ? !atollId : atollId === item.id) && styles.chipTextActive]}>
            {item.name}
          </Text>
        </TouchableOpacity>
      )}
    />
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.desktopContainer}>
        <WebNavBar active="search" onSearch={(q) => { setQuery(q); search(q); }} />
        <View style={{ maxWidth: MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.lg, flex: 1 }}>
          <Text style={styles.header}>Browse listings</Text>
          {categoryFilterBadge}
          {atollChips}
          {loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
          ) : (
            <ProductGrid
              data={results}
              onPressItem={goToProduct}
              containerWidth={contentWidth}
              horizontalPadding={0}
              ListEmptyComponent={<Text style={styles.empty}>No matches. Try a different search or island.</Text>}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search listings..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => search()}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={() => search()}>
          <SearchIcon size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {categoryFilterBadge}
      {atollChips}

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      ) : (
        <ProductGrid
          data={results}
          onPressItem={goToProduct}
          ListEmptyComponent={<Text style={styles.empty}>No matches. Try a different search or island.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  desktopContainer: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  searchBar: { flexDirection: "row", paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.card,
  },
  searchButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, justifyContent: "center" },
  chipRow: { flexGrow: 0, marginVertical: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  categoryFilter: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  categoryFilterText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
});
