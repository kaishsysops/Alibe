import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { LogOut, Archive, Heart, Phone, Palette, HelpCircle, Info, ChevronRight, Pencil, Trash2, MessageSquareText } from "lucide-react-native";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useFavorites } from "../api/FavoritesContext";
import { useAppAlert } from "../components/AppAlertProvider";
import { useToast } from "../components/Toast";
import { Skeleton } from "../components/Skeleton";
import WebNavBar from "../components/WebNavBar";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, tabBarClearance, cardShadow, fontSize, fontWeight } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { formatPhone } from "../utils/phone";
import { WhatsAppIcon, ViberIcon } from "../components/BrandIcons";

export default function ProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user, signOut, deleteAccount } = useAuth();
  const { favoriteIds } = useFavorites();
  const navigation = useNavigation<any>();
  const showAlert = useAppAlert();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { isDesktopWeb, gutter } = useResponsive();
  const [counts, setCounts] = useState<{ active: number; sold: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api
        .myListings(user.id)
        .then((listings) =>
          setCounts({ active: listings.filter((l) => l.status === "ACTIVE").length, sold: listings.filter((l) => l.status === "SOLD").length })
        )
        .catch(() => {});
    }, [user])
  );

  const [runDelete, deleting] = useSingleFlight(async () => {
    try {
      await deleteAccount();
      toast.success("Your account and listings have been deleted.");
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't delete your account. Please try again."));
    }
  });

  const confirmSignOut = () =>
    showAlert({
      title: "Sign out?",
      message: "Your listings and chats stay safe. Sign back in with the same number anytime.",
      kind: "info",
      buttons: [{ text: "Cancel", style: "cancel" }, { text: "Sign out", onPress: signOut }],
    });

  const confirmDelete = () =>
    showAlert({
      title: "Delete your account?",
      message: "This permanently removes your profile, all your listings, saved items and chats. It can't be undone.",
      kind: "error",
      buttons: [{ text: "Keep account", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => runDelete() }],
    });

  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : null;
  const contactSummary = (
    <View style={styles.contactIcons}>
      <WhatsAppIcon size={16} color={user?.whatsappEnabled ? undefined : colors.border} />
      <ViberIcon size={16} color={user?.viberEnabled ? undefined : colors.border} />
    </View>
  );

  const groups: Array<Array<{ icon: any; label: string; value?: React.ReactNode; onPress: () => void }>> = [
    [
      { icon: Archive, label: "My listings", value: counts ? String(counts.active) : undefined, onPress: () => navigation.navigate("MyListings") },
      { icon: Heart, label: "Saved items", value: String(favoriteIds.size), onPress: () => navigation.navigate("Favorites") },
    ],
    [
      { icon: Phone, label: "Phone number", value: formatPhone(user?.phone), onPress: () => navigation.navigate("ChangePhone") },
      { icon: MessageSquareText, label: "WhatsApp and Viber", value: contactSummary, onPress: () => navigation.navigate("EditProfile", { section: "contact" }) },
      { icon: Palette, label: "App colour", value: <View style={[styles.colorDot, { backgroundColor: colors.primary }]} />, onPress: () => navigation.navigate("EditProfile", { section: "appearance" }) },
    ],
    [
      { icon: HelpCircle, label: "Help and support", onPress: () => toast.info("Support chat is coming soon. For now, email help@alibe.mv.") },
      { icon: Info, label: "About Alibe", onPress: () => toast.info("Alibe v0.2. A marketplace for every island in the Maldives.") },
    ],
  ];

  const content = (
    <View style={{ width: "100%", maxWidth: 560, alignSelf: "center" }}>
      <View style={styles.headerCard}>
        <View style={[styles.avatar, { backgroundColor: user?.avatarColor ?? colors.primary }]}>
          <Text style={styles.avatarText}>{(user?.name ?? "?").charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {user?.name}
          </Text>
          <Text style={styles.subline} numberOfLines={1}>
            {user?.username ? `@${user.username}` : "No username yet"}
            {memberSince ? `  ·  Since ${memberSince}` : ""}
          </Text>
        </View>
        <Tap style={styles.editButton} onPress={() => navigation.navigate("EditProfile")} scaleTo={0.9} accessibilityLabel="Edit profile">
          <Pencil size={15} color={colors.primary} />
          <Text style={styles.editText}>Edit</Text>
        </Tap>
      </View>

      <View style={styles.statsRow}>
        {[
          { label: "Active", value: counts?.active },
          { label: "Sold", value: counts?.sold },
          { label: "Saved", value: favoriteIds.size },
        ].map((s, i) => (
          <View key={s.label} style={[styles.statTile, i > 0 && styles.statTileBorder]}>
            {s.value === undefined ? <Skeleton width={28} height={22} /> : <Text style={styles.statValue}>{s.value}</Text>}
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {groups.map((items, gi) => (
        <View key={gi} style={styles.menuCard}>
          {items.map((item, i) => (
            <Tap key={item.label} style={[styles.menuRow, i > 0 && styles.menuRowBorder]} onPress={item.onPress} scaleTo={0.98}>
              <View style={styles.menuIcon}>
                <item.icon size={18} color={colors.text} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {typeof item.value === "string" ? <Text style={styles.menuValue}>{item.value}</Text> : item.value}
              <ChevronRight size={16} color={colors.textMuted} />
            </Tap>
          ))}
        </View>
      ))}

      <Tap style={styles.signOutButton} onPress={confirmSignOut}>
        <LogOut size={17} color={colors.text} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Tap>
      <Tap style={styles.deleteButton} onPress={confirmDelete} disabled={deleting}>
        {deleting ? <ActivityIndicator color={colors.danger} /> : <Trash2 size={16} color={colors.danger} />}
        <Text style={styles.deleteText}>Delete account</Text>
      </Tap>
    </View>
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar active="profile" />
        <ScrollView contentContainerStyle={{ padding: spacing.xl }}>{content}</ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: spacing.md, paddingBottom: tabBarClearance }}>{content}</ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  headerCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: fontWeight.extrabold, fontSize: fontSize.xxl },
  name: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  subline: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  editButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm + 4, height: 36, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  editText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  statsRow: { flexDirection: "row", backgroundColor: colors.card, borderRadius: radius.lg, ...cardShadow, marginTop: spacing.md, paddingVertical: spacing.md },
  statTile: { flex: 1, alignItems: "center", gap: 4 },
  statTileBorder: { borderLeftWidth: 1, borderLeftColor: colors.border },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  statLabel: { fontSize: fontSize.caption, color: colors.textMuted },
  menuCard: { backgroundColor: colors.card, borderRadius: radius.lg, ...cardShadow, marginTop: spacing.md, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, paddingHorizontal: spacing.md, minHeight: 56 },
  menuRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  menuIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: fontSize.base, color: colors.text, fontWeight: fontWeight.medium },
  menuValue: { fontSize: fontSize.sm, color: colors.textMuted },
  contactIcons: { flexDirection: "row", gap: 6 },
  colorDot: { width: 18, height: 18, borderRadius: 9 },
  signOutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.lg, height: 52, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  signOutText: { color: colors.text, fontWeight: fontWeight.bold, fontSize: fontSize.base },
  deleteButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs + 2, marginTop: spacing.sm, height: 48 },
  deleteText: { color: colors.danger, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
}));
