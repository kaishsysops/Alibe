import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, TextInput, ActivityIndicator } from "react-native";
import { UserCog, UserPlus, Mail, X, Lock, Crown, Check } from "lucide-react-native";
import { api, errorMessage, StaffMember, StaffInvite, StaffRole } from "../api/client";
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
import StaffOnly from "../components/StaffOnly";
import { ROLE_HELP, ROLE_LABEL } from "../console/sections";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const ROLES: StaffRole[] = ["SELLER_APPROVER", "POST_APPROVER", "MODERATOR", "SUPPORT"];

// Access picker: Admin (everything) or any mix of portal roles.
function AccessPicker({ admin, roles, onChange }: { admin: boolean; roles: StaffRole[]; onChange: (admin: boolean, roles: StaffRole[]) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toggle = (r: StaffRole) => onChange(false, roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r]);
  return (
    <View style={{ gap: 6 }}>
      <Tap style={[styles.option, admin && styles.optionOn]} onPress={() => onChange(!admin, admin ? roles : [])} scaleTo={0.98} accessibilityRole="checkbox" accessibilityState={{ checked: admin }}>
        <View style={[styles.check, admin && styles.checkOn]}>{admin && <Check size={13} color="#fff" strokeWidth={3} />}</View>
        <Crown size={16} color={admin ? colors.primary : colors.textMuted} />
        <View style={{ flex: 1 }}>
          <Text style={styles.optionTitle}>Admin</Text>
          <Text style={styles.optionHelp}>Everything, including money, bans, categories and staff</Text>
        </View>
      </Tap>
      {!admin &&
        ROLES.map((r) => {
          const on = roles.includes(r);
          return (
            <Tap key={r} style={[styles.option, on && styles.optionOn]} onPress={() => toggle(r)} scaleTo={0.98} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
              <View style={[styles.check, on && styles.checkOn]}>{on && <Check size={13} color="#fff" strokeWidth={3} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{ROLE_LABEL[r]}</Text>
                <Text style={styles.optionHelp}>{ROLE_HELP[r]}</Text>
              </View>
            </Tap>
          );
        })}
    </View>
  );
}

function RoleChips({ admin, roles }: { admin: boolean; roles: StaffRole[] }) {
  const styles = useStyles();
  if (admin) return <View style={[styles.chip, styles.chipAdmin]}><Text style={[styles.chipText, styles.chipAdminText]}>Admin</Text></View>;
  return (
    <>
      {roles.map((r) => (
        <View key={r} style={styles.chip}>
          <Text style={styles.chipText}>{ROLE_LABEL[r]}</Text>
        </View>
      ))}
    </>
  );
}

// Admins only: who has admin or portal access, adding people by email with a
// role, and changing roles. Staff sign in with their normal Alibe account.
function AdminStaffScreenInner() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const showAlert = useAppAlert();
  const { user } = useAuth();
  const { isDesktopWeb, gutter } = useResponsive();
  const [data, setData] = useState<{ staff: StaffMember[]; invites: StaffInvite[] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState("");
  const [newAdmin, setNewAdmin] = useState(false);
  const [newRoles, setNewRoles] = useState<StaffRole[]>([]);
  const [editing, setEditing] = useState<{ id: string; admin: boolean; roles: StaffRole[] } | null>(null);
  const [saving, setSaving] = useState(false);

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

  const ready = isEmail(email) && (newAdmin || newRoles.length > 0);
  const [add, adding] = useSingleFlight(async () => {
    const value = email.trim().toLowerCase();
    if (!isEmail(value)) return toast.error("Please enter a valid email address.");
    if (!newAdmin && !newRoles.length) return toast.error("Pick Admin or at least one role.");
    try {
      const res = await api.addStaff(value, newAdmin, newRoles);
      setEmail("");
      setNewAdmin(false);
      setNewRoles([]);
      toast.success(res.added === "now" ? `${res.name ?? value} has access now.` : `Added. ${value} gets access the first time they sign in.`);
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.admin && !editing.roles.length) return toast.error("Pick Admin or at least one role, or use Remove.");
    setSaving(true);
    try {
      await api.updateStaff(editing.id, editing.admin, editing.roles);
      setData((d) => d && { ...d, staff: d.staff.map((s) => (s.id === editing.id ? { ...s, isAdmin: editing.admin, staffRoles: editing.roles } : s)) });
      setEditing(null);
      toast.success("Access updated.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = (s: StaffMember) =>
    showAlert({
      title: `Remove ${s.name} from staff?`,
      message: "They keep their Alibe account, but lose admin and portal access.",
      kind: "warning",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
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
    setData((d) => d && { ...d, invites: d.invites.filter((x) => x.email !== invite) });
    try {
      await api.cancelStaffInvite(invite);
    } catch (e) {
      setData(before);
      toast.error(errorMessage(e));
    }
  };

  const admins = data?.staff.filter((s) => s.isAdmin) ?? [];
  const approvers = data?.staff.filter((s) => !s.isAdmin) ?? [];

  const renderMember = (s: StaffMember, i: number) => {
    const isEditing = editing?.id === s.id;
    return (
      <FadeIn key={s.id} delay={i * 30} style={styles.memberCard}>
        <View style={styles.memberRow}>
          <View style={[styles.avatar, { backgroundColor: s.avatarColor ?? colors.primary }]}>
            <Text style={styles.avatarText}>{s.name.charAt(0).toUpperCase()}</Text>
            <AvatarPhoto uri={s.avatarUrl} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={styles.name} numberOfLines={1}>
              {s.name}
              {s.id === user?.id ? " (you)" : ""}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {s.email ?? (s.username ? `@${s.username}` : "No email")}
            </Text>
            <View style={styles.chips}>
              <RoleChips admin={s.isAdmin} roles={s.staffRoles} />
            </View>
          </View>
          {s.fixed ? (
            <View style={styles.fixed} accessibilityLabel="Set on the server">
              <Lock size={13} color={colors.textMuted} />
              <Text style={styles.fixedText}>Server</Text>
            </View>
          ) : s.id !== user?.id && !isEditing ? (
            <View style={styles.memberActions}>
              <Tap style={styles.smallButton} onPress={() => setEditing({ id: s.id, admin: s.isAdmin, roles: s.staffRoles })} scaleTo={0.94}>
                <Text style={styles.smallButtonText}>Change</Text>
              </Tap>
              <Tap style={styles.remove} onPress={() => remove(s)} scaleTo={0.92} accessibilityLabel={`Remove ${s.name} from staff`}>
                <Text style={styles.removeText}>Remove</Text>
              </Tap>
            </View>
          ) : null}
        </View>
        {isEditing && (
          <View style={{ gap: spacing.sm }}>
            <AccessPicker admin={editing.admin} roles={editing.roles} onChange={(admin, roles) => setEditing({ ...editing, admin, roles })} />
            <View style={styles.editActions}>
              <Tap style={[styles.smallButton, { height: 40 }]} onPress={() => setEditing(null)} scaleTo={0.96}>
                <Text style={styles.smallButtonText}>Cancel</Text>
              </Tap>
              <Tap style={[styles.saveButton]} onPress={saveEdit} disabled={saving} scaleTo={0.96}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
              </Tap>
            </View>
          </View>
        )}
      </FadeIn>
    );
  };

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Staff and roles" />}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (setRefreshing(true), load())} tintColor={colors.primary} />}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add someone</Text>
          <Text style={styles.cardText}>They sign in with this email (code or Google). Approvers use portal.alibe.online; admins can use both sites.</Text>
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
              accessibilityLabel="Staff member's email"
            />
          </View>
          <Text style={styles.label}>Access</Text>
          <AccessPicker
            admin={newAdmin}
            roles={newRoles}
            onChange={(a, r) => {
              setNewAdmin(a);
              setNewRoles(r);
            }}
          />
          <Tap style={[styles.button, (!ready || adding) && styles.buttonDisabled]} onPress={() => add()} disabled={!ready || adding} scaleTo={0.97}>
            {adding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <UserPlus size={18} color="#fff" />
                <Text style={styles.buttonText}>{newAdmin ? "Add admin" : "Add approver"}</Text>
              </>
            )}
          </Tap>
        </View>

        {!data ? (
          <RowSkeleton count={3} />
        ) : (
          <>
            <Text style={styles.section}>Admins · {admins.length}</Text>
            {admins.map(renderMember)}
            <Text style={styles.section}>Approvers and support · {approvers.length}</Text>
            {approvers.length ? approvers.map(renderMember) : <Text style={styles.meta}>No approvers yet. Add one above.</Text>}
          </>
        )}

        {!!data?.invites.length && (
          <>
            <Text style={styles.section}>Waiting for first sign-in</Text>
            {data.invites.map((invite) => (
              <View key={invite.email} style={styles.memberRowCard}>
                <View style={[styles.avatar, { backgroundColor: colors.primaryTint }]}>
                  <Mail size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {invite.email}
                  </Text>
                  <View style={styles.chips}>
                    <RoleChips admin={invite.admin} roles={invite.roles} />
                  </View>
                </View>
                <Tap style={styles.iconButton} onPress={() => cancelInvite(invite.email)} hitSlop={8} scaleTo={0.88} accessibilityLabel={`Cancel invite for ${invite.email}`}>
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
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.sm, ...cardShadow },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  cardText: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 19 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.xs },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  input: { flex: 1, fontSize: fontSize.md, color: colors.text, height: "100%", outlineStyle: "none" as any },
  option: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, padding: spacing.sm + 4, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  optionHelp: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 1 },
  button: { flexDirection: "row", gap: spacing.sm, height: 52, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: "#fff", fontSize: fontSize.base, fontWeight: fontWeight.bold },
  section: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginTop: spacing.md },
  memberCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm + 4, gap: spacing.sm + 4, ...cardShadow },
  memberRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  memberRowCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm + 4, ...cardShadow },
  memberActions: { flexDirection: "row", gap: 6 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarText: { color: "#fff", fontSize: fontSize.md, fontWeight: fontWeight.bold },
  name: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.caption, color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  chip: { paddingHorizontal: 8, height: 22, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  chipText: { fontSize: fontSize.micro, fontWeight: fontWeight.bold, color: colors.primary },
  chipAdmin: { backgroundColor: colors.text },
  chipAdminText: { color: colors.background },
  smallButton: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  smallButtonText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  saveButton: { minWidth: 110, height: 40, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  editActions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" },
  remove: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.danger + "1A", alignItems: "center", justifyContent: "center" },
  removeText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.danger },
  fixed: { flexDirection: "row", alignItems: "center", gap: 4 },
  fixedText: { fontSize: fontSize.caption, color: colors.textMuted, fontWeight: fontWeight.semibold },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  empty: { alignItems: "center", gap: spacing.sm, padding: spacing.lg },
}));

export default function AdminStaffScreen() {
  return (
    <StaffOnly title="Staff">
      <AdminStaffScreenInner />
    </StaffOnly>
  );
}
