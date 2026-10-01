import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Heart } from "lucide-react-native";
import { api, Listing } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useFavorites } from "../api/FavoritesContext";
import ProductGrid from "../components/ProductGrid";
import WebNavBar from "../components/WebNavBar";
import ScreenHeader from "../components/ScreenHeader";
import EmptyState from "../components/EmptyState";
import { useToast } from "../components/Toast";
import { makeStyles } from "../theme/ThemeContext";
import { spacing, fontSize, fontWeight } from "../theme/theme";
import { useResponsive, MAX_CONTENT_WIDTH } from "../hooks/useResponsive";

export default function FavoritesScreen() {
  const styles = useStyles();
  const { user } = useAuth();
  const { favoriteIds } = useFavorites();
  const toast = useToast();
  const navigation = useNavigation<any>();
  const { isDesktopWeb, gutter, contentWidth } = useResponsive();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api
        .favorites(user.id)
        .then(setListings)
        .catch(() => toast.error("Couldn't load your saved items."))
        .finally(() => setLoading(false));
    }, [user, toast])
  );

  // Un-hearting a card removes it from this list instantly (optimistic).
  const visible = listings.filter((l) => favoriteIds.has(l.id));
  const goToProduct = (l: Listing) => navigation.navigate("ProductDetail", { id: l.id });

  const grid = (
    <ProductGrid
      data={visible}
      loading={loading}
      onPressItem={goToProduct}
      containerWidth={isDesktopWeb ? contentWidth : undefined}
      horizontalPadding={isDesktopWeb ? 0 : gutter}
      bottomPadding={spacing.xl}
      ListEmptyComponent={
        <EmptyState icon={Heart} title="No saved items yet" message="Tap the heart on any listing to keep it here for later." actionLabel="Start browsing" onAction={() => navigation.navigate("Tabs", { screen: "SearchTab" })} />
      }
    />
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar active="saved" />
        <View style={[styles.desktopColumn, { paddingHorizontal: gutter }]}>
          <Text style={styles.header}>Saved items</Text>
          {grid}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Saved items" subtitle={loading ? undefined : `${visible.length} saved`} />
      {grid}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  desktopColumn: { maxWidth: MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center", paddingTop: spacing.lg, flex: 1 },
  header: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: spacing.md },
}));
