import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, FlatList, Platform, AppState, Image, ActivityIndicator } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Send, Clock, AlertCircle, ChevronRight, MessageCircle, ImagePlus, Play, Tag, Star, Ban, CheckCheck, Package } from "lucide-react-native";
import { api, Conversation, Message, Offer, Thread, newClientId, errorMessage, mediaUrl, uploadMedia } from "../api/client";
import { useAuth, DRAFT_PREFIX } from "../api/AuthContext";
import { useNotifications } from "../api/NotificationsContext";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { usePersistentState } from "../hooks/usePersistentState";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { clockTime, dayLabel } from "../utils/time";
import { ListingImage } from "./ListingCard";
import { ContactIconButtons } from "./ContactButtons";
import { Skeleton, SkeletonGroup } from "./Skeleton";
import { OfferSheet, ReviewSheet } from "./TrustSheets";
import MediaViewer from "./MediaViewer";
import EmptyState from "./EmptyState";
import { useToast } from "./Toast";
import Tap from "./Tap";
import { FadeIn, Nudge } from "./Motion";

const POLL_INTERVAL_MS = 3000;
const QUICK_REPLIES_BUYER = ["Is this still available?", "What's your best price?", "Can I see it today?"];
const QUICK_REPLIES_SELLER = ["Yes, it's available.", "Price is firm, sorry.", "When can you pick it up?"];

type Media = { localUri: string; mime: string; type: "IMAGE" | "VIDEO" };
type Pending = { clientId: string; text: string; createdAt: string; status: "sending" | "failed"; media?: Media; progress?: number; uploaded?: { url: string; type: "IMAGE" | "VIDEO" } };
type Row = {
  key: string;
  text: string;
  createdAt: string;
  mine: boolean;
  status?: Pending["status"];
  progress?: number;
  clientId?: string;
  media?: { uri: string; type: "IMAGE" | "VIDEO" };
  offer?: Offer;
  divider?: boolean;
};

export function useOtherParty(c: Conversation | null, userId?: string) {
  if (!c) return null;
  return c.buyerId === userId ? c.seller : c.buyer;
}

