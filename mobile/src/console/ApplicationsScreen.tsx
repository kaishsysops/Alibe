import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, ActivityIndicator, Modal, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { BadgeCheck, Store, Lock, CheckCircle2, XCircle, ImageOff } from "lucide-react-native";
import { api, errorMessage, mediaUrl, SellerApplicationItem } from "../api/client";
import { useToast } from "../components/Toast";
import { useConsole } from "../components/ConsoleContext";
import EmptyState from "../components/EmptyState";
import AvatarPhoto from "../components/AvatarPhoto";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight } from "../theme/theme";
import { timeAgo } from "../utils/time";

// Seller approvers: ID checks and store applications. Photos open through
// links that last 10 minutes, and are deleted the moment it's decided.
type Tab = "PENDING" | "APPROVED" | "REJECTED";
const TABS: Array<[Tab, string]> = [
  ["PENDING", "Waiting"],
  ["APPROVED", "Approved"],
  ["REJECTED", "Turned down"],
];
const REASONS = ["The photos are unclear", "The ID doesn't match the selfie", "The ID is expired", "The business details don't check out"];

export default function ApplicationsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { refresh } = useConsole();
  const [tab, setTab] = useState<Tab>("PENDING");
  const [items, setItems] = useState<SellerApplicationItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.staffApplications(tab));
    } catch (e) {
      toast.error(errorMessage(e));
      setItems((x) => x ?? []);
    } finally {
      setRefreshing(false);
    }
  }, [tab, toast]);
  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  const decide = async (a: SellerApplicationItem, approve: boolean) => {
    if (!approve && reason.trim().length < 3) return toast.error("Say why, in a sentence. The applicant sees it.");
    setBusy(a.id);
    try {
      await api.decideApplication(a.id, approve, approve ? undefined : reason.trim());
      toast.success(approve ? `${a.user.name} is approved.` : "Turned down. They've been told why.");
      setItems((list) => list?.filter((x) => x.id !== a.id) ?? list);
      setRejecting(null);
      setReason("");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const photo = (label: string, url: string | null) => (
    <View style={styles.photoBox}>
      {url ? (
        <Tap onPress={() => setZoom(mediaUrl(url)!)} scaleTo={0.97} accessibilityLabel={`Open ${label}`}>
          <Image source={{ uri: mediaUrl(url) }} style={styles.photo} contentFit="cover" />
        </Tap>
      ) : (
        <View style={[styles.photo, styles.photoGone]}>
          <ImageOff size={18} color={colors.textMuted} />
        </View>
      )}
      <Text style={styles.photoLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.tabs}>
        {TABS.map(([key, label]) => (
          <Tap key={key} style={[styles.tab, tab === key && styles.tabOn]} onPress={() => setTab(key)} scaleTo={0.96}>
            <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
          </Tap>
        ))}
      </View>
      {!items ? (
        <ActivityIndicator color={colors.primary} style={{ margin: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (setRefreshing(true), load())} />}>
          {items.length === 0 && <EmptyState icon={BadgeCheck} title={tab === "PENDING" ? "Nothing waiting" : "Nothing here yet"} message={tab === "PENDING" ? "New ID checks and store applications appear here." : "Decided applications show here."} />}
          {items.map((a) => {
            const isStore = a.kind === "STORE";
            return (
              <View key={a.id} style={styles.card}>
                <View style={styles.head}>
                  <View style={[styles.kind, isStore && { backgroundColor: `${colors.gold}22` }]}>
                    {isStore ? <Store size={14} color={colors.gold} /> : <BadgeCheck size={14} color={colors.primary} />}
                    <Text style={[styles.kindText, isStore && { color: colors.gold }]}>{isStore ? "Store application" : "ID check"}</Text>
                  </View>
                  <Text style={styles.when}>{timeAgo(a.createdAt, true)}</Text>
                </View>

                <View style={styles.person}>
                  <View style={[styles.avatar, { backgroundColor: a.user.avatarColor ?? colors.primary }]}>
                    <Text style={styles.avatarText}>{a.user.name.charAt(0).toUpperCase()}</Text>
                    <AvatarPhoto uri={a.user.avatarUrl} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name}>{a.user.name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {[a.user.email, a.user.phone].filter(Boolean).join(" · ") || "No contact details"} · on Alibe since {new Date(a.user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                    </Text>
                  </View>
                </View>

                {isStore && a.store && (
                  <View style={styles.storeBox}>
                    {a.store.logoUrl ? <Image source={{ uri: mediaUrl(a.store.logoUrl) }} style={styles.logo} contentFit="cover" /> : <View style={[styles.logo, styles.photoGone]}><Store size={18} color={colors.textMuted} /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.storeName}>{a.store.name}</Text>
                      <Text style={styles.meta}>Registration no. {a.store.registrationNumber}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.idRow}>
                  <Lock size={13} color={colors.textMuted} />
                  <Text style={styles.meta}>
                    {a.idNumberLast4 ? `ID number ending ${a.idNumberLast4}` : a.user.verificationStatus === "VERIFIED" ? "Owner already verified: no ID photos needed" : "No ID number"}
                  </Text>
                </View>

                {a.status === "PENDING" ? (
                  (a.photos.idFront || a.photos.selfie) && (
                    <View style={styles.photos}>
                      {photo("ID front", a.photos.idFront)}
                      {a.photos.idBack ? photo("ID back", a.photos.idBack) : null}
                      {photo("Selfie with ID", a.photos.selfie)}
                    </View>
                  )
                ) : (
                  <View style={[styles.outcome, { backgroundColor: a.status === "APPROVED" ? `${colors.success}14` : `${colors.danger}10` }]}>
                    {a.status === "APPROVED" ? <CheckCircle2 size={16} color={colors.success} /> : <XCircle size={16} color={colors.danger} />}
                    <Text style={styles.outcomeText}>
                      {a.status === "APPROVED" ? "Approved" : `Turned down: ${a.note}`}
                      {a.decidedBy ? ` · by ${a.decidedBy}` : ""}
                      {a.decidedAt ? ` · ${timeAgo(a.decidedAt, true)}` : ""}. Photos deleted.
                    </Text>
                  </View>
                )}

                {a.status === "PENDING" &&
                  (rejecting === a.id ? (
                    <View style={{ gap: spacing.sm }}>
                      <View style={styles.reasons}>
                        {REASONS.map((r) => (
                          <Tap key={r} style={[styles.reasonChip, reason === r && styles.reasonChipOn]} onPress={() => setReason(r)} scaleTo={0.96}>
                            <Text style={[styles.reasonText, reason === r && { color: colors.inverseText }]}>{r}</Text>
                          </Tap>
                        ))}
                      </View>
                      <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Why it's turned down (the applicant sees this)" placeholderTextColor={colors.textMuted} maxLength={300} />
                      <View style={styles.actions}>
                        <Tap style={[styles.button, styles.secondary]} onPress={() => (setRejecting(null), setReason(""))} scaleTo={0.97}>
                          <Text style={[styles.buttonText, { color: colors.text }]}>Back</Text>
                        </Tap>
                        <Tap style={[styles.button, { backgroundColor: colors.danger }]} onPress={() => decide(a, false)} disabled={busy === a.id} scaleTo={0.97}>
                          {busy === a.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Turn down</Text>}
                        </Tap>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.actions}>
                      <Tap style={[styles.button, styles.secondary]} onPress={() => (setRejecting(a.id), setReason(""))} scaleTo={0.97}>
                        <Text style={[styles.buttonText, { color: colors.danger }]}>Turn down</Text>
                      </Tap>
                      <Tap style={[styles.button, { backgroundColor: colors.success }]} onPress={() => decide(a, true)} disabled={busy === a.id} scaleTo={0.97}>
                        {busy === a.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Approve</Text>}
                      </Tap>
                    </View>
                  ))}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoom(null)} accessibilityLabel="Close photo">
          {zoom && <Image source={{ uri: zoom }} style={styles.zoomImage} contentFit="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  tab: { paddingHorizontal: spacing.md, height: 36, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabOn: { backgroundColor: colors.text, borderColor: colors.text },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  tabTextOn: { color: colors.inverseText },
  list: { padding: spacing.lg, gap: spacing.md, maxWidth: 820 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.md, ...cardShadow },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kind: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 26, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  kindText: { fontSize: fontSize.caption, fontWeight: fontWeight.extrabold, color: colors.primary },
  when: { fontSize: fontSize.caption, color: colors.textMuted },
  person: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarText: { color: "#fff", fontWeight: fontWeight.extrabold, fontSize: fontSize.lg },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  storeBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.sm + 4, borderRadius: radius.md, backgroundColor: colors.background },
  logo: { width: 48, height: 48, borderRadius: 12 },
  storeName: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: colors.text },
  idRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 4 },
  photoBox: { gap: 4 },
  photo: { width: 168, height: 112, borderRadius: radius.md, backgroundColor: colors.background },
  photoGone: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  photoLabel: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.textMuted },
  outcome: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm + 4, borderRadius: radius.md },
  outcomeText: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reasonChip: { paddingHorizontal: 12, height: 32, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  reasonChipOn: { backgroundColor: colors.text, borderColor: colors.text },
  reasonText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.text },
  input: { height: controlHeight.input, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.base, color: colors.text, backgroundColor: colors.background, outlineStyle: "none" as any },
  actions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" },
  button: { minWidth: 130, height: 44, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  secondary: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.base },
  zoomBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  zoomImage: { width: "100%", height: "100%", maxWidth: 900 },
}));
