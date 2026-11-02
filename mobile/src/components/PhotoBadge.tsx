import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { spacing, radius, fontSize, fontWeight } from "../theme/theme";

// The small label over a photo: "From iBay", "Featured", "Ad", "2 of 5".
export default function PhotoBadge({ label, color = "rgba(0,0,0,0.68)", corner = "topLeft" }: { label: string; color?: string; corner?: "topLeft" | "bottomRight" }) {
  return (
    <View style={[styles.badge, corner === "topLeft" ? styles.topLeft : styles.bottomRight, { backgroundColor: color }]} pointerEvents="none">
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: "absolute", paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  topLeft: { left: spacing.sm, top: spacing.sm },
  bottomRight: { right: spacing.sm, bottom: spacing.sm },
  text: { color: "#fff", fontSize: fontSize.caption, fontWeight: fontWeight.bold },
});
