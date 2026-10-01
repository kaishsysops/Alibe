import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { MessageCircle, MessagesSquare, Inbox } from "lucide-react-native";
import { api, Conversation, mediaUrl } from "../api/client";
import { useNotifications } from "../api/NotificationsContext";
import { CountBadge, VerifiedBadge } from "../components/Badges";
import { useAuth } from "../api/AuthContext";
import EmptyState from "../components/EmptyState";
import WebNavBar from "../components/WebNavBar";
import ChatThreadView, { useOtherParty } from "../components/ChatThreadView";
import { ListingImage } from "../components/ListingCard";
import { RowSkeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, tabBarClearance, cardShadow, fontSize, fontWeight } from "../theme/theme";
import { useResponsive, MAX_CONTENT_WIDTH } from "../hooks/useResponsive";
import { timeAgo } from "../utils/time";

const LIST_PANE_WIDTH = 360;
type Filter = "ALL" | "UNREAD" | "BUYING" | "SELLING";
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "UNREAD", label: "Unread" },
  { key: "BUYING", label: "Buying" },
  { key: "SELLING", label: "Selling" },
];

function ConversationRow({ item, selected, onPress }: { item: Conversation; selected?: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const other = useOtherParty(item, user?.id)!;
  const last = item.messages[0];
  const role = item.buyerId === user?.id ? "Buying" : "Selling";
  const unread = item.unreadCount ?? 0;
  const lastText = last ? last.text || (last.mediaType === "VIDEO" ? "Sent a video" : "Sent a photo") : "";
  return (
    <Tap style={[styles.row, unread > 0 && styles.rowUnread, selected && styles.rowSelected]} onPress={onPress} scaleTo={0.98}>
      <View>
        <ListingImage uri={item.listing.images[0]} style={styles.thumb} />
        <View style={[styles.avatarBadge, { backgroundColor: other.avatarColor ?? colors.primary }]}>
          <Text style={styles.avatarBadgeText}>{other.name.charAt(0).toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
            <Text style={[styles.otherName, unread > 0 && styles.unreadText]} numberOfLines={1}>
              {other.name}
            </Text>
            {other.verified && <VerifiedBadge size={14} />}
          </View>
          <Text style={[styles.time, unread > 0 && { color: colors.primary, fontWeight: fontWeight.bold }]}>{timeAgo(last?.createdAt ?? item.updatedAt)}</Text>
        </View>
        <Text style={styles.listingTitle} numberOfLines={1}>
          {role}: {item.listing.title}
        </Text>
        <View style={styles.previewRow}>
          <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
            {last ? `${last.senderId === user?.id ? "You: " : ""}${lastText}` : "No messages yet"}
          </Text>
          <CountBadge count={unread} style={{ borderColor: "transparent" }} />
        </View>
      </View>
    </Tap>
  );
}

export default function ChatsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { isDesktopWeb, gutter } = useResponsive();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(route.params?.id);
  const [filter, setFilter] = useState<Filter>("ALL");
  const { data: notifications } = useNotifications();

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setConversations(await api.myConversations(user.id));
    } catch {
      toast.error("Couldn't load your chats. Pull down to try again.");
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

  // A new message anywhere (picked up by the notifications poller) refreshes
  // the list, so unread counts appear without pulling to refresh.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.unreadChats]);

  const visible = conversations.filter((c) =>
    filter === "UNREAD" ? (c.unreadCount ?? 0) > 0 : filter === "BUYING" ? c.buyerId === user?.id : filter === "SELLING" ? c.sellerId === user?.id : true
  );
  const unreadTotal = conversations.reduce((n, c) => n + ((c.unreadCount ?? 0) > 0 ? 1 : 0), 0);

  const filterRow = (
    <View style={[styles.filterRow, { paddingHorizontal: isDesktopWeb ? spacing.md : gutter }]}>
      {FILTERS.map((f) => {
        const active = filter === f.key;
        return (
          <Tap key={f.key} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setFilter(f.key)} scaleTo={0.92}>
            <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            {f.key === "UNREAD" && unreadTotal > 0 && (
              <View style={[styles.filterCount, active && { backgroundColor: colors.inverseText }]}>
                <Text style={[styles.filterCountText, active && { color: colors.text }]}>{unreadTotal}</Text>
              </View>
            )}
          </Tap>
        );
      })}
    </View>
  );

  // Desktop: "Chat with seller" lands here with the conversation to open.
  useEffect(() => {
    if (route.params?.id) setSelectedId(route.params.id);
  }, [route.params?.id]);

  useEffect(() => {
    if (isDesktopWeb && !selectedId && conversations.length) setSelectedId(conversations[0].id);
  }, [isDesktopWeb, selectedId, conversations]);

  const empty =
    filter !== "ALL" && conversations.length > 0 ? (
      <EmptyState
        icon={Inbox}
        compact
        title={filter === "UNREAD" ? "You're all caught up" : `No ${filter === "BUYING" ? "buying" : "selling"} chats`}
        message={filter === "UNREAD" ? "New messages will show up here." : undefined}
        actionLabel="Show all chats"
        onAction={() => setFilter("ALL")}
      />
    ) : (
    <EmptyState
      icon={MessageCircle}
      title="No chats yet"
      message="When you message a seller, or a buyer messages you, the conversation shows up here."
      actionLabel="Find something to buy"
      onAction={() => navigation.navigate("SearchTab")}
    />
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar active="chats" />
        <View style={[styles.desktopColumn, { paddingHorizontal: gutter }]}>
          <View style={styles.split}>
            <View style={styles.listPane}>
              <Text style={styles.paneTitle}>Chats</Text>
              {filterRow}
              {loading ? (
                <RowSkeleton count={6} />
              ) : (
                <FlatList
                  data={visible}
                  keyExtractor={(c) => c.id}
                  contentContainerStyle={{ padding: spacing.sm, gap: 2, flexGrow: 1 }}
                  ListEmptyComponent={empty}
                  renderItem={({ item }) => <ConversationRow item={item} selected={item.id === selectedId} onPress={() => setSelectedId(item.id)} />}
                />
              )}
            </View>
            <View style={styles.threadPane}>
              {selectedId ? (
                <ChatThreadView key={selectedId} conversationId={selectedId} onLoaded={() => load()} />
              ) : (
                <EmptyState icon={MessagesSquare} title="Pick a conversation" message="Choose a chat on the left to read and reply." />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={[styles.header, { paddingHorizontal: gutter }]}>Chats</Text>
      {filterRow}
      {loading ? (
        <View style={{ paddingHorizontal: gutter - spacing.sm }}>
          <RowSkeleton count={7} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <ConversationRow item={item} onPress={() => navigation.navigate("ChatThread", { id: item.id })} />}
          contentContainerStyle={{ paddingHorizontal: gutter - spacing.sm, paddingBottom: tabBarClearance, gap: 2, flexGrow: 1 }}
          ListEmptyComponent={empty}
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
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  desktopColumn: { maxWidth: MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center", flex: 1, paddingVertical: spacing.lg },
  split: { flex: 1, flexDirection: "row", backgroundColor: colors.card, borderRadius: radius.lg, overflow: "hidden", ...cardShadow },
  listPane: { width: LIST_PANE_WIDTH, borderRightWidth: 1, borderRightColor: colors.border },
  paneTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  threadPane: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: spacing.sm, letterSpacing: -0.3 },
  row: { flexDirection: "row", gap: spacing.sm + 4, padding: spacing.sm, alignItems: "center", borderRadius: radius.md },
  rowSelected: { backgroundColor: colors.primaryTint },
  rowUnread: { backgroundColor: colors.primaryTint },
  unreadText: { fontWeight: fontWeight.extrabold },
  previewRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  previewUnread: { color: colors.text, fontWeight: fontWeight.semibold },
  filterRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  filterText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  filterTextActive: { color: colors.inverseText },
  filterCount: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  filterCountText: { color: "#fff", fontSize: fontSize.micro, fontWeight: fontWeight.extrabold },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.skeleton },
  avatarBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadgeText: { color: "#fff", fontSize: fontSize.micro, fontWeight: fontWeight.bold },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  otherName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, flex: 1 },
  time: { fontSize: fontSize.caption, color: colors.textMuted, marginLeft: spacing.xs },
  listingTitle: { fontSize: fontSize.caption, color: colors.primary, marginTop: 2, fontWeight: fontWeight.semibold },
  preview: { flex: 1, fontSize: fontSize.sm, color: colors.textMuted },
}));
