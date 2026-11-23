import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, TextInput, ActivityIndicator, Platform } from "react-native";
import { UserCog, UserPlus, Crown, Check, AtSign, Copy, CheckCircle2, Link2 } from "lucide-react-native";
import { api, errorMessage, StaffMember, StaffRole } from "../api/client";
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
import { staffInviteUrl } from "../site";

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

const USERNAME = /^[a-z0-9._-]{3,30}$/;

// Admins only: staff logins and what each can do. New staff (and anyone who
// forgot their password) get a one-time sign-in link to choose a password;
// admins never see or set anyone's password.
function AdminStaffScreenInner() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const showAlert = useAppAlert();
  const { user } = useAuth();
  const { isDesktopWeb, gutter } = useResponsive();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [newAdmin, setNewAdmin] = useState(false);
  const [newRoles, setNewRoles] = useState<StaffRole[]>([]);
  const [editing, setEditing] = useState<{ id: string; admin: boolean; roles: StaffRole[] } | null>(null);
  const [linking, setLinking] = useState<{ id: string; username: string } | null>(null);
  // The link just made, shown once so the admin can copy it.
  const [link, setLink] = useState<{ name: string; username: string; url: string; expiresAt: string; reset: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setStaff((await api.adminStaff()).staff);
    } catch (e) {
      setStaff((d) => d ?? []);
      toast.error(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const cleanUsername = username.trim().toLowerCase();
  const ready = name.trim().length >= 2 && USERNAME.test(cleanUsername) && (newAdmin || newRoles.length > 0);
  const [add, adding] = useSingleFlight(async () => {
    if (!ready) return toast.error("Fill in a name, a username (3+ letters or numbers) and their access.");
    try {
      const res = await api.addStaff({ name: name.trim(), username: cleanUsername, admin: newAdmin, roles: newRoles });
      setLink({ name: res.member.name, username: cleanUsername, url: staffInviteUrl(res.invite.site, res.invite.token), expiresAt: res.invite.expiresAt, reset: false });
      setName("");
      setUsername("");
      setNewAdmin(false);
      setNewRoles([]);
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const copy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast.success("Copied.")).catch(() => {});
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.admin && !editing.roles.length) return toast.error("Pick Admin or at least one role, or use Remove.");
    setSaving(true);
    try {
      const updated = await api.updateStaff(editing.id, editing.admin, editing.roles);
      setStaff((list) => list?.map((s) => (s.id === editing.id ? { ...s, ...updated } : s)) ?? list);
      setEditing(null);
      toast.success("Access updated.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const makeLink = async (s: StaffMember) => {
    if (!linking) return;
    if (!s.username && !USERNAME.test(linking.username.trim().toLowerCase())) return toast.error("Choose a username: 3 to 30 letters or numbers.");
    setSaving(true);
    try {
      const res = await api.newStaffInvite(s.id, s.username ? undefined : linking.username.trim().toLowerCase());
      setLink({ name: s.name, username: res.username, url: staffInviteUrl(res.site, res.token), expiresAt: res.expiresAt, reset: s.hasLogin });
      setLinking(null);
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = (s: StaffMember) =>
    showAlert({
      title: `Remove ${s.name}?`,
      message: "Their staff login stops working straight away and they lose all access.",
      kind: "warning",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const before = staff;
            setStaff((d) => d?.filter((x) => x.id !== s.id) ?? d);
            try {
              await api.removeStaff(s.id);
              toast.success(`${s.name} no longer has access.`);
            } catch (e) {
              setStaff(before);
              toast.error(errorMessage(e));
            }
          },
        },
      ],
    });

  const admins = staff?.filter((s) => s.isAdmin) ?? [];
  const approvers = staff?.filter((s) => !s.isAdmin) ?? [];

  const renderMember = (s: StaffMember, i: number) => {
    const isEditing = editing?.id === s.id;
    const isLinking = linking?.id === s.id;
    const me = s.id === user?.id;
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
              {me ? " (you)" : ""}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {s.username ? `@${s.username}` : "No username yet"}
            </Text>
            <View style={styles.chips}>
              <RoleChips admin={s.isAdmin} roles={s.staffRoles} />
              {!s.hasLogin && (
                <View style={[styles.chip, { backgroundColor: `${colors.gold}22` }]}>
                  <Text style={[styles.chipText, { color: colors.gold }]}>{s.inviteExpiresAt ? "Link sent, not used yet" : "No password yet"}</Text>
                </View>
              )}
              {s.hasLogin && !!s.inviteExpiresAt && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>Reset link sent</Text>
                </View>
              )}
              {s.locked && (
                <View style={[styles.chip, { backgroundColor: `${colors.danger}1A` }]}>
                  <Text style={[styles.chipText, { color: colors.danger }]}>Locked</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {!me && !isEditing && !isLinking && (
          <View style={styles.memberActions}>
            <Tap style={styles.smallButton} onPress={() => (setLinking(null), setEditing({ id: s.id, admin: s.isAdmin, roles: s.staffRoles }))} scaleTo={0.94}>
              <Text style={styles.smallButtonText}>Access</Text>
            </Tap>
            <Tap style={styles.smallButton} onPress={() => (setEditing(null), setLinking({ id: s.id, username: "" }))} scaleTo={0.94}>
              <Link2 size={14} color={colors.text} />
              <Text style={styles.smallButtonText}>{s.hasLogin ? "Password reset link" : "New sign-in link"}</Text>
            </Tap>
            <Tap style={styles.remove} onPress={() => remove(s)} scaleTo={0.92} accessibilityLabel={`Remove ${s.name}`}>
              <Text style={styles.removeText}>Remove</Text>
            </Tap>
          </View>
        )}
        {isEditing && (
          <View style={{ gap: spacing.sm }}>
            <AccessPicker admin={editing.admin} roles={editing.roles} onChange={(admin, roles) => setEditing({ ...editing, admin, roles })} />
            <View style={styles.editActions}>
              <Tap style={[styles.smallButton, { height: 40 }]} onPress={() => setEditing(null)} scaleTo={0.96}>
                <Text style={styles.smallButtonText}>Cancel</Text>
              </Tap>
              <Tap style={styles.saveButton} onPress={saveEdit} disabled={saving} scaleTo={0.96}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
              </Tap>
            </View>
          </View>
        )}
        {isLinking && (
          <View style={{ gap: spacing.sm }}>
            {!s.username && (
              <View style={styles.inputRow}>
                <AtSign size={17} color={colors.textMuted} />
                <TextInput style={styles.input} value={linking.username} onChangeText={(t) => setLinking({ ...linking, username: t })} placeholder="choose a username" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Username" maxLength={30} />
              </View>
            )}
            <Text style={styles.meta}>
              {s.hasLogin ? "They choose a new password with it. Their current password keeps working until then." : "They choose their password with it."} Any older link for them stops working.
            </Text>
            <View style={styles.editActions}>
              <Tap style={[styles.smallButton, { height: 40 }]} onPress={() => setLinking(null)} scaleTo={0.96}>
                <Text style={styles.smallButtonText}>Cancel</Text>
              </Tap>
              <Tap style={styles.saveButton} onPress={() => makeLink(s)} disabled={saving} scaleTo={0.96}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Make link</Text>}
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
        {link && (
          <View style={styles.createdCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <CheckCircle2 size={18} color={colors.success} />
              <Text style={styles.cardTitle}>{link.reset ? `Reset link for ${link.name}` : `Sign-in link for ${link.name}`}</Text>
            </View>
            <Text style={styles.cardText}>
              Send it to them privately (it's only shown now). It works once, until {new Date(link.expiresAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}. Their username is <Text style={{ fontWeight: fontWeight.bold, color: colors.text }}>{link.username}</Text>.
            </Text>
            <View style={styles.credRow}>
              <Text style={[styles.credValue, styles.mono, { fontSize: fontSize.sm }]} selectable numberOfLines={2}>
                {link.url}
              </Text>
            </View>
            <View style={styles.editActions}>
              <Tap style={[styles.smallButton, { height: 40 }]} onPress={() => copy(link.url)} scaleTo={0.96}>
                <Copy size={14} color={colors.text} />
                <Text style={styles.smallButtonText}>Copy link</Text>
              </Tap>
              <Tap style={styles.saveButton} onPress={() => setLink(null)} scaleTo={0.96}>
                <Text style={styles.buttonText}>Done</Text>
              </Tap>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add a staff login</Text>
          <Text style={styles.cardText}>You'll get a one-time link to send them. They open it, choose their password, and from then on sign in to the {newAdmin ? "admin site" : "staff portal"} with their username and password. It's separate from any marketplace account.</Text>
          <View style={styles.formRow}>
            <View style={{ flex: 1, minWidth: 180 }}>
              <Text style={styles.label}>Name</Text>
              <View style={styles.inputRow}>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Aisha Ibrahim" placeholderTextColor={colors.textMuted} maxLength={60} accessibilityLabel="Name" />
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 180 }}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputRow}>
                <AtSign size={17} color={colors.textMuted} />
                <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="aisha" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} maxLength={30} accessibilityLabel="Username" />
              </View>
            </View>
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
          <Tap style={[styles.button, (!ready || adding) && styles.buttonDisabled]} onPress={() => add()} disabled={adding} scaleTo={0.97}>
            {adding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <UserPlus size={18} color="#fff" />
                <Text style={styles.buttonText}>{newAdmin ? "Create admin and get link" : "Create approver and get link"}</Text>
              </>
            )}
          </Tap>
        </View>

        {!staff ? (
          <RowSkeleton count={3} />
        ) : (
          <>
            <Text style={styles.section}>Admins · {admins.length}</Text>
            {admins.map(renderMember)}
            <Text style={styles.section}>Approvers and support · {approvers.length}</Text>
            {approvers.length ? approvers.map(renderMember) : <Text style={styles.meta}>No approvers yet. Add one above.</Text>}
          </>
        )}
        {staff && staff.length === 0 && (
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
  memberActions: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  formRow: { flexDirection: "row", gap: spacing.sm + 4, flexWrap: "wrap" },
  mono: { fontFamily: Platform.OS === "web" ? "ui-monospace, SFMono-Regular, Menlo, monospace" : Platform.OS === "ios" ? "Menlo" : "monospace", letterSpacing: 0.5 },
  createdCard: { backgroundColor: `${colors.success}12`, borderRadius: radius.lg, padding: spacing.md + 4, gap: spacing.sm, borderWidth: 1.5, borderColor: `${colors.success}55` },
  credRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm + 2, borderRadius: radius.md, backgroundColor: colors.card },
  credLabel: { width: 80, fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semibold },
  credValue: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarText: { color: "#fff", fontSize: fontSize.md, fontWeight: fontWeight.bold },
  name: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.caption, color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  chip: { paddingHorizontal: 8, height: 22, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  chipText: { fontSize: fontSize.micro, fontWeight: fontWeight.bold, color: colors.primary },
  chipAdmin: { backgroundColor: colors.text },
  chipAdminText: { color: colors.background },
  smallButton: { flexDirection: "row", gap: 6, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
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
