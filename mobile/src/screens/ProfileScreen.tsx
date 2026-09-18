import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Star, LogOut, Archive, Heart, ShieldCheck, Globe, Bell, HelpCircle, Info, ChevronRight, CheckCircle2 } from "lucide-react-native";
import { api } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { colors, spacing, radius } from "../theme/theme";
import WebNavBar from "../components/WebNavBar";
import { useResponsive } from "../hooks/useResponsive";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const { isDesktopWeb } = useResponsive();
  const [activeCount, setActiveCount] = useState(0);
  const [soldCount, setSoldCount] = useState(0);
  const [notifications, setNotifications] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api.myListings(user.id).then((listings) => {
        setActiveCount(listings.filter((l) => l.status === "ACTIVE").length);
        setSoldCount(listings.filter((l) => l.status === "SOLD").length);
      });
    }, [user])
  );

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : "just now";

  const notImplemented = (title: string, body: string) => Alert.alert(title, body);

  const menuItems = [
    { icon: Archive, label: "My Listings", value: String(activeCount), onPress: () => navigation.navigate("MyListingsTab") },
    { icon: Heart, label: "Saved Items", value: "Soon", onPress: () => notImplemented("Saved Items", "Favorites/saved listings are on the MVP roadmap — not wired up yet.") },
    { icon: ShieldCheck, label: "Seller Verification", value: "Not verified", onPress: () => notImplemented("Verification", "NID or business-registration verification is a Phase 1 follow-up, per the trust & safety flow in the brief.") },
    { icon: Globe, label: "Language", value: "English", onPress: () => notImplemented("Language", "Dhivehi (Thaana) support is planned for Phase 3.") },
    { icon: HelpCircle, label: "Help & Support", onPress: () => notImplemented("Help & Support", "This demo doesn't have a support inbox yet — file issues with the dev team instead.") },
    { icon: Info, label: "About Alibe", onPress: () => notImplemented("About Alibe", "Alibe v0.1.0 — an MVP scaffold for a Maldives-wide marketplace, replacing Facebook Marketplace.") },
  ];

  const content = (
    <View style={{ width: "100%", maxWidth: 480, alignSelf: "center" }}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name.charAt(0) ?? "?"}</Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>
        <View style={styles.ratingRow}>
          <Star size={14} color={colors.gold} fill={colors.gold} />
          <Star size={14} color={colors.gold} fill={colors.gold} />
          <Star size={14} color={colors.gold} fill={colors.gold} />
          <Star size={14} color={colors.gold} fill={colors.gold} />
          <Star size={14} color={colors.gold} fill={colors.gold} />
          <Text style={styles.ratingMeta}>No reviews yet</Text>
        </View>
        <Text style={styles.memberSince}>Member since {memberSince}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{activeCount}</Text>
          <Text style={styles.statLabel}>Active listings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{soldCount}</Text>
          <Text style={styles.statLabel}>Sold</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statTile}>
          <CheckCircle2 size={18} color={colors.textMuted} />
          <Text style={styles.statLabel}>Not verified</Text>
        </View>
      </View>

      <View style={styles.menuCard}>
        {menuItems.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuRow, i > 0 && styles.menuRowBorder]}
            onPress={item.onPress}
          >
            <item.icon size={18} color={colors.textMuted} />
            <Text style={styles.menuLabel}>{item.label}</Text>
            {item.value && <Text style={styles.menuValue}>{item.value}</Text>}
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
        <View style={[styles.menuRow, styles.menuRowBorder]}>
          <Bell size={18} color={colors.textMuted} />
          <Text style={styles.menuLabel}>Notifications</Text>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <LogOut size={16} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );

  if (isDesktopWeb) {
    return (
      <View style={styles.container}>
        <WebNavBar active="profile" />
        <View style={{ padding: spacing.xl }}>{content}</View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={{ padding: spacing.md, paddingBottom: spacing.xl }}>{content}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 28 },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  phone: { color: colors.textMuted, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, gap: 2 },
  ratingMeta: { color: colors.textMuted, fontSize: 12, marginLeft: spacing.xs },
  memberSince: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  statTile: { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, textAlign: "center" },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    overflow: "hidden",
  },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  menuRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  menuLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: "500" },
  menuValue: { fontSize: 13, color: colors.textMuted },
  signOutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, marginTop: spacing.xl, padding: spacing.md },
  signOutText: { color: colors.danger, fontWeight: "700" },
});
