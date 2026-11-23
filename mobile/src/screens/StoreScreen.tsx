import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, RefreshControl, Share, Platform } from "react-native";
import { Image } from "expo-image";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Store as StoreIcon, MessageCircle, Share2, Calendar } from "lucide-react-native";
import { api, errorMessage, mediaUrl, StorePage } from "../api/client";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import ProductGrid from "../components/ProductGrid";
import EmptyState from "../components/EmptyState";
import { SellerBadgePill, RatingSummary } from "../components/Badges";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

// alibe.online/store/:slug: an approved store with a live Store plan.
export default function StoreScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDesktopWeb, gutter, width } = useResponsive() as ReturnType<typeof useResponsive> & { width?: number };
  const [page, setPage] = useState<StorePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const slug: string = route.params?.slug;

  const load = useCallback(async () => {
    try {
      setPage(await api.storePage(slug));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [slug]);
  useEffect(() => {
    load();
  }, [load]);

  const share = () => {
    const url = `https://alibe.online/store/${slug}`;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as any).clipboard && !(navigator as any).share) {
      (navigator as any).clipboard.writeText(url);
      return;
    }
    Share.share({ message: `${page?.store.name} on Alibe: ${url}`, url }).catch(() => {});
  };

  const header = page ? (
    <View style={styles.header}>
      <View style={styles.cover} />
      <View style={styles.headCard}>
        <View style={styles.logoWrap}>
          {page.store.logoUrl ? <Image source={{ uri: mediaUrl(page.store.logoUrl) }} style={styles.logo} contentFit="cover" /> : <StoreIcon size={34} color={colors.primary} />}
        </View>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{page.store.name}</Text>
          <SellerBadgePill badge={page.owner.badge ?? "STORE"} />
        </View>
        <View style={styles.metaRow}>
          <RatingSummary rating={page.owner.rating} />
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>{page.listingCount} items</Text>
          <Text style={styles.dot}>·</Text>
          <Calendar size={13} color={colors.textMuted} />
          <Text style={styles.meta}>Since {new Date(page.store.since).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</Text>
        </View>
        <View style={styles.actions}>
          <Tap style={styles.primary} onPress={() => navigation.navigate("SellerProfile", { id: page.owner.id })} scaleTo={0.97}>
            <MessageCircle size={17} color="#fff" />
            <Text style={styles.primaryText}>Contact the store</Text>
          </Tap>
          <Tap style={styles.secondary} onPress={share} scaleTo={0.95} accessibilityLabel="Share this store">
            <Share2 size={18} color={colors.text} />
          </Tap>
        </View>
      </View>
      <Text style={styles.section}>Everything for sale</Text>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar /> : <ScreenHeader title={page?.store.name ?? "Store"} />}
      {!page && !error ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <EmptyState icon={StoreIcon} title="This store isn't open" message={error} />
      ) : (
        <ProductGrid
          data={page!.listings}
          onPressItem={(l) => navigation.push("ProductDetail", { id: l.id })}
          ListHeaderComponent={header}
          horizontalPadding={gutter}
          ListEmptyComponent={<EmptyState icon={StoreIcon} title="Nothing for sale right now" message="Check back soon." />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (setRefreshing(true), load())} tintColor={colors.primary} />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingBottom: spacing.sm },
  cover: { height: 110, borderRadius: radius.lg, backgroundColor: colors.primary, opacity: 0.9, marginTop: spacing.sm },
  headCard: { marginTop: -50, marginHorizontal: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 4, paddingTop: 0, alignItems: "center", gap: spacing.sm, ...cardShadow },
  logoWrap: { width: 92, height: 92, borderRadius: 26, marginTop: -46, backgroundColor: colors.card, borderWidth: 4, borderColor: colors.card, alignItems: "center", justifyContent: "center", overflow: "hidden", ...cardShadow },
  logo: { width: "100%", height: "100%" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap", justifyContent: "center", marginTop: spacing.xs },
  name: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, textAlign: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  dot: { color: colors.textMuted },
  actions: { flexDirection: "row", gap: spacing.sm, alignSelf: "stretch", marginTop: spacing.sm },
  primary: { flex: 1, flexDirection: "row", gap: spacing.sm, height: 46, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.base },
  secondary: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  section: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.xs },
}));
