import React, { useCallback, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ShieldCheck } from "lucide-react-native";
import { api, BlockedUser, errorMessage } from "../api/client";
import { useAuth } from "../api/AuthContext";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import { RowSkeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

export default function BlockedUsersScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const { isDesktopWeb, gutter } = useResponsive();
  const [items, setItems] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api
        .blockedUsers(user.id)
        .then(setItems)
        .catch(() => toast.error("Couldn't load blocked users."))
        .finally(() => setLoading(false));
    }, [user, toast])
  );

  const unblock = async (b: BlockedUser) => {
    if (!user) return;
    setItems((prev) => prev.filter((x) => x.id !== b.id));
    try {
      await api.unblock(user.id, b.user.id);
      toast.success(`${b.user.name} is unblocked.`);
    } catch (e) {
      setItems((prev) => [b, ...prev]);
      toast.error(errorMessage(e, "Couldn't unblock. Please try again."));
    }
  };

  const list = loading ? (
    <View style={{ paddingHorizontal: gutter }}>
      <RowSkeleton count={3} />
    </View>
  ) : (
    <FlatList
      data={items}
      keyExtractor={(b) => b.id}
      contentContainerStyle={{ paddingHorizontal: isDesktopWeb ? 0 : gutter, paddingBottom: spacing.xl, gap: spacing.sm, flexGrow: 1 }}
      ListEmptyComponent={<EmptyState icon={ShieldCheck} title="No one is blocked" message="People you block can't message you, and you won't see each other's listings." />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: item.user.avatarColor ?? colors.primary }]}>
            <Text style={styles.avatarText}>{item.user.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {item.user.name}
          </Text>
          <Tap style={styles.unblock} onPress={() => unblock(item)} scaleTo={0.92}>
            <Text style={styles.unblockText}>Unblock</Text>
          </Tap>
        </View>
      )}
    />
  );

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Blocked users" />}
      <View style={isDesktopWeb ? styles.desktopColumn : { flex: 1 }}>
        {isDesktopWeb && <Text style={styles.header}>Blocked users</Text>}
        {list}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  desktopColumn: { maxWidth: 640, width: "100%", alignSelf: "center", flex: 1, paddingTop: spacing.lg, paddingHorizontal: spacing.lg },
  header: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card, ...cardShadow },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: fontWeight.extrabold },
  name: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  unblock: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  unblockText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
}));
