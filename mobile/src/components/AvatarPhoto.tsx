import React from "react";
import { StyleSheet } from "react-native";
import { Image } from "expo-image";
import { mediaUrl } from "../api/client";

// Drop inside any round avatar (the coloured circle with an initial): when the
// person has a profile photo it covers the circle, otherwise nothing renders
// and the initial shows as before.
export default function AvatarPhoto({ uri }: { uri?: string | null }) {
  const src = mediaUrl(uri);
  if (!src) return null;
  return <Image source={{ uri: src }} style={styles.photo} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />;
}

const styles = StyleSheet.create({
  photo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999 },
});
