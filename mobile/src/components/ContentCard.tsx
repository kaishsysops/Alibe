import React from "react";
import { View, Text } from "react-native";
import { ArrowRight } from "lucide-react-native";
import { makeStyles } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { ListingImage } from "./ListingCard";
import Tap from "./Tap";

export default function ContentCard({
  title,
  subtitle,
  ctaLabel,
  image,
  onPress,
  horizontalPadding = spacing.md,
}: {
  title: string;
  subtitle: string;
  ctaLabel?: string;
  image?: string;
  onPress?: () => void;
  horizontalPadding?: number;
}) {
  const styles = useStyles();
  return (
    <Tap style={[styles.card, { marginHorizontal: horizontalPadding }]} onPress={onPress} disabled={!onPress} scaleTo={0.98}>
      <ListingImage uri={image} style={styles.image} />
      <View style={styles.scrim} pointerEvents="none" />
      <View style={styles.content} pointerEvents="none">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {ctaLabel && (
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
            <ArrowRight size={14} color="#1A1A1A" />
          </View>
        )}
      </View>
    </Tap>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    height: 172,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.lg,
    backgroundColor: colors.skeleton,
  },
  image: { width: "100%", height: "100%" },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: "rgba(10,10,10,0.42)",
  },
  content: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  title: { color: "#fff", fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },
  subtitle: { color: "rgba(255,255,255,0.88)", fontSize: fontSize.sm, marginTop: 2 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: spacing.sm + 2,
    backgroundColor: "#fff",
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  ctaText: { color: "#1A1A1A", fontSize: fontSize.sm, fontWeight: fontWeight.bold },
}));
