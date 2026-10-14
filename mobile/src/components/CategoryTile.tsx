import React, { useId, useState } from "react";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Image, Text, View } from "react-native";
import { LucideIcon } from "lucide-react-native";
import { mediaUrl } from "../api/client";
import { makeStyles } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import Tap from "./Tap";

// Home category tile: a real photo from the category (instantly recognisable,
// even for people who don't read icons) with the name on a dark fade. With
// no photo it falls back to a solid tile in the category's colour.
// A true gradient (stacked views band visibly on big tiles).
function Fade({ strength }: { strength: number }) {
  const id = useId();
  return (
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#000" stopOpacity={strength * 0.35} />
          <Stop offset="1" stopColor="#000" stopOpacity={strength} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

export default function CategoryTile({
  name,
  image,
  Icon,
  color,
  size,
  height,
  subtitle,
  onPress,
}: {
  name: string;
  image?: string;
  Icon: LucideIcon;
  color: string;
  // Width; tiles are square unless `height` is given (wide cards on Search).
  size: number;
  height?: number;
  subtitle?: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const [failed, setFailed] = useState(false);
  const hasPhoto = !!image && !failed;
  return (
    <Tap style={[styles.tile, { width: size, height: height ?? size, backgroundColor: color }]} onPress={onPress} scaleTo={0.93} accessibilityLabel={name}>
      {hasPhoto ? (
        <Image source={{ uri: mediaUrl(image) }} style={styles.photo} onError={() => setFailed(true)} />
      ) : (
        <View style={styles.iconWrap}>
          <Icon size={Math.round(Math.min(size, height ?? size) * 0.3)} color="#fff" strokeWidth={2} />
        </View>
      )}
      {/* Bottom fade so white text is readable on any photo. */}
      <View style={styles.fade} pointerEvents="none">
        <Fade strength={hasPhoto ? 0.7 : 0.3} />
      </View>
      <Text style={[styles.label, !!subtitle && styles.labelLarge]} numberOfLines={2}>
        {name}
      </Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </Tap>
  );
}

const useStyles = makeStyles(() => ({
  tile: { borderRadius: radius.md, overflow: "hidden", justifyContent: "flex-end" },
  photo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  iconWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: "28%", alignItems: "center", justifyContent: "center" },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" },
  labelLarge: { fontSize: fontSize.md, lineHeight: fontSize.md * 1.25, paddingHorizontal: spacing.sm + 2, paddingBottom: 0 },
  subtitle: { color: "rgba(255,255,255,0.85)", fontSize: fontSize.caption, fontWeight: fontWeight.semibold, paddingHorizontal: spacing.sm + 2, paddingBottom: spacing.sm, marginTop: 1 },
  label: { color: "#fff", fontSize: fontSize.caption, fontWeight: fontWeight.bold, paddingHorizontal: spacing.xs + 2, paddingBottom: spacing.xs + 2, lineHeight: fontSize.caption * 1.2 },
}));
