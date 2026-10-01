import React, { useEffect, useRef, useState } from "react";
import { View, Text, Image, ScrollView, ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions, Animated, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { MapPin, MessageCircle, Heart, CheckCircle2, RotateCcw, PackageSearch, ChevronRight, ChevronLeft, Clock, Tag, Share2, MoreHorizontal, Pencil, Truck, Ship, Hand, Flag, Ban } from "lucide-react-native";
import { api, errorMessage, Listing, newClientId, DeliveryOption } from "../api/client";
import { VerifiedBadge, RatingSummary } from "../components/Badges";
import { OfferSheet, useTrustActions } from "../components/TrustSheets";
import { useActionSheet } from "../components/Sheet";
import { shareListing } from "../utils/share";
import { addRecentlyViewed } from "../utils/recentlyViewed";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, conditionColors, cardShadow, fontSize, fontWeight } from "../theme/theme";
import { useAuth } from "../api/AuthContext";
import { useFavorites } from "../api/FavoritesContext";
import { useToast } from "../components/Toast";
import EmptyState from "../components/EmptyState";
import HomeRail from "../components/HomeRail";
import WebNavBar from "../components/WebNavBar";
import ScreenHeader, { useGoBack } from "../components/ScreenHeader";
import { ContactCard, ContactIconButtons } from "../components/ContactButtons";
import { ListingImage } from "../components/ListingCard";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import Tap from "../components/Tap";
import { useResponsive, MAX_CONTENT_WIDTH } from "../hooks/useResponsive";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { timeAgo } from "../utils/time";

const DELIVERY_META: Record<DeliveryOption, { label: string; icon: any }> = {
  PICKUP: { label: "Pickup", icon: Hand },
  FERRY: { label: "Ferry cargo", icon: Ship },
  COURIER: { label: "Courier", icon: Truck },
};

const conditionLabel = (c: string) => c.replace("_", " ").toLowerCase().replace(/^\w/, (m) => m.toUpperCase());

