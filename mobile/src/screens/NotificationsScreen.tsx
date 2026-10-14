import React, { useCallback, useState } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { BellOff, MessageCircle, Tag, BellRing, ChevronRight, Package } from "lucide-react-native";
import { api, NotificationItem } from "../api/client";
import { useNotifications } from "../api/NotificationsContext";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import { ListingImage } from "../components/ListingCard";
import { CountBadge } from "../components/Badges";
import { RowSkeleton } from "../components/Skeleton";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { timeAgo } from "../utils/time";

export default function NotificationsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { isDesktopWeb, gutter } = useResponsive();
  const { data, refresh } = useNotifications();
  const [loading, setLoading] = useState(!data.items.length);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh().finally(() => setLoading(false));
    }, [refresh])
  );

  const open = async (item: NotificationItem) => {
    if (item.type === "order") {
      navigation.navigate("OrderDetail", { id: item.orderId });
    } else if (item.type === "saved_search") {
      await api.markSearchSeen(item.savedSearchId).catch(() => {});
      refresh();
      navigation.navigate("Tabs", { screen: "SearchTab", params: { ...item.params, fromSaved: Date.now() } });
    } else if (isDesktopWeb) {
      navigation.navigate("Tabs", { screen: "ChatsTab", params: { id: item.conversationId } });
    } else {
      navigation.navigate("ChatThread", { id: item.conversationId });
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const meta =
      item.type === "message"
        ? { Icon: MessageCircle, title: item.count > 1 ? `${item.count} new messages from ${item.fromName}` : `New message from ${item.fromName}`, body: item.preview, sub: item.listingTitle }
        : item.type === "offer"
        ? { Icon: Tag, title: `${item.fromName} offered MVR ${item.amount.toLocaleString()}`, body: "Tap to accept, counter or decline.", sub: item.listingTitle }
        : item.type === "order"
        ? item.role === "SELLER"
          ? { Icon: Package, title: `Send ${item.listingTitle} to ${item.fromName}`, body: "You're responsible for delivery. Open the order to send it.", sub: item.listingTitle }
          : { Icon: Package, title: `${item.listingTitle} is on its way`, body: "Confirm once you have it so the seller's delivery is verified.", sub: item.fromName }
        : { Icon: BellRing, title: `${item.newCount} new match${item.newCount === 1 ? "" : "es"} for "${item.label}"`, body: "From your saved search.", sub: null };
    const image = item.type === "saved_search" ? null : item.image;
    return (
      <Tap style={styles.row} onPress={() => open(item)} scaleTo={0.98}>
        <View>
          {image ? (
            <ListingImage uri={image} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.iconThumb]}>
              <meta.Icon size={22} color={colors.primary} />
            </View>
          )}
          {image && (
            <View style={styles.typeIcon}>
              <meta.Icon size={11} color="#fff" />
            </View>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={2}>
            {meta.title}
          </Text>
          <Text style={styles.body} numberOfLines={1}>
            {meta.body}
          </Text>
          {!!meta.sub && (
            <Text style={styles.sub} numberOfLines={1}>
              {meta.sub} · {timeAgo(item.createdAt)}
            </Text>
          )}
        </View>
        {item.type === "message" ? <CountBadge count={item.count} style={{ borderColor: "transparent" }} /> : <ChevronRight size={16} color={colors.textMuted} />}
      </Tap>
    );
  };

  const list = loading ? (
    <View style={{ paddingHorizontal: gutter }}>
      <RowSkeleton count={5} />
    </View>
  ) : (
    <FlatList
      data={data.items}
      keyExtractor={(i) => i.id}
      renderItem={renderItem}
      contentContainerStyle={{ paddingHorizontal: isDesktopWeb ? 0 : gutter, paddingBottom: spacing.xl, gap: spacing.sm, flexGrow: 1 }}
      ListEmptyComponent={
        <EmptyState
          icon={BellOff}
          title="You're all caught up"
          message="New messages, offers on your items and saved-search matches will show up here."
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
  desktopColumn: { maxWidth: 720, width: "100%", alignSelf: "center", flex: 1, paddingTop: spacing.lg, paddingHorizontal: spacing.lg },
  header: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.sm + 4, borderRadius: radius.lg, backgroundColor: colors.card, ...cardShadow },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.skeleton },
  iconThumb: { backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  typeIcon: { position: "absolute", right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.card, alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  body: { fontSize: fontSize.sm, color: colors.text, marginTop: 2 },
  sub: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
}));
