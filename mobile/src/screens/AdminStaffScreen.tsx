import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, TextInput, ActivityIndicator } from "react-native";
import { UserCog, UserPlus, Mail, X, Lock } from "lucide-react-native";
import { api, errorMessage, StaffMember } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import { useAppAlert } from "../components/AppAlertProvider";
import { useSingleFlight } from "../hooks/useSingleFlight";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import { RowSkeleton } from "../components/Skeleton";
import AvatarPhoto from "../components/AvatarPhoto";
import { FadeIn } from "../components/Motion";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, contentWidth, controlHeight } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

// Staff only: who has staff access, and adding someone by email. Staff sign in
// with their normal email code; there's no separate staff password to share.
export default function AdminStaffScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const showAlert = useAppAlert();
  const { user } = useAuth();
  const { isDesktopWeb, gutter } = useResponsive();
  const [data, setData] = useState<{ staff: StaffMember[]; invites: string[] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api.adminStaff());
    } catch (e) {
      setData((d) => d ?? { staff: [], invites: [] });
      toast.error(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const [add, adding] = useSingleFlight(async () => {
    const value = email.trim().toLowerCase();
    if (!isEmail(value)) return toast.error("Please enter a valid email address.");
    try {
      const res = await api.addStaff(value);
      setEmail("");
      toast.success(res.added === "now" ? `${res.name ?? value} is staff now.` : `Added. ${value} becomes staff the first time they sign in.`);
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const remove = (s: StaffMember) =>
    showAlert({
      title: `Remove ${s.name} from staff?`,
      message: "They keep their account, but lose access to the staff screens.",
      kind: "warning",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            // Optimistic: the row goes at once and comes back if the server says no.
            const before = data;
            setData((d) => d && { ...d, staff: d.staff.filter((x) => x.id !== s.id) });
            try {
              await api.removeStaff(s.id);
              toast.success(`${s.name} is no longer staff.`);
            } catch (e) {
              setData(before);
              toast.error(errorMessage(e));
            }
          },
        },
      ],
    });

  const cancelInvite = async (invite: string) => {
    const before = data;
    setData((d) => d && { ...d, invites: d.invites.filter((x) => x !== invite) });
    try {
      await api.cancelStaffInvite(invite);
    } catch (e) {
      setData(before);
      toast.error(errorMessage(e));
    }
  };

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Staff" />}
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (setRefreshing(true), load())} tintColor={colors.primary} />}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add a staff member</Text>
          <Text style={styles.cardText}>Type their email. They sign in with it like anyone else and get the staff screens.</Text>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputRow}>
            <Mail size={18} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="done"
              onSubmitEditing={() => add()}
              accessibilityLabel="Staff member's email"
            />
          </View>
          <Tap style={[styles.button, (!isEmail(email) || adding) && styles.buttonDisabled]} onPress={() => add()} disabled={!isEmail(email) || adding} scaleTo={0.97}>
            {adding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <UserPlus size={18} color="#fff" />
                <Text style={styles.buttonText}>Make staff</Text>
              </>
            )}
          </Tap>
        </View>

        <Text style={styles.section}>Staff</Text>
        {!data ? (
          <RowSkeleton count={3} />
        ) : (
          data.staff.map((s, i) => (
            <FadeIn key={s.id} delay={i * 30} style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: s.avatarColor ?? colors.primary }]}>
                <Text style={styles.avatarText}>{s.name.charAt(0).toUpperCase()}</Text>
                <AvatarPhoto uri={s.avatarUrl} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {s.name}
                  {s.id === user?.id ? " (you)" : ""}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {s.email ?? (s.username ? `@${s.username}` : "No email")}
                </Text>
              </View>
              {s.fixed ? (
                <View style={styles.fixed} accessibilityLabel="Set on the server">
                  <Lock size={13} color={colors.textMuted} />
                  <Text style={styles.fixedText}>Server</Text>
                </View>
              ) : s.id !== user?.id ? (
                <Tap style={styles.remove} onPress={() => remove(s)} scaleTo={0.92} accessibilityLabel={`Remove ${s.name} from staff`}>
                  <Text style={styles.removeText}>Remove</Text>
                </Tap>
              ) : null}
            </FadeIn>
          ))
        )}

        {!!data?.invites.length && (
          <>
            <Text style={styles.section}>Waiting for first sign-in</Text>
            {data.invites.map((invite) => (
              <View key={invite} style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: colors.primaryTint }]}>
                  <Mail size={18} color={colors.primary} />
                </View>
                <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>
                  {invite}
                </Text>
                <Tap style={styles.iconButton} onPress={() => cancelInvite(invite)} hitSlop={8} scaleTo={0.88} accessibilityLabel={`Cancel staff invite for ${invite}`}>
                  <X size={16} color={colors.textMuted} />
                </Tap>
              </View>
            ))}
          </>
        )}

        {data && data.staff.length === 0 && (
          <View style={styles.empty}>
            <UserCog size={28} color={colors.textMuted} />
            <Text style={styles.meta}>No staff yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingVertical: spacing.md, gap: spacing.sm, width: "100%", maxWidth: contentWidth.list, alignSelf: "center", flexGrow: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, ...cardShadow },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  cardText: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: 2 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  input: { flex: 1, fontSize: fontSize.md, color: colors.text, height: "100%" },
  button: { flexDirection: "row", gap: spacing.sm, height: 52, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: "#fff", fontSize: fontSize.md, fontWeight: fontWeight.bold },
  section: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginTop: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm + 4, ...cardShadow },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarText: { color: "#fff", fontSize: fontSize.md, fontWeight: fontWeight.bold },
  name: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  remove: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.danger + "1A", alignItems: "center", justifyContent: "center" },
  removeText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.danger },
  fixed: { flexDirection: "row", alignItems: "center", gap: 4 },
  fixedText: { fontSize: fontSize.caption, color: colors.textMuted, fontWeight: fontWeight.semibold },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  empty: { alignItems: "center", gap: spacing.sm, padding: spacing.lg },
}));