function Gallery({ images, width, height }: { images: string[]; width: number; height: number }) {
  const styles = useStyles();
  const [index, setIndex] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };
  return (
    <View style={{ width, height }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32}>
        {(images.length ? images : [""]).map((uri, i) => (
          <ListingImage key={i} uri={uri} style={{ width, height }} />
        ))}
      </ScrollView>
      {images.length > 1 && (
        <View style={styles.dotsRow} pointerEvents="none">
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

function DesktopGallery({ images }: { images: string[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const list = images.length ? images : [""];
  const step = (d: number) => setIndex((i) => (i + d + list.length) % list.length);
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={styles.desktopImageWrap}>
        <ListingImage uri={list[index]} style={styles.desktopImage} />
        {list.length > 1 && (
          <>
            <Tap style={[styles.galleryArrow, { left: spacing.md }]} onPress={() => step(-1)} accessibilityLabel="Previous photo" scaleTo={0.88}>
              <ChevronLeft size={20} color={colors.text} />
            </Tap>
            <Tap style={[styles.galleryArrow, { right: spacing.md }]} onPress={() => step(1)} accessibilityLabel="Next photo" scaleTo={0.88}>
              <ChevronRight size={20} color={colors.text} />
            </Tap>
          </>
        )}
      </View>
      {list.length > 1 && (
        <View style={styles.thumbRow}>
          {list.map((uri, i) => (
            <Tap key={i} onPress={() => setIndex(i)} scaleTo={0.92}>
              <Image source={{ uri }} style={[styles.thumb, i === index && styles.thumbActive]} />
            </Tap>
          ))}
        </View>
      )}
    </View>
  );
}

function DetailSkeleton({ imageSize }: { imageSize: number }) {
  return (
    <SkeletonGroup>
      <Skeleton width="100%" height={imageSize} rounded={0} />
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <Skeleton width={140} height={28} />
        <Skeleton width="80%" height={18} />
        <Skeleton width="50%" height={14} />
        <Skeleton width="100%" height={72} rounded={radius.lg} style={{ marginTop: spacing.md }} />
        <Skeleton width="100%" height={110} rounded={radius.lg} />
      </View>
    </SkeletonGroup>
  );
}

export default function ProductDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const toast = useToast();
  const goBack = useGoBack();
  const { isDesktopWeb, gutter } = useResponsive();
  const { id } = route.params;
  const [listing, setListing] = useState<Listing | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [similar, setSimilar] = useState<Listing[]>([]);
  const heartPop = useRef(new Animated.Value(1)).current;
  const [offerOpen, setOfferOpen] = useState(false);
  const showSheet = useActionSheet();
  const trust = useTrustActions();

  useEffect(() => {
    setNotFound(false);
    setListing(null);
    setSimilar([]);
    api
      .listing(id)
      .then((l) => {
        setListing(l);
        if (user) addRecentlyViewed(user.id, l);
      })
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!listing) return;
    api
      .listings({ categorySlug: listing.category.slug, viewerId: user?.id })
      .then((list) => setSimilar(list.filter((l) => l.id !== listing.id).slice(0, 12)))
      .catch(() => {});
  }, [listing?.id]);

  const [messageSeller, startingChat] = useSingleFlight(async () => {
    if (!user || !listing) return;
    try {
      const conversation = await api.startConversation(listing.id, user.id);
      if (isDesktopWeb) navigation.navigate("Tabs", { screen: "ChatsTab", params: { id: conversation.id } });
      else navigation.navigate("ChatThread", { id: conversation.id });
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't open the chat. Please try again."));
    }
  });

  const openChat = (conversationId: string) =>
    isDesktopWeb ? navigation.navigate("Tabs", { screen: "ChatsTab", params: { id: conversationId } }) : navigation.navigate("ChatThread", { id: conversationId });

  // An offer lives in the chat: start (or reuse) the conversation, post the
  // offer into it, then open the chat so the buyer sees it land.
  const sendOffer = async (amount: number) => {
    if (!user || !listing) return;
    try {
      const conversation = await api.startConversation(listing.id, user.id);
      await api.makeOffer(conversation.id, user.id, amount, newClientId());
      setOfferOpen(false);
      toast.success(`Offer of MVR ${amount.toLocaleString()} sent.`);
      openChat(conversation.id);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't send your offer."));
    }
  };

  const onShare = async () => {
    if (!listing) return;
    try {
      const result = await shareListing(listing);
      if (result === "copied") toast.success("Link copied. Paste it anywhere to share.");
    } catch {
      toast.error("Couldn't share this listing.");
    }
  };

  const openMenu = () => {
    if (!listing) return;
    showSheet({
      actions: [
        { label: "Share listing", icon: Share2, onPress: onShare },
        ...(listing.seller.id !== user?.id
          ? [
              { label: "Report listing", icon: Flag, onPress: () => trust.report({ listingId: listing.id }) },
              { label: `Block ${listing.seller.name}`, icon: Ban, destructive: true, onPress: () => trust.block(listing.seller, () => navigation.goBack()) },
            ]
          : []),
      ],
    });
  };

  // Optimistic: the badge flips instantly; on failure it flips back with a toast.
  const [toggleStatus] = useSingleFlight(async () => {
    if (!listing) return;
    const previous = listing;
    const nextStatus = listing.status === "ACTIVE" ? "SOLD" : "ACTIVE";
    setListing({ ...listing, status: nextStatus });
    try {
      await api.updateListingStatus(listing.id, user!.id, nextStatus);
      toast.success(nextStatus === "SOLD" ? "Marked as sold." : "Listing is active again.");
    } catch (e) {
      setListing(previous);
      toast.error(errorMessage(e, "Couldn't update the listing."));
    }
  });

  if (notFound) {
    return (
      <View style={[styles.container, { paddingTop: isDesktopWeb ? 0 : insets.top }]}>
        {isDesktopWeb ? <WebNavBar /> : <ScreenHeader />}
        <EmptyState
          icon={PackageSearch}
          title="Listing not found"
          message="It may have been sold or removed by the seller."
          actionLabel="Browse similar items"
          onAction={() => navigation.navigate("Tabs", { screen: "SearchTab" })}
          secondaryLabel="Go back"
          onSecondary={goBack}
        />
      </View>
    );
  }

  const isOwner = !!listing && user?.id === listing.seller.id;
  const favorited = !!listing && isFavorite(listing.id);
  const onFavorite = () => {
    if (!listing) return;
    heartPop.setValue(0.6);
    Animated.spring(heartPop, { toValue: 1, friction: 3, tension: 220, useNativeDriver: Platform.OS !== "web" }).start();
    toggleFavorite(listing.id);
  };

  const headerActions = listing && (
    <>
      <Tap style={styles.circleButton} onPress={onShare} scaleTo={0.85} accessibilityLabel="Share listing">
        <Share2 size={18} color={colors.text} />
      </Tap>
      <Tap style={styles.circleButton} onPress={openMenu} scaleTo={0.85} accessibilityLabel="More options">
        <MoreHorizontal size={20} color={colors.text} />
      </Tap>
    </>
  );

  const favoriteButton = listing && !isOwner && user && (
    <Tap style={styles.circleButton} onPress={onFavorite} scaleTo={0.85} accessibilityLabel={favorited ? "Remove from saved" : "Save listing"}>
      <Animated.View style={{ transform: [{ scale: heartPop }] }}>
        <Heart size={20} color={favorited ? colors.accent : colors.text} fill={favorited ? colors.accent : "transparent"} />
      </Animated.View>
    </Tap>
  );

  if (!listing) {
    return (
      <View style={styles.container}>
        {isDesktopWeb ? <WebNavBar /> : <ScreenHeader floating />}
        <DetailSkeleton imageSize={isDesktopWeb ? 420 : windowWidth} />
      </View>
    );
  }

  const location = `${listing.island?.name ?? ""}${listing.island?.atoll ? `, ${listing.island.atoll.name}` : ""}`;
  const sellerDisplay = listing.seller.username ? `@${listing.seller.username}` : "Alibe seller";
  const isSold = listing.status === "SOLD";
  const isReserved = listing.status === "RESERVED";
  const available = listing.status === "ACTIVE";

  const info = (
    <>
      <View style={styles.priceRow}>
        <Text style={styles.price}>MVR {listing.price.toLocaleString()}</Text>
        {!available && (
          <View style={[styles.soldBadge, isReserved && { backgroundColor: colors.gold }]}>
            <Text style={styles.soldBadgeText}>{isReserved ? "Reserved" : "Sold"}</Text>
          </View>
        )}
      </View>
      <Text style={styles.title}>{listing.title}</Text>
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MapPin size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>{location}</Text>
        </View>
        <View style={styles.metaItem}>
          <Clock size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>{timeAgo(listing.createdAt, true)}</Text>
        </View>
      </View>
      <View style={styles.tagRow}>
        <View style={[styles.tag, { backgroundColor: `${conditionColors[listing.condition]}18` }]}>
          <Text style={[styles.tagText, { color: conditionColors[listing.condition] }]}>{conditionLabel(listing.condition)}</Text>
        </View>
        <Tap style={styles.tag} onPress={() => navigation.navigate("Tabs", { screen: "SearchTab", params: { categorySlug: listing.category.slug } })} scaleTo={0.94}>
          <Tag size={12} color={colors.textMuted} />
          <Text style={styles.tagText}>{listing.category.name}</Text>
        </Tap>
      </View>

      {listing.deliveryOptions?.length > 0 && (
        <View style={styles.deliveryCard}>
          <Text style={styles.deliveryTitle}>Getting it</Text>
          <View style={styles.deliveryRow}>
            {listing.deliveryOptions.map((d) => {
              const meta = DELIVERY_META[d];
              return (
                <View key={d} style={styles.deliveryChip}>
                  <meta.icon size={14} color={colors.primary} />
                  <Text style={styles.deliveryText}>{meta.label}</Text>
                </View>
              );
            })}
          </View>
          {!!listing.deliveryNote && <Text style={styles.deliveryNote}>{listing.deliveryNote}</Text>}
        </View>
      )}

      <Tap style={styles.sellerCard} onPress={() => navigation.navigate("SellerProfile", { id: listing.seller.id })} scaleTo={0.98}>
        <View style={[styles.avatar, { backgroundColor: listing.seller.avatarColor ?? colors.primary }]}>
          <Text style={styles.avatarText}>{listing.seller.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={styles.sellerName}>{isOwner ? "You" : listing.seller.name}</Text>
            {listing.seller.verified && <VerifiedBadge size={15} />}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 }}>
            <RatingSummary rating={listing.seller.rating} size={12} />
          </View>
          <Text style={styles.sellerMeta}>{sellerDisplay}</Text>
        </View>
        <Text style={styles.sellerLink}>Profile</Text>
        <ChevronRight size={16} color={colors.primary} />
      </Tap>

      {!isOwner && available && (
        <View style={{ marginTop: spacing.md }}>
          <ContactCard contact={listing.seller} listingTitle={listing.title} />
        </View>
      )}

      <Text style={styles.sectionTitle}>About this item</Text>
      <Text style={styles.description}>{listing.description}</Text>
    </>
  );

  const primaryAction = isOwner ? (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      <Tap style={[styles.secondaryButton, styles.primaryButton, { paddingHorizontal: spacing.md }]} onPress={() => navigation.navigate("EditListing", { id: listing.id })} accessibilityLabel="Edit listing">
        <Pencil size={17} color={colors.primary} />
        <Text style={[styles.primaryButtonText, { color: colors.primary }]}>Edit</Text>
      </Tap>
      <Tap style={[styles.primaryButton, { flex: 1 }, !available && styles.secondaryButton]} onPress={() => toggleStatus()}>
        {!available ? <RotateCcw size={18} color={colors.primary} /> : <CheckCircle2 size={18} color="#fff" />}
        <Text style={[styles.primaryButtonText, !available && { color: colors.primary }]}>{!available ? "Mark as available" : "Mark as sold"}</Text>
      </Tap>
    </View>
  ) : (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      {available && (
        <Tap style={[styles.primaryButton, styles.secondaryButton, { paddingHorizontal: spacing.md }]} onPress={() => setOfferOpen(true)}>
          <Tag size={17} color={colors.primary} />
          <Text style={[styles.primaryButtonText, { color: colors.primary }]}>Offer</Text>
        </Tap>
      )}
      <Tap style={[styles.primaryButton, { flex: 1 }, isSold && styles.buttonDisabled]} onPress={() => messageSeller()} disabled={startingChat || isSold}>
        {startingChat ? <ActivityIndicator color="#fff" /> : <MessageCircle size={18} color="#fff" />}
        <Text style={styles.primaryButtonText}>{isSold ? "This item is sold" : "Chat"}</Text>
      </Tap>
    </View>
  );

  const similarRail = similar.length > 0 && (
    <HomeRail
      title="Similar items"
      data={similar}
      onPressItem={(l) => navigation.push("ProductDetail", { id: l.id })}
      onSeeAll={() => navigation.navigate("Tabs", { screen: "SearchTab", params: { categorySlug: listing.category.slug } })}
      horizontalPadding={isDesktopWeb ? 0 : gutter}
      cardWidth={isDesktopWeb ? 190 : 164}
    />
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar />
        <ScrollView>
          <View style={[styles.desktopColumn, { paddingHorizontal: gutter }]}>
            <Tap style={styles.backLink} onPress={goBack} scaleTo={0.96}>
              <ChevronLeft size={18} color={colors.textMuted} />
              <Text style={styles.backLinkText}>Back</Text>
            </Tap>
            <View style={styles.desktopLayout}>
              <DesktopGallery images={listing.images} />
              <View style={styles.desktopInfo}>
                <View style={styles.desktopInfoCard}>
                  {info}
                  <View style={styles.desktopActions}>
                    <View style={{ flex: 1 }}>{primaryAction}</View>
                    {favoriteButton}
                    {headerActions}
                  </View>
                </View>
              </View>
            </View>
            {similarRail && <View style={{ marginTop: spacing.xl }}>{similarRail}</View>}
          </View>
        </ScrollView>
        <OfferSheet visible={offerOpen} onClose={() => setOfferOpen(false)} listingPrice={listing.price} title="Make an offer" onSubmit={sendOffer} />
      </View>
    );
  }

  const imageSize = Math.min(windowWidth, 640);
  return (
    <View style={styles.container}>
      <ScreenHeader
        floating
        right={
          <>
            {headerActions}
            {favoriteButton}
          </>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: "center", backgroundColor: colors.skeleton }}>
          <Gallery images={listing.images} width={imageSize} height={imageSize} />
        </View>
        <View style={[styles.body, { paddingHorizontal: gutter }]}>{info}</View>
        {similarRail && <View style={{ marginTop: spacing.lg }}>{similarRail}</View>}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.xs, paddingHorizontal: gutter }]}>
        {!isOwner && available && <ContactIconButtons contact={{ ...listing.seller, phone: null }} listingTitle={listing.title} size={50} />}
        <View style={{ flex: 1 }}>{primaryAction}</View>
      </View>
      <OfferSheet visible={offerOpen} onClose={() => setOfferOpen(false)} listingPrice={listing.price} title="Make an offer" onSubmit={sendOffer} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  desktopColumn: { maxWidth: MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center", paddingTop: spacing.md, paddingBottom: spacing.xl * 2 },
  backLink: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 2, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  backLinkText: { color: colors.textMuted, fontWeight: fontWeight.semibold, fontSize: fontSize.base },
  desktopLayout: { flexDirection: "row", gap: spacing.xl, alignItems: "flex-start" },
  desktopImageWrap: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.skeleton },
  desktopImage: { width: "100%", aspectRatio: 1.15 },
  galleryArrow: { position: "absolute", top: "50%", marginTop: -20, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.floating, alignItems: "center", justifyContent: "center" },
  thumbRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  thumb: { width: 76, height: 76, borderRadius: radius.sm, backgroundColor: colors.skeleton, opacity: 0.55 },
  thumbActive: { opacity: 1, borderWidth: 2, borderColor: colors.primary },
  desktopInfo: { width: 420 },
  desktopInfoCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...cardShadow },
  desktopActions: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginTop: spacing.lg },
  dotsRow: { position: "absolute", bottom: spacing.md, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.6)" },
  dotActive: { backgroundColor: "#fff", width: 18 },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.floating,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { paddingTop: spacing.lg },
  priceRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  price: { fontSize: fontSize.display, fontWeight: fontWeight.extrabold, color: colors.text, letterSpacing: -0.5 },
  soldBadge: { paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.danger },
  soldBadgeText: { color: "#fff", fontSize: fontSize.caption, fontWeight: fontWeight.bold },
  title: { fontSize: fontSize.xl, color: colors.text, marginTop: spacing.xs, fontWeight: fontWeight.semibold, lineHeight: fontSize.xl * 1.3 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: fontSize.sm, color: colors.textMuted },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm + 4, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tagText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold, color: colors.text },
  sellerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    ...cardShadow,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm + 2,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: fontWeight.extrabold, fontSize: fontSize.md },
  sellerName: { fontWeight: fontWeight.bold, color: colors.text, fontSize: fontSize.base },
  sellerMeta: { color: colors.textMuted, fontSize: fontSize.caption, marginTop: 1 },
  sellerLink: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  sectionTitle: { fontWeight: fontWeight.bold, fontSize: fontSize.lg, marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.text },
  deliveryCard: { marginTop: spacing.lg, gap: spacing.sm },
  deliveryTitle: { fontWeight: fontWeight.bold, fontSize: fontSize.lg, color: colors.text },
  deliveryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  deliveryChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.sm + 4, height: 34, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  deliveryText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  deliveryNote: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: fontSize.sm * 1.45 },
  description: { color: colors.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.55 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm + 2,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryButton: {
    flexDirection: "row",
    gap: spacing.xs + 2,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
  secondaryButton: { backgroundColor: colors.primaryTint },
  buttonDisabled: { backgroundColor: colors.textMuted },
}));
