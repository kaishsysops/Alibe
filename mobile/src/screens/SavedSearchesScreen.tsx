import React, { useCallback, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Bookmark, Trash2, Search } from "lucide-react-native";
import { api, errorMessage, SavedSearch } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useNotifications } from "../api/NotificationsContext";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import { RowSkeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

export function describeFilters(p: SavedSearch["params"]) {
  const parts: string[] = [];
  if (p.categorySlug) parts.push(p.categorySlug.replace("-", " & "));
  if (p.condition) parts.push(p.condition.replace("_", " ").toLowerCase());
  if (p.minPrice || p.maxPrice) parts.push(`MVR ${p.minPrice ?? "0"} to ${p.maxPrice ?? "any"}`);
  if (p.delivery) parts.push(p.delivery.toLowerCase());
  return parts.join(", ") || "Any category";
}

export default function SavedSearchesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const navigation = useNavigation<any>();
  const { refresh } = useNotifications();
  const { isDesktopWeb, gutter } = useResponsive();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api
        .savedSearches(user.id)
        .then(setItems)
        .catch(() => toast.error("Couldn't load your saved searches."))
        .finally(() => setLoading(false));
    }, [user, toast])
  );

  const open = (s: SavedSearch) => {
    api.markSearchSeen(s.id).then(refresh).catch(() => {});
    setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, newCount: 0 } : x)));
    navigation.navigate("Tabs", { screen: "SearchTab", params: { ...s.params, fromSaved: Date.now() } });
  };

  // Optimistic delete with undo-free rollback on failure.
  const remove = async (s: SavedSearch) => {
    setItems((prev) => prev.filter((x) => x.id !== s.id));
    try {
      await api.deleteSavedSearch(s.id);
      refresh();
    } catch (e) {
      setItems((prev) => [s, ...prev]);
      toast.error(errorMessage(e, "Couldn't remove that search."));
    }
  };

  const list = loading ? (
    <View style={{ paddingHorizontal: gutter }}>
      <RowSkeleton count={4} />
    </View>
  ) : (
    <FlatList
      data={items}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ paddingHorizontal: isDesktopWeb ? 0 : gutter, paddingBottom: spacing.xl, gap: spacing.sm, flexGrow: 1 }}
      ListEmptyComponent={
        <EmptyState
          icon={Bookmark}
          title="No saved searches"
          message={'Search for something, then tap "Save" to get alerted when new matches are listed.'}
          actionLabel="Go to search"
          onAction={() => navigation.navigate("Tabs", { screen: "SearchTab" })}
        />
      }
      renderItem={({ item }) => (
        <Tap style={styles.row} onPress={() => open(item)} scaleTo={0.98}>
          <View style={styles.icon}>
            <Search size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {describeFilters(item.params)}
            </Text>
          </View>
          {item.newCount > 0 && (
            <View style={styles.newPill}>
              <Text style={styles.newText}>{item.newCount} new</Text>
            </View>
          )}
          <Tap nested style={styles.delete} onPress={() => remove(item)} hitSlop={8} scaleTo={0.85} accessibilityLabel="Delete saved search">
            <Trash2 size={16} color={colors.textMuted} />
          </Tap>
        </Tap>
      )}
    />
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar />
        <View style={styles.desktopColumn}>
          <Text style={styles.header}>Saved searches</Text>
          {list}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <ScreenHeader title="Saved searches" />
      {list}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  desktopColumn: { maxWidth: 720, width: "100%", alignSelf: "center", flex: 1, paddingTop: spacing.lg, paddingHorizontal: spacing.lg },
  header: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card, ...cardShadow },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  label: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2, textTransform: "capitalize" },
  newPill: { paddingHorizontal: spacing.sm + 2, height: 24, borderRadius: radius.pill, backgroundColor: colors.danger, justifyContent: "center" },
  newText: { color: "#fff", fontSize: fontSize.caption, fontWeight: fontWeight.bold },
  delete: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
}));
