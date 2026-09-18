import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api, Listing } from "../api/client";
import { useAuth } from "../api/AuthContext";
import ProductGrid from "../components/ProductGrid";
import WebNavBar from "../components/WebNavBar";
import { colors, spacing } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

const MAX_CONTENT_WIDTH = 1400;

export default function MyListingsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { isDesktopWeb, width } = useResponsive();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setLoading(true);
      api.myListings(user.id).then(setListings).finally(() => setLoading(false));
    }, [user])
  );

  const goToProduct = (l: Listing) => navigation.navigate("ProductDetail", { id: l.id });
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - spacing.xl * 2;

  const body = loading ? (
    <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
  ) : (
    <ProductGrid
      data={listings}
      onPressItem={goToProduct}
      containerWidth={isDesktopWeb ? contentWidth : undefined}
      horizontalPadding={isDesktopWeb ? 0 : spacing.md}
      ListEmptyComponent={<Text style={styles.empty}>You haven't listed anything yet. Tap "Sell" to get started.</Text>}
    />
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar active="mylistings" />
        <View style={{ maxWidth: MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.lg, flex: 1 }}>
          <Text style={styles.header}>My Listings</Text>
          {body}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={[styles.header, { paddingHorizontal: spacing.md }]}>My Listings</Text>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl, paddingHorizontal: spacing.lg },
});
