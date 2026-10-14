import React, { useState } from "react";
import { Image, Text, View } from "react-native";
import { LucideIcon } from "lucide-react-native";
import { mediaUrl } from "../api/client";
import { makeStyles } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";
import Tap from "./Tap";

// Home category tile: a real photo from the category (instantly recognisable,
// even for people who don't read icons) with the name on a dark fade. With
// no photo it falls back to a solid tile in the category's colour.
const FADE = [0, 0.12, 0.28, 0.45, 0.62];

export default function CategoryTile({
  name,
  image,
  Icon,
  color,
  size,
  onPress,
}: {
  name: string;
  image?: string;
  Icon: LucideIcon;
  color: string;
  size: number;
  onPress: () => void;
}) {
  const styles = useStyles();
  const [failed, setFailed] = useState(false);
  const hasPhoto = !!image && !failed;
  return (
    <Tap style={[styles.tile, { width: size, height: size, backgroundColor: color }]} onPress={onPress} scaleTo={0.93} accessibilityLabel={name}>
      {hasPhoto ? (
        <Image source={{ uri: mediaUrl(image) }} style={styles.photo} onError={() => setFailed(true)} />
      ) : (
        <View style={styles.iconWrap}>
          <Icon size={Math.round(size * 0.3)} color="#fff" strokeWidth={2} />
        </View>
      )}
      {/* Bottom fade so white text is readable on any photo. */}
      <View style={styles.fade} pointerEvents="none">
        {FADE.map((o, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: `rgba(0,0,0,${hasPhoto ? o : o * 0.5})` }} />
        ))}
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {name}
      </Text>
    </Tap>
  );
}

const useStyles = makeStyles(() => ({
  tile: { borderRadius: radius.md, overflow: "hidden", justifyContent: "flex-end" },
  photo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  iconWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: "28%", alignItems: "center", justifyContent: "center" },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" },
  label: { color: "#fff", fontSize: fontSize.caption, fontWeight: fontWeight.bold, paddingHorizontal: spacing.xs + 2, paddingBottom: spacing.xs + 2, lineHeight: fontSize.caption * 1.2 },
}));
