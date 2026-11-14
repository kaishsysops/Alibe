import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ChevronLeft, ChevronRight, Layers } from "lucide-react-native";
import { api, Category } from "../api/client";
import { buildCategoryTree } from "../utils/categoryTree";
import { categoryLook } from "../theme/categoryIcons";
import CategoryTile from "../components/CategoryTile";
import WebNavBar from "../components/WebNavBar";
import { Skeleton } from "../components/Skeleton";
import { FadeIn } from "../components/Motion";
import { useToast } from "../components/Toast";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

// Browsing categories one level at a time: a banner in the category's colour,
// then its subcategories as photo tiles. Tap a tile with more inside to go
// deeper; tap one without to shop it. "See all" shops the whole branch.
let lastCategories: Category[] | null = null;
const MAX_WIDTH = 760;

// Darker shade of a hex colour, for the banner's gradient.
function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  return `#${((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, "0")}`;
}

export default function CategoriesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const slug: string | undefined = route.params?.slug;
  const { isDesktopWeb, gutter } = useResponsive();
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  // A deeper level reuses what the previous one loaded: no flash.
  const [categories, setCategories] = useState<Category[] | null>(lastCategories);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const list = await api.categories();
      lastCategories = list;
      setCategories(list);
    } catch {
      setCategories((c) => c ?? []);
      toast.error("Couldn't load categories. Pull down to try again.");
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const tree = useMemo(() => buildCategoryTree(categories ?? []), [categories]);
  const here = slug ? tree.bySlug.get(slug) : undefined;
  // Empty subcategories stay out of the way while browsing.
  const children = tree.childrenOf(slug).filter((c) => (c.listingCount ?? 0) > 0 || !here);
  const trail = tree.pathOf(slug).slice(0, -1);
  const look = here ? categoryLook(here, tree) : { Icon: Layers, color: colors.primary };
  const total = here ? here.listingCount ?? 0 : tree.roots.reduce((n, c) => n + (c.listingCount ?? 0), 0);

  const shop = (c?: Category) => navigation.navigate("Tabs", { screen: "SearchTab", params: { categorySlug: c?.slug, categoryName: c?.name } });
  const open = (c: Category) => (tree.childrenOf(c.slug).some((k) => (k.listingCount ?? 0) > 0) ? navigation.push("Categories", { slug: c.slug }) : shop(c));

  const area = Math.min(width, MAX_WIDTH) - gutter * 2;
  const columns = area > 560 ? 3 : 2;
  const tileWidth = Math.floor((area - spacing.sm * (columns - 1)) / columns);
  const tileHeight = Math.round(tileWidth * 0.78);
  const Icon = look.Icon;

  return (
    <View style={styles.container}>
      {isDesktopWeb && <WebNavBar active="search" />}
      {/* White clock and battery on the coloured banner. */}
      {focused && <StatusBar style="light" />}
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (setRefreshing(true), load())} tintColor="#fff" />}
      >
        <LinearGradient colors={[look.color, shade(look.color, 0.35)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: (isDesktopWeb ? spacing.lg : insets.top + spacing.sm) }]}>
          {/* Big faint icon for depth. */}
          <View style={styles.heroWatermark} pointerEvents="none">
            <Icon size={180} color="rgba(255,255,255,0.12)" strokeWidth={1.5} />
          </View>
          <View style={[styles.heroInner, { paddingHorizontal: gutter }]}>
            {!isDesktopWeb && (
              <Tap style={styles.back} onPress={() => navigation.goBack()} hitSlop={8} scaleTo={0.88} accessibilityLabel="Back">
                <ChevronLeft size={22} color="#fff" strokeWidth={2.6} />
              </Tap>
            )}
            {trail.length > 0 && (
              <Text style={styles.trail} numberOfLines={1}>
                {trail.map((c) => c.name).join("  ›  ")}
              </Text>
            )}
            <View style={styles.heroRow}>
              <View style={styles.heroIcon}>
                <Icon size={28} color={look.color} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {here?.name ?? "All categories"}
                </Text>
                <Text style={styles.heroMeta}>
                  {total.toLocaleString()} items{children.length ? ` · ${children.length} ${here ? "subcategories" : "categories"}` : ""}
                </Text>
              </View>
            </View>
            <Tap style={styles.seeAll} onPress={() => shop(here)} scaleTo={0.96} accessibilityLabel={here ? `See all ${total} items in ${here.name}` : "See everything for sale"}>
              <Text style={[styles.seeAllText, { color: look.color }]}>{here ? `See all ${total.toLocaleString()} items` : "See everything for sale"}</Text>
              <ChevronRight size={18} color={look.color} strokeWidth={2.6} />
            </Tap>
          </View>
        </LinearGradient>

        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          {!categories ? (
            <View style={styles.grid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} width={tileWidth} height={tileHeight} rounded={radius.lg} />
              ))}
            </View>
          ) : (
            <View style={styles.grid}>
              {children.map((c, i) => {
                const { Icon: TileIcon, color } = categoryLook(c, tree);
                const inside = tree.childrenOf(c.slug).filter((k) => (k.listingCount ?? 0) > 0).length;
                return (
                  <FadeIn key={c.id} delay={Math.min(i, 9) * 40}>
                    <CategoryTile
                      name={c.name}
                      subtitle={`${(c.listingCount ?? 0).toLocaleString()} items${inside ? "  ›" : ""}`}
                      image={c.photo ?? undefined}
                      Icon={TileIcon}
                      color={color}
                      size={tileWidth}
                      height={tileHeight}
                      onPress={() => open(c)}
                    />
                  </FadeIn>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  hero: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden", paddingBottom: spacing.lg },
  heroWatermark: { position: "absolute", right: -30, bottom: -40 },
  heroInner: { width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center", gap: spacing.sm },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  trail: { color: "rgba(255,255,255,0.85)", fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  heroRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  heroIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  heroTitle: { color: "#fff", fontSize: fontSize.display, fontWeight: fontWeight.extrabold, letterSpacing: -0.5 },
  heroMeta: { color: "rgba(255,255,255,0.9)", fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: 2 },
  seeAll: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "#fff", borderRadius: radius.pill, height: 48, marginTop: spacing.sm },
  seeAllText: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  body: { width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center", paddingTop: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
}));
