import React, { useEffect, useState } from "react";
import { Image, Linking, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { api, mediaUrl, RunningAd } from "../api/client";
import Tap from "./Tap";
import PhotoBadge from "./PhotoBadge";
import { FadeIn } from "./Motion";
import { makeStyles } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";

// A paid ad, always labelled as one. Shows nothing when no ad is running.
export default function AdBanner({ horizontalPadding = 0 }: { horizontalPadding?: number }) {
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const [ad, setAd] = useState<RunningAd | null>(null);

  useEffect(() => {
    api.ads().then((ads) => setAd(ads[0] ?? null)).catch(() => {});
  }, []);

  if (!ad) return null;
  const open = () => {
    api.adClicked(ad.id).catch(() => {});
    if (ad.listingId) navigation.navigate("ProductDetail", { id: ad.listingId });
    else if (ad.adUrl) Linking.openURL(ad.adUrl).catch(() => {});
  };
  return (
    <FadeIn style={{ paddingHorizontal: horizontalPadding, marginBottom: spacing.lg }}>
      <Tap style={styles.card} onPress={open} scaleTo={0.98} accessibilityLabel={`Ad: ${ad.adTitle}`}>
        <Image source={{ uri: mediaUrl(ad.adImage) }} style={styles.image} resizeMode="cover" />
        <PhotoBadge label="Ad" />
        <Text style={styles.title} numberOfLines={2}>
          {ad.adTitle}
        </Text>
      </Tap>
    </FadeIn>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: "hidden", ...cardShadow },
  image: { width: "100%", aspectRatio: 2.4 },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, padding: spacing.sm + 4 },
}));
