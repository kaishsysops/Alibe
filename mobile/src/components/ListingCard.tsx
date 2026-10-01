import React, { useEffect, useRef, useState } from "react";
import { View, Text, Image, Animated, Platform } from "react-native";
import { Heart, CheckCircle2, RotateCcw, ImageOff, MapPin, Pencil } from "lucide-react-native";
import { Listing, mediaUrl } from "../api/client";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { useFavorites } from "../api/FavoritesContext";
import { useAuth } from "../api/AuthContext";
import Tap from "./Tap";

// Photo with a graceful fallback: listings created on another device can
// carry image URIs this device can't load (e.g. a simulator file:// path).
export function ListingImage({ uri, style }: { uri?: string; style: any }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  if (!uri || failed) {
    return (
      <View style={[style, styles.imageFallback]}>
        <ImageOff size={22} color={colors.textMuted} strokeWidth={1.75} />
      </View>
    );
  }
  return <Image source={{ uri: mediaUrl(uri) }} style={style} onError={() => setFailed(true)} />;
}

function FavoriteHeart({ listingId }: { listingId: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(listingId);
  const pop = useRef(new Animated.Value(1)).current;

  const onPress = () => {
    // The heart "pops" to confirm the (optimistic) save before the network replies.
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, friction: 3, tension: 220, useNativeDriver: Platform.OS !== "web" }).start();
    toggleFavorite(listingId);
  };

  return (
    <Tap nested style={styles.favoriteButton} onPress={onPress} hitSlop={8} scaleTo={0.85} accessibilityLabel={favorited ? "Remove from saved" : "Save listing"}>
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Heart size={16} color={favorited ? colors.accent : colors.text} fill={favorited ? colors.accent : "transparent"} strokeWidth={2.2} />
      </Animated.View>
    </Tap>
  );
}

export default function ListingCard({
  listing,
  onPress,
  width,
  sellerView,
  onToggleSold,
  onEdit,
}: {
  listing: Listing;
  onPress: () => void;
  width?: number;
  // Seller-facing card (used in My Listings): swaps the favorite heart for a
  // one-tap sold/active toggle so sellers don't have to open the listing.
  sellerView?: boolean;
  onToggleSold?: () => void;
  onEdit?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const isOwn = user?.id === listing.seller.id;

  return (
    <Tap style={[styles.card, width ? { width } : styles.cardDefaultWidth]} onPress={onPress} scaleTo={0.97}>
      <View style={styles.imageWrap}>
        <ListingImage uri={listing.images[0]} style={styles.image} />
        {(listing.status === "SOLD" || listing.status === "RESERVED") && (
          <View style={styles.soldOverlay} pointerEvents="none">
            <Text style={styles.soldOverlayText}>{listing.status === "SOLD" ? "SOLD" : "RESERVED"}</Text>
          </View>
        )}
        {sellerView ? (
          <>
            <Tap nested style={styles.statusButton} onPress={onToggleSold} hitSlop={8} scaleTo={0.85} accessibilityLabel={listing.status === "ACTIVE" ? "Mark as sold" : "Mark as available"}>
              {listing.status === "ACTIVE" ? <CheckCircle2 size={15} color="#fff" /> : <RotateCcw size={15} color="#fff" />}
            </Tap>
            {onEdit && (
              <Tap nested style={[styles.favoriteButton, { right: undefined, left: spacing.sm }]} onPress={onEdit} hitSlop={8} scaleTo={0.85} accessibilityLabel="Edit listing">
                <Pencil size={14} color={colors.text} />
              </Tap>
            )}
          </>
        ) : (
          user && !isOwn && <FavoriteHeart listingId={listing.id} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.price}>MVR {listing.price.toLocaleString()}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {listing.title}
        </Text>
        {!!listing.island?.name && (
          <View style={styles.locationRow}>
            <MapPin size={11} color={colors.textMuted} />
            <Text style={styles.location} numberOfLines={1}>
              {listing.island.name}
            </Text>
          </View>
        )}
      </View>
    </Tap>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { marginBottom: spacing.md },
  cardDefaultWidth: { width: "48%" },
  imageWrap: { position: "relative", borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.skeleton },
  image: { width: "100%", aspectRatio: 1, backgroundColor: colors.skeleton },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  soldOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(20,20,20,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  soldOverlayText: { color: "#fff", fontSize: fontSize.sm, fontWeight: fontWeight.extrabold, letterSpacing: 1 },
  statusButton: {
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteButton: {
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.floating,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingTop: spacing.sm, gap: 2 },
  price: { fontWeight: fontWeight.extrabold, color: colors.text, fontSize: fontSize.md },
  title: { color: colors.text, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.35 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  location: { fontSize: fontSize.caption, color: colors.textMuted, flexShrink: 1 },
}));