function ThreadSkeleton() {
  return (
    <SkeletonGroup>
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        <Skeleton width="100%" height={64} rounded={radius.md} />
        {[0.55, 0.4, 0.65, 0.35, 0.5].map((w, i) => (
          <View key={i} style={{ alignItems: i % 2 ? "flex-end" : "flex-start" }}>
            <Skeleton width={`${w * 100}%`} height={40} rounded={radius.lg} />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

const OFFER_STATUS_LABEL: Record<Offer["status"], string> = {
  PENDING: "Waiting for a reply",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  COUNTERED: "Replaced by a newer offer",
  WITHDRAWN: "Withdrawn",
};

export default function ChatThreadView({
  conversationId,
  onLoaded,
  showContactButtons = true,
}: {
  conversationId: string;
  onLoaded?: (c: Conversation) => void;
  showContactButtons?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const toast = useToast();
  const { user } = useAuth();
  const notifications = useNotifications();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [order, setOrder] = useState<Thread["order"]>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [offerSheet, setOfferSheet] = useState(false);
  const [reviewSheet, setReviewSheet] = useState(false);
  const [viewer, setViewer] = useState<{ uri: string; type: "IMAGE" | "VIDEO" } | null>(null);
  // Where "New messages" goes: the read position when the chat was opened.
  const readMarker = useRef<string | null | undefined>(undefined);
  // Composer text survives leaving the chat and coming back.
  const [draft, setDraft] = usePersistentState(`${DRAFT_PREFIX}chat.${conversationId}`, { text: "" });

  useEffect(() => {
    setConversation(null);
    setMessages([]);
    setOffers([]);
    setPending([]);
    setLoaded(false);
    setFailed(false);
    readMarker.current = undefined;
    api
      .conversation(conversationId)
      .then((c) => {
        setConversation(c);
        onLoaded?.(c);
        const mine = c.buyerId === user?.id ? "buyer" : "seller";
        readMarker.current = (c as any)[`${mine}LastReadAt`] ?? null;
      })
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // While this chat is on screen, its messages don't raise banners or pushes.
  useEffect(() => {
    if (!isFocused) return;
    notifications.setActiveConversation(conversationId);
    return () => notifications.setActiveConversation(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, conversationId]);

  const loadThread = useCallback(async () => {
    if (!user) return;
    try {
      const t = await api.thread(conversationId, user.id);
      setMessages(t.messages);
      setOffers(t.offers);
      setOtherLastReadAt(t.otherLastReadAt);
      setBlocked(t.blocked);
      setOrder(t.order);
      notifications.refresh();
    } catch {
      // keep what we have; next poll retries
    } finally {
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user]);

  useEffect(() => {
    if (!isFocused) return;
    loadThread();
    const interval = setInterval(() => AppState.currentState === "active" && loadThread(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isFocused, loadThread]);

  const deliver = useCallback(
    async (p: Pending) => {
      if (!user) return;
      const patch = (changes: Partial<Pending>) => setPending((prev) => prev.map((x) => (x.clientId === p.clientId ? { ...x, ...changes } : x)));
      patch({ status: "sending" });
      try {
        let uploaded = p.uploaded;
        if (p.media && !uploaded) {
          uploaded = await uploadMedia(p.media.localUri, p.media.mime, (f) => patch({ progress: f }));
          patch({ uploaded });
        }
        // Same clientId on retry, so the backend never stores a message twice.
        const saved = await api.sendMessage(conversationId, user.id, p.text, p.clientId, uploaded);
        setMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]));
        setPending((prev) => prev.filter((x) => x.clientId !== p.clientId));
      } catch (e) {
        patch({ status: "failed" });
        toast.error(errorMessage(e, "Message not sent. Tap it to try again."));
      }
    },
    [conversationId, user, toast]
  );

  const queue = (text: string, media?: Media) => {
    if (!user || (!text && !media)) return;
    // Optimistic: the bubble appears immediately with a "sending" clock.
    const p: Pending = { clientId: newClientId(), text, createdAt: new Date().toISOString(), status: "sending", media };
    setPending((prev) => [...prev, p]);
    deliver(p);
  };

  const send = (textOverride?: string) => {
    const text = (textOverride ?? draft.text).trim();
    if (!text) return;
    if (!textOverride) setDraft({ text: "" });
    queue(text);
  };

  const attach = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return toast.error("Allow photo access in Settings to send photos and videos.");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
      videoMaxDuration: 60,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });
    if (result.canceled) return;
    for (const a of result.assets) {
      const isVideo = a.type === "video" || (a.mimeType ?? "").startsWith("video/");
      if (a.fileSize && a.fileSize > 50 * 1024 * 1024) {
        toast.error("That file is over 50 MB. Try a shorter video.");
        continue;
      }
      queue("", { localUri: a.uri, mime: a.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"), type: isVideo ? "VIDEO" : "IMAGE" });
    }
  };

  const [respond] = useSingleFlight(async (offer: Offer, action: "ACCEPT" | "DECLINE" | "WITHDRAW") => {
    if (!user) return;
    // Optimistic status flip; the server only lets a pending offer change once.
    const next = action === "ACCEPT" ? "ACCEPTED" : action === "DECLINE" ? "DECLINED" : "WITHDRAWN";
    setOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, status: next } : o)));
    try {
      const r = await api.respondToOffer(offer.id, user.id, action);
      if (action === "ACCEPT" && r.orderId) {
        // Take the seller straight to the next step: sending the item.
        navigation.navigate("OrderDetail", { id: r.orderId });
      }
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't update the offer."));
    } finally {
      loadThread();
    }
  });

  const sendOffer = async (amount: number) => {
    if (!user) return;
    try {
      await api.makeOffer(conversationId, user.id, amount, newClientId());
      setOfferSheet(false);
      loadThread();
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't send the offer."));
    }
  };

  const offersById = useMemo(() => new Map(offers.map((o) => [o.id, o])), [offers]);

  const rows: Row[] = useMemo(() => {
    const confirmed = new Set(messages.map((m) => m.clientId).filter(Boolean));
    const list: Row[] = [];
    let dividerPlaced = false;
    for (const m of messages) {
      const mine = m.senderId === user?.id;
      if (!dividerPlaced && !mine && readMarker.current !== undefined && (!readMarker.current || m.createdAt > readMarker.current) && messages.some((x) => x.senderId === user?.id)) {
        list.push({ key: "divider", text: "", createdAt: m.createdAt, mine: false, divider: true });
        dividerPlaced = true;
      }
      list.push({
        key: m.id,
        text: m.text,
        createdAt: m.createdAt,
        mine,
        media: m.mediaUrl && m.mediaType ? { uri: mediaUrl(m.mediaUrl)!, type: m.mediaType } : undefined,
        offer: m.offerId ? offersById.get(m.offerId) : undefined,
      });
    }
    for (const p of pending) {
      if (confirmed.has(p.clientId)) continue;
      list.push({
        key: p.clientId,
        text: p.text,
        createdAt: p.createdAt,
        mine: true,
        status: p.status,
        progress: p.progress,
        clientId: p.clientId,
        media: p.media ? { uri: p.media.localUri, type: p.media.type } : undefined,
      });
    }
    return list.reverse(); // inverted list: newest first
  }, [messages, pending, offersById, user?.id]);

  const other = useOtherParty(conversation, user?.id);
  const isBuyer = conversation?.buyerId === user?.id;
  const lastMine = rows.find((r) => r.mine && !r.status);

  if (failed) {
    return <EmptyState icon={MessageCircle} tone="error" title="Chat unavailable" message="This conversation couldn't be loaded. It may have been removed." />;
  }
  if (!conversation || !loaded) return <ThreadSkeleton />;

  const listing = conversation.listing;
  const pendingOffer = offers.find((o) => o.status === "PENDING");
  const canOffer = listing.status === "ACTIVE" && !blocked;
  // Rating only makes sense once the buyer actually has the item.
  const canRate = isBuyer && order?.status === "DELIVERED";
  // Plain-language pointer to the order and whose turn it is.
  const orderNeedsMe = !!order && !isBuyer && (order.status === "AWAITING_DISPATCH" || order.status === "DISPATCHED");
  const orderBarLabel = !order
    ? ""
    : order.status === "AWAITING_DISPATCH"
    ? isBuyer ? "Order confirmed · See your secret code" : "Next step: send the item"
    : order.status === "DISPATCHED"
    ? isBuyer ? "On its way · See your secret code" : "Next step: enter the buyer's code"
    : order.status === "DELIVERED"
    ? "Delivered · View order"
    : "Problem reported · View order";

  const renderOffer = (offer: Offer, mine: boolean) => {
    const actionable = offer.status === "PENDING";
    return (
      <View style={[styles.offerCard, mine ? styles.offerMine : styles.offerTheirs]}>
        <View style={styles.offerHead}>
          <Tag size={14} color={colors.primary} />
          <Text style={styles.offerLabel}>{offer.fromId === conversation.sellerId ? "Counter-offer" : "Offer"}</Text>
        </View>
        <Text style={styles.offerAmount}>MVR {offer.amount.toLocaleString()}</Text>
        <Text style={[styles.offerStatus, offer.status === "ACCEPTED" && { color: colors.success }]}>{OFFER_STATUS_LABEL[offer.status]}</Text>
        {actionable && !mine && (
          <View style={styles.offerActions}>
            <Tap style={[styles.offerButton, styles.offerAccept]} onPress={() => respond(offer, "ACCEPT")}>
              <Text style={styles.offerAcceptText}>Accept</Text>
            </Tap>
            <Tap style={styles.offerButton} onPress={() => setOfferSheet(true)}>
              <Text style={styles.offerButtonText}>Counter</Text>
            </Tap>
            <Tap style={styles.offerButton} onPress={() => respond(offer, "DECLINE")}>
              <Text style={styles.offerButtonText}>Decline</Text>
            </Tap>
          </View>
        )}
        {actionable && mine && (
          <Tap style={[styles.offerButton, { alignSelf: "flex-start", marginTop: spacing.sm }]} onPress={() => respond(offer, "WITHDRAW")}>
            <Text style={styles.offerButtonText}>Withdraw</Text>
          </Tap>
        )}
      </View>
    );
  };

  const quickReplies = isBuyer ? QUICK_REPLIES_BUYER : QUICK_REPLIES_SELLER;

  return (
    <View style={{ flex: 1 }}>
      <Tap style={styles.listingBanner} onPress={() => navigation.navigate("ProductDetail", { id: listing.id })} scaleTo={0.98}>
        <ListingImage uri={mediaUrl(listing.images[0])} style={styles.listingThumb} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.listingTitle} numberOfLines={1}>
            {listing.title}
          </Text>
          <Text style={styles.listingPrice}>
            MVR {listing.price.toLocaleString()}
            {listing.status === "RESERVED" ? "  ·  Reserved" : listing.status === "SOLD" ? "  ·  Sold" : ""}
          </Text>
        </View>
        {showContactButtons && other && isBuyer ? <ContactIconButtons contact={other} listingTitle={listing.title} size={36} /> : <ChevronRight size={18} color={colors.textMuted} />}
      </Tap>

      {order && order.status !== "CANCELLED" && (
        <FadeIn key={order.status} distance={-8}>
        <Tap style={[styles.orderBar, orderNeedsMe && styles.orderBarAction]} onPress={() => navigation.navigate("OrderDetail", { id: order.id })} scaleTo={0.98}>
          <Package size={20} color={orderNeedsMe ? "#fff" : colors.primary} />
          <Text style={[styles.orderBarText, orderNeedsMe && { color: "#fff" }]} numberOfLines={1}>
            {orderBarLabel}
          </Text>
          {orderNeedsMe ? (
            <Nudge>
              <ChevronRight size={18} color="#fff" />
            </Nudge>
          ) : (
            <ChevronRight size={18} color={colors.primary} />
          )}
        </Tap>
        </FadeIn>
      )}

      {(canOffer || canRate) && (
        <View style={styles.actionStrip}>
          {canOffer && (
            <Tap style={styles.stripButton} onPress={() => setOfferSheet(true)} scaleTo={0.94}>
              <Tag size={14} color={colors.primary} />
              <Text style={styles.stripText}>{pendingOffer ? "New offer" : isBuyer ? "Make an offer" : "Send a price"}</Text>
            </Tap>
          )}
          {canRate && (
            <Tap style={styles.stripButton} onPress={() => setReviewSheet(true)} scaleTo={0.94}>
              <Star size={14} color={colors.primary} />
              <Text style={styles.stripText}>Rate seller</Text>
            </Tap>
          )}
        </View>
      )}

      <FlatList
        inverted
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={[styles.listContent, !rows.length && { flexGrow: 1, justifyContent: "flex-end" }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListEmptyComponent={
          // Inverted list: flip the empty state back upright.
          <View style={[styles.emptyWrap, { transform: [{ scaleY: -1 }] }]}>
            <Text style={styles.emptyTitle}>Start the conversation</Text>
            <Text style={styles.emptyText}>{isBuyer ? `Say hi to ${other?.name ?? "the seller"}.` : "Reply to your buyer."}</Text>
            <View style={styles.quickRow}>
              {quickReplies.map((q) => (
                <Tap key={q} style={styles.quickChip} onPress={() => send(q)} scaleTo={0.94}>
                  <Text style={styles.quickText}>{q}</Text>
                </Tap>
              ))}
            </View>
          </View>
        }
        renderItem={({ item, index }) => {
          if (item.divider) {
            return (
              <View style={styles.newDivider}>
                <View style={styles.newLine} />
                <Text style={styles.newText}>New messages</Text>
                <View style={styles.newLine} />
              </View>
            );
          }
          const older = rows.slice(index + 1).find((r) => !r.divider);
          const showDay = !older || dayLabel(older.createdAt) !== dayLabel(item.createdAt);
          const retry = () => {
            const p = pending.find((x) => x.clientId === item.clientId);
            if (p) deliver(p);
          };
          let content: React.ReactNode;
          if (item.offer) {
            content = renderOffer(item.offer, item.mine);
          } else if (item.media) {
            content = (
              <Tap onPress={() => (item.status === "failed" ? retry() : !item.status && setViewer(item.media!))} scaleTo={0.97} style={styles.mediaBubble}>
                <Image source={{ uri: item.media.uri }} style={styles.mediaImage} />
                {item.media.type === "VIDEO" && (
                  <View style={styles.playOverlay} pointerEvents="none">
                    <View style={styles.playButton}>
                      <Play size={20} color="#fff" fill="#fff" />
                    </View>
                  </View>
                )}
                {item.status === "sending" && (
                  <View style={styles.uploadOverlay} pointerEvents="none">
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.uploadText}>{item.progress ? `${Math.round(item.progress * 100)}%` : "Sending"}</Text>
                  </View>
                )}
                {item.status === "failed" && (
                  <View style={[styles.uploadOverlay, { backgroundColor: "rgba(229,72,77,0.7)" }]} pointerEvents="none">
                    <AlertCircle size={20} color="#fff" />
                    <Text style={styles.uploadText}>Tap to retry</Text>
                  </View>
                )}
              </Tap>
            );
          } else {
            const bubble = (
              <View style={[styles.bubble, item.mine ? styles.bubbleMine : styles.bubbleTheirs, item.status === "failed" && styles.bubbleFailed]}>
                <Text style={[styles.bubbleText, item.mine && styles.bubbleTextMine]}>{item.text}</Text>
                <View style={styles.bubbleMeta}>
                  {item.status === "sending" && <Clock size={11} color="rgba(255,255,255,0.8)" />}
                  {item.status === "failed" && <AlertCircle size={12} color="#fff" />}
                  <Text style={[styles.time, item.mine && styles.timeMine]}>{item.status === "failed" ? "Not sent. Tap to retry" : clockTime(item.createdAt)}</Text>
                </View>
              </View>
            );
            content = item.status === "failed" ? <Tap onPress={retry}>{bubble}</Tap> : bubble;
          }
          const seen = item.mine && item.key === lastMine?.key && otherLastReadAt && otherLastReadAt >= item.createdAt;
          return (
            <View>
              {showDay && <Text style={styles.dayLabel}>{dayLabel(item.createdAt)}</Text>}
              <View style={[styles.bubbleRow, item.mine && styles.bubbleRowMine]}>
                <View style={{ maxWidth: "80%", alignItems: item.mine ? "flex-end" : "flex-start" }}>{content}</View>
              </View>
              {seen && (
                <View style={styles.seenRow}>
                  <CheckCheck size={13} color={colors.primary} />
                  <Text style={styles.seenText}>Seen</Text>
                </View>
              )}
            </View>
          );
        }}
      />

      {blocked ? (
        <View style={styles.blockedBar}>
          <Ban size={16} color={colors.textMuted} />
          <Text style={styles.blockedText}>You can't reply in this chat.</Text>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <Tap style={styles.attachButton} onPress={attach} scaleTo={0.85} accessibilityLabel="Send a photo or video">
            <ImagePlus size={20} color={colors.primary} />
          </Tap>
          <TextInput
            style={styles.input}
            placeholder="Write a message"
            placeholderTextColor={colors.textMuted}
            value={draft.text}
            onChangeText={(text) => setDraft({ text })}
            multiline
            maxLength={2000}
            accessibilityLabel="Message"
            // Web: Enter sends, Shift+Enter adds a new line.
            onKeyPress={(e: any) => {
              if (Platform.OS === "web" && e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Tap style={[styles.sendButton, !draft.text.trim() && styles.sendButtonDisabled]} onPress={() => send()} disabled={!draft.text.trim()} scaleTo={0.85} accessibilityLabel="Send message">
            <Send size={18} color="#fff" />
          </Tap>
        </View>
      )}

      <OfferSheet visible={offerSheet} onClose={() => setOfferSheet(false)} listingPrice={listing.price} title={isBuyer ? "Make an offer" : "Send a price"} onSubmit={sendOffer} />
      {other && <ReviewSheet visible={reviewSheet} onClose={() => setReviewSheet(false)} listingId={listing.id} sellerName={other.name} />}
      <MediaViewer uri={viewer?.uri ?? null} type={viewer?.type ?? "IMAGE"} onClose={() => setViewer(null)} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  listingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listingThumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.skeleton },
  listingTitle: { fontSize: fontSize.base, color: colors.text, fontWeight: fontWeight.semibold },
  listingPrice: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary, marginTop: 1 },
  orderBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, marginHorizontal: spacing.md, marginTop: spacing.sm, paddingHorizontal: spacing.md, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.primaryTint },
  orderBarAction: { backgroundColor: colors.primary },
  orderBarText: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.primary },
  actionStrip: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background },
  stripButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.sm + 4, height: 34, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  stripText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  listContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: 6 },
  dayLabel: { alignSelf: "center", fontSize: fontSize.caption, color: colors.textMuted, fontWeight: fontWeight.semibold, marginVertical: spacing.sm },
  newDivider: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.sm },
  newLine: { flex: 1, height: 1, backgroundColor: colors.danger, opacity: 0.4 },
  newText: { fontSize: fontSize.caption, color: colors.danger, fontWeight: fontWeight.bold },
  bubbleRow: { flexDirection: "row", justifyContent: "flex-start" },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 6, borderRadius: 20 },
  bubbleTheirs: { backgroundColor: colors.card, borderBottomLeftRadius: 6 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bubbleFailed: { backgroundColor: colors.danger },
  bubbleText: { fontSize: fontSize.md, color: colors.text, lineHeight: fontSize.md * 1.35 },
  bubbleTextMine: { color: "#fff" },
  bubbleMeta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 2 },
  time: { fontSize: fontSize.micro, color: colors.textMuted },
  timeMine: { color: "rgba(255,255,255,0.85)" },
  seenRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3, marginTop: 2 },
  seenText: { fontSize: fontSize.caption, color: colors.textMuted },
  mediaBubble: { borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.skeleton },
  mediaImage: { width: 220, height: 220 },
  playOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.25)" },
  playButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  uploadOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.45)" },
  uploadText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  offerCard: { borderRadius: radius.md, padding: spacing.md, minWidth: 220, borderWidth: 1 },
  offerMine: { backgroundColor: colors.primaryTint, borderColor: colors.primaryLight },
  offerTheirs: { backgroundColor: colors.card, borderColor: colors.border },
  offerHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  offerLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.primary },
  offerAmount: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: 2 },
  offerStatus: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  offerActions: { flexDirection: "row", gap: spacing.xs + 2, marginTop: spacing.sm + 2 },
  offerButton: { paddingHorizontal: spacing.sm + 4, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, justifyContent: "center", backgroundColor: colors.card },
  offerButtonText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  offerAccept: { backgroundColor: colors.success, borderColor: colors.success },
  offerAcceptText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: "#fff" },
  emptyWrap: { alignItems: "center", paddingVertical: spacing.xl },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  emptyText: { fontSize: fontSize.base, color: colors.textMuted, marginTop: 4 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md },
  quickChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  quickText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  blockedBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  blockedText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  attachButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryTint },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.background,
    outlineStyle: "none" as any,
  },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { opacity: 0.4 },
}));
