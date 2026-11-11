import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TextInput, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Search, Users, Star, Flag, ChevronRight } from "lucide-react-native";
import { api, AdminSeller, errorMessage } from "../api/client";
import { useToast } from "../components/Toast";
import { useAppAlert } from "../components/AppAlertProvider";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import EmptyState from "../components/EmptyState";
import { VerifiedBadge } from "../components/Badges";
import { RowSkeleton } from "../components/Skeleton";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight, contentWidth } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

const joined = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// Staff only: everyone who has listed something, with contact details, counts,
// rating and open reports, and a ban/unban switch.
export default function AdminSellersScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const showAlert = useAppAlert();
  const navigation = useNavigation<any>();
  const { isDesktopWeb, gutter } = useResponsive();
  const [query, setQuery] = useState("");
  const [bannedOnly, setBannedOnly] = useState(false);
  const [sellers, setSellers] = useState<AdminSeller[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const page = useRef(0);
  // Ignores answers to searches the person has already typed past.
  const latest = useRef(0);

  const load = useCallback(
    async (q: string, banned: boolean, nextPage: number) => {
      const ticket = ++latest.current;
      try {
        const res = await api.adminSellers(q, nextPage, banned);
        if (ticket !== latest.current) return;
        page.current = nextPage;
        setSellers((prev) => (nextPage === 0 ? res.sellers : [...(prev ?? []), ...res.sellers]));
        setTotal(res.total);
        setHasMore(res.hasMore);
      } catch (e) {
        if (ticket === latest.current) {
          setSellers((prev) => prev ?? []);
          toast.error(errorMessage(e));
        }
      }
    },
    [toast]
  );

  useEffect(() => {
    const t = setTimeout(() => load(query.trim(), bannedOnly, 0), 300);
    return () => clearTimeout(t);
  }, [query, bannedOnly, load]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await load(query.trim(), bannedOnly, page.current + 1);
    setLoadingMore(false);
  };

  const update = (id: string, patch: Partial<AdminSeller>) => setSellers((list) => list?.map((s) => (s.id === id ? { ...s, ...patch } : s)) ?? list);

  const ban = async (s: AdminSeller) => {
    setBusyId(s.id);
    try {
      await api.banUser(s.id);
      update(s.id, { bannedAt: new Date().toISOString(), activeListings: 0, openReports: 0 });
      toast.success(`${s.name} is banned.`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const unban = async (s: AdminSeller) => {
    setBusyId(s.id);
    try {
      await api.unbanUser(s.id);
      toast.success(`${s.name} can use Alibe again.`);
      // Counts change as their listings come back, so reload the list.
      load(query.trim(), bannedOnly, 0);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const confirmBan = (s: AdminSeller) =>
    showAlert({
      title: `Ban ${s.name}?`,
      message: "All their listings come down, unsent orders are cancelled, and their phone and email can't be used on Alibe again.",
      kind: "error",
      buttons: [{ text: "Cancel", style: "cancel" }, { text: "Ban", style: "destructive", onPress: () => ban(s) }],
    });

  const confirmUnban = (s: AdminSeller) =>
    showAlert({
      title: `Unban ${s.name}?`,
      message: "They can sign in again, and listings that came down with the ban go back up. Cancelled orders stay cancelled.",
      kind: "info",
      buttons: [{ text: "Cancel", style: "cancel" }, { text: "Unban", onPress: () => unban(s) }],
    });

  const renderItem = ({ item: s }: { item: AdminSeller }) => {
    const banned = !!s.bannedAt;
    return (
      <Tap style={[styles.row, banned && styles.rowBanned]} onPress={() => navigation.navigate("SellerProfile", { id: s.id })} scaleTo={0.98} accessibilityLabel={`Open ${s.name}'s profile`}>
        <View style={[styles.avatar, { backgroundColor: banned ? colors.textMuted : s.avatarColor ?? colors.primary }]}>
          <Text style={styles.avatarText}>{s.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {s.name}
            </Text>
            {s.verified && <VerifiedBadge size={14} />}
            {s.isAdmin && <Text style={[styles.tag, styles.tagStaff]}>Staff</Text>}
            {banned && <Text style={[styles.tag, styles.tagBanned]}>Banned</Text>}
          </View>
          <Text style={styles.meta} numberOfLines={1} selectable>
            {[s.username ? `@${s.username}` : null, s.phone, s.email].filter(Boolean).join("  ·  ") || "No contact details"}
          </Text>
          <View style={styles.stats}>
            <Text style={styles.stat}>
              {s.activeListings} for sale · {s.totalListings} total
            </Text>
            <Text style={styles.dot}>·</Text>
            {s.rating.count > 0 ? (
              <View style={styles.inline}>
                <Star size={12} color={colors.gold} fill={colors.gold} />
                <Text style={styles.stat}>
                  {s.rating.average.toFixed(1)} ({s.rating.count})
                </Text>
              </View>
            ) : (
              <Text style={styles.stat}>No reviews</Text>
            )}
            {s.openReports > 0 && (
              <>
                <Text style={styles.dot}>·</Text>
                <View style={styles.inline}>
                  <Flag size={12} color={colors.danger} />
                  <Text style={[styles.stat, { color: colors.danger, fontWeight: fontWeight.bold }]}>
                    {s.openReports} open report{s.openReports === 1 ? "" : "s"}
                  </Text>
                </View>
              </>
            )}
          </View>
          <Text style={styles.joined}>Joined {joined(s.createdAt)}</Text>
        </View>
        {!s.isAdmin &&
          (busyId === s.id ? (
            <ActivityIndicator color={colors.primary} style={styles.actionSpinner} />
          ) : (
            <Tap nested style={[styles.action, banned ? styles.actionUnban : styles.actionBan]} onPress={() => (banned ? confirmUnban(s) : confirmBan(s))} scaleTo={0.92} accessibilityLabel={banned ? `Unban ${s.name}` : `Ban ${s.name}`}>
              <Text style={[styles.actionText, { color: banned ? colors.primary : colors.danger }]}>{banned ? "Unban" : "Ban"}</Text>
            </Tap>
          ))}
        <ChevronRight size={16} color={colors.textMuted} />
      </Tap>
    );
  };

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Sellers" />}
      <View style={[styles.searchWrap, { paddingHorizontal: gutter }]}>
        <View style={styles.search}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Name, @username, phone or email"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search sellers"
          />
        </View>
        <View style={styles.filterRow}>
          {[
            { label: "All sellers", value: false },
            { label: "Banned", value: true },
          ].map((f) => (
            <Tap key={f.label} style={[styles.chip, bannedOnly === f.value && styles.chipActive]} onPress={() => setBannedOnly(f.value)} scaleTo={0.94}>
              <Text style={[styles.chipText, bannedOnly === f.value && styles.chipTextActive]}>{f.label}</Text>
            </Tap>
          ))}
          {!!sellers && <Text style={styles.count}>{total.toLocaleString()} {total === 1 ? "seller" : "sellers"}</Text>}
        </View>
      </View>
      {!sellers ? (
        <View style={{ paddingHorizontal: gutter }}>
          <RowSkeleton count={6} />
        </View>
      ) : (
        <FlatList
          data={sellers}
          keyExtractor={(s) => s.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: spacing.md }} /> : undefined}
          ListEmptyComponent={
            <EmptyState
              icon={Users}
              title={query ? "No matches" : bannedOnly ? "Nobody is banned" : "No sellers yet"}
              message={query ? "Try a name, @username, phone number or email." : bannedOnly ? "Banned accounts appear here." : "People appear here once they list something."}
            />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  searchWrap: { paddingTop: spacing.md, width: "100%", maxWidth: contentWidth.list, alignSelf: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: controlHeight.input, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, height: "100%", fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  filterRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  chip: { paddingHorizontal: spacing.md, height: 34, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  chipTextActive: { color: colors.inverseText },
  count: { marginLeft: "auto", fontSize: fontSize.caption, color: colors.textMuted },
  list: { paddingVertical: spacing.md, gap: spacing.sm, width: "100%", maxWidth: contentWidth.list, alignSelf: "center", flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm + 4, ...cardShadow },
  rowBanned: { opacity: 0.75 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: fontWeight.extrabold, fontSize: fontSize.lg },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  tag: { fontSize: fontSize.micro, fontWeight: fontWeight.extrabold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  tagStaff: { color: colors.primary, backgroundColor: colors.primaryTint },
  tagBanned: { color: "#fff", backgroundColor: colors.danger },
  meta: { fontSize: fontSize.caption, color: colors.textMuted },
  stats: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  inline: { flexDirection: "row", alignItems: "center", gap: 3 },
  stat: { fontSize: fontSize.caption, color: colors.text },
  dot: { fontSize: fontSize.caption, color: colors.textMuted },
  joined: { fontSize: fontSize.caption, color: colors.textMuted },
  action: { paddingHorizontal: spacing.sm + 4, height: 32, justifyContent: "center", borderRadius: radius.pill },
  actionBan: { backgroundColor: `${colors.danger}14` },
  actionUnban: { backgroundColor: colors.primaryTint },
  actionText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  actionSpinner: { width: 56 },
}));
