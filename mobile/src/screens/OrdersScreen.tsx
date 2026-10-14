import React, { useCallback, useState } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { ChevronRight, Package } from "lucide-react-native";
import { api, Order, OrderStatus } from "../api/client";
import { useAuth } from "../api/AuthContext";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import { ListingImage } from "../components/ListingCard";
import { RowSkeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import Tap from "../components/Tap";
import { FadeIn } from "../components/Motion";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { Colors, spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { timeAgo } from "../utils/time";

export function orderStatusMeta(status: OrderStatus, role: "BUYER" | "SELLER", colors: Colors) {
  switch (status) {
    case "AWAITING_DISPATCH":
      return { label: role === "SELLER" ? "Send it now" : "Being prepared", color: role === "SELLER" ? colors.primary : colors.gold, needsAction: role === "SELLER" };
    case "DISPATCHED":
      return { label: role === "SELLER" ? "Enter buyer's code" : "On its way", color: colors.primary, needsAction: role === "SELLER" };
    case "DELIVERED":
      return { label: "Delivered", color: colors.success, needsAction: false };
    case "DISPUTED":
      return { label: "Problem reported", color: colors.danger, needsAction: false };
    default:
      return { label: "Cancelled", color: colors.textMuted, needsAction: false };
  }
}

export default function OrdersScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDesktopWeb, gutter } = useResponsive();
  const [tab, setTab] = useState<"BUYING" | "SELLING">(route.params?.tab ?? "BUYING");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setOrders(await api.orders(user.id));
    } catch {
      toast.error("Couldn't load your orders.");
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

  const visible = orders.filter((o) => (tab === "SELLING" ? o.role === "SELLER" : o.role === "BUYER"));
  const actionCount = (role: "BUYER" | "SELLER") => orders.filter((o) => o.role === role && orderStatusMeta(o.status, role, colors).needsAction).length;

  const tabs = (
    <View style={[styles.tabRow, { paddingHorizontal: isDesktopWeb ? 0 : gutter }]}>
      {(["BUYING", "SELLING"] as const).map((t) => {
        const active = tab === t;
        const count = actionCount(t === "BUYING" ? "BUYER" : "SELLER");
        return (
          <Tap key={t} style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(t)} scaleTo={0.94}>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{t === "BUYING" ? "Buying" : "Selling"}</Text>
            {count > 0 && (
              <View style={styles.tabCount}>
                <Text style={styles.tabCountText}>{count}</Text>
              </View>
            )}
          </Tap>
        );
      })}
    </View>
  );

  const list = loading ? (
    <View style={{ paddingHorizontal: gutter }}>
      <RowSkeleton count={4} />
    </View>
  ) : (
    <FlatList
      data={visible}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ paddingHorizontal: isDesktopWeb ? 0 : gutter, paddingBottom: spacing.xl, gap: spacing.sm, flexGrow: 1 }}
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
      ListEmptyComponent={
        <EmptyState
          icon={Package}
          title={tab === "BUYING" ? "No orders yet" : "No sales yet"}
          message={tab === "BUYING" ? "When a seller accepts your offer, the order and its delivery show up here." : "Accept an offer or sell to a buyer from a chat. You'll manage delivery here."}
          actionLabel={tab === "BUYING" ? "Browse listings" : "My listings"}
          onAction={() => (tab === "BUYING" ? navigation.navigate("Tabs", { screen: "SearchTab" }) : navigation.navigate("MyListings"))}
        />
      }
      renderItem={({ item, index }) => {
        const meta = orderStatusMeta(item.status, item.role, colors);
        const other = item.role === "SELLER" ? item.buyer : item.seller;
        return (
          <FadeIn delay={Math.min(index, 8) * 50}>
          <Tap style={[styles.row, meta.needsAction && styles.rowAction]} onPress={() => navigation.navigate("OrderDetail", { id: item.id })} scaleTo={0.98}>
            <ListingImage uri={item.listing.images[0]} style={styles.thumb} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>
                {item.listing.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                MVR {item.amount.toLocaleString()} {item.role === "SELLER" ? "to" : "from"} {other.name}
              </Text>
              <View style={styles.statusRow}>
                <View style={[styles.status, { backgroundColor: `${meta.color}1A` }]}>
                  <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <Text style={styles.time}>{timeAgo(item.createdAt, true)}</Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </Tap>
          </FadeIn>
        );
      }}
    />
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar />
        <View style={styles.desktopColumn}>
          <Text style={styles.header}>Orders</Text>
          {tabs}
          {list}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <ScreenHeader title="Orders" />
      {tabs}
      {list}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  desktopColumn: { maxWidth: 760, width: "100%", alignSelf: "center", flex: 1, paddingTop: spacing.lg, paddingHorizontal: spacing.lg },
  header: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: spacing.md },
  tabRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.text, borderColor: colors.text },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  tabTextActive: { color: colors.inverseText },
  tabCount: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  tabCountText: { color: "#fff", fontSize: fontSize.micro, fontWeight: fontWeight.extrabold },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.sm + 4, borderRadius: radius.lg, backgroundColor: colors.card, ...cardShadow },
  rowAction: { borderWidth: 1.5, borderColor: colors.primaryLight },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.skeleton },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.text, marginTop: 2 },
  time: { fontSize: fontSize.caption, color: colors.textMuted },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 6 },
  status: { paddingHorizontal: spacing.sm + 2, height: 26, borderRadius: radius.pill, justifyContent: "center" },
  statusText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold },
}));
