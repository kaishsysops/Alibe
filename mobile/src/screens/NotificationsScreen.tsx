import React, { useCallback, useMemo, useState } from "react";
import { View, Text, SectionList, RefreshControl } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { BellOff, MessageCircle, Tag, BellRing, Package, TrendingDown, Wallet, BadgeCheck, Store, CheckCircle2, XCircle, LucideIcon } from "lucide-react-native";
import { api, NotificationItem } from "../api/client";
import { useNotifications } from "../api/NotificationsContext";
import { useAuth } from "../api/AuthContext";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import { ListingImage } from "../components/ListingCard";
import { CountBadge } from "../components/Badges";
import { RowSkeleton } from "../components/Skeleton";
import { FadeIn } from "../components/Motion";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { timeAgo } from "../utils/time";

type Meta = { Icon: LucideIcon; tint: string; title: string; body: string; sub: string | null; action?: string };

// Today / Yesterday / This week / Earlier.
function dayGroup(iso: string) {
  const d = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = (start.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000;
  if (diff <= 0) return "Today";
  if (diff <= 1) return "Yesterday";
  if (diff <= 7) return "This week";
  return "Earlier";
}

export default function NotificationsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { isDesktopWeb, gutter } = useResponsive();
  const { data, refresh } = useNotifications();
  const { user } = useAuth();
  const [loading, setLoading] = useState(!data.items.length);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh().finally(() => setLoading(false));
    }, [refresh])
  );

  const open = async (item: NotificationItem) => {
    switch (item.type) {
      case "purchase":
        return navigation.navigate("Purchases");
      case "price_drop":
        if (user) await api.markPriceDropSeen(user.id, item.listingId).catch(() => {});
        refresh();
        return navigation.navigate("ProductDetail", { id: item.listingId });
      case "order":
        return navigation.navigate("OrderDetail", { id: item.orderId });
      case "saved_search":
        await api.markSearchSeen(item.savedSearchId).catch(() => {});
        refresh();
        return navigation.navigate("Tabs", { screen: "SearchTab", params: { ...item.params, fromSaved: Date.now() } });
      case "seller":
        // A newly approved store goes straight to choosing its plan.
        return navigation.navigate("SellerAccount", item.approved && item.kind === "STORE" ? { focus: "store-plan" } : undefined);
      case "post_review":
        return item.approved ? navigation.navigate("ProductDetail", { id: item.listingId }) : navigation.navigate("MyListings");
      default:
        return isDesktopWeb ? navigation.navigate("Tabs", { screen: "ChatsTab", params: { id: item.conversationId } }) : navigation.navigate("ChatThread", { id: item.conversationId });
    }
  };

  const metaFor = (item: NotificationItem): Meta => {
    switch (item.type) {
      case "purchase":
        return { Icon: Wallet, tint: colors.gold, title: `Pay MVR ${item.amount.toLocaleString()}`, body: "Transfer the money and upload your slip.", sub: item.label, action: "Pay" };
      case "price_drop":
        return { Icon: TrendingDown, tint: colors.success, title: `Price drop: MVR ${item.price.toLocaleString()}`, body: `Was MVR ${item.previousPrice.toLocaleString()}. You saved this item.`, sub: item.listingTitle };
      case "message":
        return { Icon: MessageCircle, tint: colors.primary, title: item.count > 1 ? `${item.count} new messages from ${item.fromName}` : `${item.fromName} sent a message`, body: item.preview, sub: item.listingTitle };
      case "offer":
        return { Icon: Tag, tint: colors.gold, title: `${item.fromName} offered MVR ${item.amount.toLocaleString()}`, body: "Accept, counter or decline.", sub: item.listingTitle, action: "Reply" };
      case "order":
        return item.role === "SELLER"
          ? { Icon: Package, tint: colors.primary, title: `Send ${item.listingTitle} to ${item.fromName}`, body: "You're responsible for delivery. Open the order to send it.", sub: item.listingTitle, action: "Send" }
          : { Icon: Package, tint: colors.primary, title: `${item.listingTitle} is on its way`, body: "Confirm once you have it.", sub: item.fromName };
      case "seller":
        return item.approved
          ? { Icon: item.kind === "STORE" ? Store : BadgeCheck, tint: colors.success, title: item.kind === "STORE" ? "Your store is approved" : "You're verified", body: item.kind === "STORE" ? "Tap to choose your Store plan and open your store page." : "Your posts now go live straight away.", sub: null, action: item.kind === "STORE" ? "Choose plan" : undefined }
          : { Icon: XCircle, tint: colors.danger, title: item.kind === "STORE" ? "Your store wasn't approved" : "Your ID check wasn't approved", body: item.note ?? "Open your seller account to try again.", sub: null };
      case "post_review":
        return item.approved
          ? { Icon: CheckCircle2, tint: colors.success, title: "Your post is live", body: `"${item.listingTitle}" passed review.`, sub: null }
          : { Icon: XCircle, tint: colors.danger, title: "Your post wasn't approved", body: item.note ?? "Open it to see why.", sub: item.listingTitle, action: "Fix" };
      default:
        return { Icon: BellRing, tint: colors.primary, title: `${item.newCount} new match${item.newCount === 1 ? "" : "es"} for "${item.label}"`, body: "From your saved search.", sub: null };
    }
  };

  const sections = useMemo(() => {
    const order = ["Today", "Yesterday", "This week", "Earlier"];
    const map = new Map<string, NotificationItem[]>();
    for (const item of data.items) {
      const g = dayGroup(item.createdAt);
      map.set(g, [...(map.get(g) ?? []), item]);
    }
    return order.filter((g) => map.has(g)).map((g) => ({ title: g, data: map.get(g)! }));
  }, [data.items]);

  const renderItem = ({ item, index }: { item: NotificationItem; index: number }) => {
    const meta = metaFor(item);
    const image = "image" in item ? item.image : null;
    const urgent = item.type === "message" || item.type === "offer" || item.type === "order" || item.type === "purchase";
    return (
      <FadeIn delay={Math.min(index, 8) * 30}>
        <Tap style={[styles.row, urgent && { borderLeftColor: meta.tint }]} onPress={() => open(item)} scaleTo={0.98}>
          <View>
            {image ? (
              <ListingImage uri={image} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.iconThumb, { backgroundColor: `${meta.tint}1A` }]}>
                <meta.Icon size={22} color={meta.tint} />
              </View>
            )}
            {image && (
              <View style={[styles.typeIcon, { backgroundColor: meta.tint }]}>
                <meta.Icon size={11} color="#fff" />
              </View>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={2}>
              {meta.title}
            </Text>
            <Text style={styles.body} numberOfLines={2}>
              {meta.body}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {meta.sub ? `${meta.sub} · ` : ""}
              {timeAgo(item.createdAt)}
            </Text>
          </View>
          {item.type === "message" ? (
            <CountBadge count={item.count} style={{ borderColor: "transparent" }} />
          ) : meta.action ? (
            <View style={[styles.action, { backgroundColor: `${meta.tint}1A` }]}>
              <Text style={[styles.actionText, { color: meta.tint }]}>{meta.action}</Text>
            </View>
          ) : null}
        </Tap>
      </FadeIn>
    );
  };

  const list = loading ? (
    <View style={{ paddingHorizontal: isDesktopWeb ? 0 : gutter }}>
      <RowSkeleton count={5} />
    </View>
  ) : (
    <SectionList
      showsVerticalScrollIndicator={false}
      sections={sections as any}
      keyExtractor={(i) => i.id}
      renderItem={renderItem}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }: any) => <Text style={styles.section}>{section.title}</Text>}
      contentContainerStyle={{ paddingHorizontal: isDesktopWeb ? 0 : gutter, paddingBottom: spacing.xl, flexGrow: 1 }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      ListHeaderComponent={
        data.items.length ? (
          <Text style={styles.summary}>
            {data.total ? `${data.total} ${data.total === 1 ? "thing needs" : "things need"} you` : "Nothing urgent"} · pull down to refresh
          </Text>
        ) : undefined
      }
      ListEmptyComponent={
        <EmptyState
          icon={BellOff}
          title="You're all caught up"
          message="Messages, offers on your items, price drops and saved-search matches show up here."
          actionLabel="Save a search"
          onAction={() => navigation.navigate("Tabs", { screen: "SearchTab" })}
        />
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            refresh().finally(() => setRefreshing(false));
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    />
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar active="notifications" />
        <View style={styles.desktopColumn}>
          <Text style={styles.header}>Notifications</Text>
          {list}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <ScreenHeader title="Notifications" />
      {list}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  desktopColumn: { maxWidth: contentWidth.list, width: "100%", alignSelf: "center", flex: 1, paddingTop: spacing.lg, paddingHorizontal: spacing.lg },
  header: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: spacing.xs },
  summary: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs },
  section: { fontSize: fontSize.caption, fontWeight: fontWeight.extrabold, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.7, marginTop: spacing.md, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.sm + 4, borderRadius: radius.lg, backgroundColor: colors.card, borderLeftWidth: 3, borderLeftColor: "transparent", ...cardShadow },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.skeleton },
  iconThumb: { alignItems: "center", justifyContent: "center" },
  typeIcon: { position: "absolute", right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.card, alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  body: { fontSize: fontSize.sm, color: colors.text, marginTop: 2, lineHeight: 18 },
  sub: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 3 },
  action: { paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: "center" },
  actionText: { fontSize: fontSize.caption, fontWeight: fontWeight.extrabold },
}));
