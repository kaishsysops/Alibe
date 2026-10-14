import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, ActivityIndicator, Switch, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronRight, Phone, Sun, Moon, SunMoon } from "lucide-react-native";
import { api, Atoll, FullUser, PaymentMethod, errorMessage } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import Tap from "../components/Tap";
import { Skeleton, SkeletonGroup } from "../components/Skeleton";
import { WhatsAppIcon, ViberIcon } from "../components/BrandIcons";
import { AccentPicker } from "./OnboardingScreen";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, cardShadow, fontSize, fontWeight } from "../theme/theme";
import { useResponsive } from "../hooks/useResponsive";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { formatPhone } from "../utils/phone";

const AVATAR_COLORS = ["#FF6A00", "#1E7BE0", "#E0336E", "#16A34A", "#7347E6", "#E39A1F", "#00A3A3", "#8E5A3D"];
const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "CASH", label: "Cash on pickup" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Field({ label, children, helper }: { label: string; children: React.ReactNode; helper?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {!!helper && <Text style={styles.helper}>{helper}</Text>}
    </View>
  );
}

export default function EditProfileScreen() {
  const styles = useStyles();
  const { colors, accent, mode, setMode } = useTheme();
  const { user, updateUser } = useAuth();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { isDesktopWeb } = useResponsive();
  const [profile, setProfile] = useState<FullUser | null>(null);
  const [atolls, setAtolls] = useState<Atoll[]>([]);
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    bio: "",
    avatarColor: AVATAR_COLORS[0],
    islandId: undefined as string | undefined,
    paymentMethod: undefined as PaymentMethod | undefined,
    promoOptIn: true,
    showPhone: true,
    whatsappEnabled: false,
    whatsappNumber: "",
    viberEnabled: false,
    viberNumber: "",
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!user) return;
    api
      .myProfile(user.id)
      .then((p) => {
        setProfile(p);
        setForm({
          name: p.name,
          username: p.username ?? "",
          email: p.email ?? "",
          bio: p.bio ?? "",
          avatarColor: p.avatarColor ?? AVATAR_COLORS[0],
          islandId: p.islandId ?? undefined,
          paymentMethod: p.paymentMethod ?? undefined,
          promoOptIn: p.promoOptIn,
          showPhone: p.showPhone,
          whatsappEnabled: p.whatsappEnabled,
          whatsappNumber: p.whatsappNumber ?? "",
          viberEnabled: p.viberEnabled,
          viberNumber: p.viberNumber ?? "",
        });
      })
      .catch((e) => toast.error(errorMessage(e, "Couldn't load your profile.")));
    api.atolls().then(setAtolls).catch(() => {});
  }, [user, toast]);

  // The app colour applies the moment it's tapped and is saved in the
  // background (optimistic); a failure only costs cross-device sync.
  const firstAccent = useRef(accent);
  useEffect(() => {
    if (!user || accent === firstAccent.current) return;
    const t = setTimeout(() => {
      updateUser({ themeColor: accent });
      api.updateProfile(user.id, { themeColor: accent }).catch(() => toast.error("Colour saved on this device only. We'll sync it later."));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent]);

  const [save, saving] = useSingleFlight(async () => {
    if (!user) return;
    if (form.name.trim().length < 2) return toast.error("Your name needs at least 2 characters.");
    try {
      const updated = await api.updateProfile(user.id, {
        name: form.name.trim(),
        username: form.username.trim() || null,
        email: form.email.trim() || null,
        bio: form.bio.trim() || null,
        avatarColor: form.avatarColor,
        islandId: form.islandId ?? null,
        paymentMethod: form.paymentMethod ?? null,
        promoOptIn: form.promoOptIn,
        showPhone: form.showPhone,
        whatsappEnabled: form.whatsappEnabled,
        whatsappNumber: form.whatsappNumber.trim() || null,
        viberEnabled: form.viberEnabled,
        viberNumber: form.viberNumber.trim() || null,
      });
      await updateUser(updated);
      toast.success("Profile saved.");
      navigation.goBack();
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't save your changes. Please try again."));
    }
  });

  const header = isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Edit profile" />;

  if (!profile) {
    return (
      <View style={styles.container}>
        {header}
        <SkeletonGroup>
          <View style={{ padding: spacing.md, gap: spacing.md, maxWidth: 600, width: "100%", alignSelf: "center" }}>
            {[120, 180, 220, 90].map((h, i) => (
              <Skeleton key={i} height={h} rounded={radius.lg} />
            ))}
          </View>
        </SkeletonGroup>
      </View>
    );
  }

  const contactRow = (
    enabled: boolean,
    onToggle: (v: boolean) => void,
    number: string,
    onNumber: (v: string) => void,
    name: string,
    icon: React.ReactNode
  ) => (
    <View style={styles.channel}>
      <View style={styles.switchRow}>
        <View style={styles.channelIcon}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>{name}</Text>
          <Text style={styles.switchHint}>{enabled ? `Buyers see a ${name} button on your listings.` : `Hidden from buyers.`}</Text>
        </View>
        <Switch value={enabled} onValueChange={onToggle} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" accessibilityLabel={`Enable ${name}`} />
      </View>
      {enabled && (
        <Field label={`${name} number`} helper={`Leave empty to use your account number, ${formatPhone(profile.phone)}.`}>
          <TextInput
            style={styles.input}
            value={number}
            onChangeText={onNumber}
            keyboardType="phone-pad"
            placeholder={formatPhone(profile.phone)}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={`${name} number`}
          />
        </Field>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Section title="App colour">
            <View style={{ padding: spacing.md }}>
              <AccentPicker />
            </View>
          </Section>

          <Section title="Light or dark">
            <View style={styles.modeRow}>
              {([
                { key: "system", label: "Automatic", Icon: SunMoon },
                { key: "light", label: "Light", Icon: Sun },
                { key: "dark", label: "Dark", Icon: Moon },
              ] as const).map(({ key, label, Icon }) => {
                const active = mode === key;
                return (
                  <Tap key={key} style={[styles.modeOption, active && styles.modeOptionActive]} onPress={() => setMode(key)} scaleTo={0.94} accessibilityState={{ selected: active }}>
                    <Icon size={22} color={active ? colors.primary : colors.textMuted} />
                    <Text style={[styles.modeLabel, active && { color: colors.primary }]}>{label}</Text>
                  </Tap>
                );
              })}
            </View>
          </Section>

          <Section title="Contact and messaging">
            <Tap style={styles.linkRow} onPress={() => navigation.navigate("ChangePhone")} scaleTo={0.98}>
              <View style={styles.channelIcon}>
                <Phone size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Phone number</Text>
                <Text style={styles.switchHint}>{formatPhone(user?.phone)}</Text>
              </View>
              <Text style={styles.linkText}>Change</Text>
              <ChevronRight size={16} color={colors.primary} />
            </Tap>
            <View style={styles.divider} />
            <View style={[styles.switchRow, { padding: spacing.md }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Show my number on listings</Text>
                <Text style={styles.switchHint}>Lets buyers call you directly.</Text>
              </View>
              <Switch value={form.showPhone} onValueChange={(v) => set({ showPhone: v })} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
            </View>
            <View style={styles.divider} />
            {contactRow(form.whatsappEnabled, (v) => set({ whatsappEnabled: v }), form.whatsappNumber, (v) => set({ whatsappNumber: v }), "WhatsApp", <WhatsAppIcon size={20} />)}
            <View style={styles.divider} />
            {contactRow(form.viberEnabled, (v) => set({ viberEnabled: v }), form.viberNumber, (v) => set({ viberNumber: v }), "Viber", <ViberIcon size={20} />)}
          </Section>

          <Section title="Public profile">
            <View style={styles.avatarRow}>
              <View style={[styles.avatarPreview, { backgroundColor: form.avatarColor }]}>
                <Text style={styles.avatarPreviewText}>{(form.name || "?").charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.colorRow}>
                {AVATAR_COLORS.map((c) => (
                  <Tap key={c} style={[styles.colorSwatch, { backgroundColor: c }]} onPress={() => set({ avatarColor: c })} scaleTo={0.85} accessibilityLabel="Avatar colour">
                    {form.avatarColor === c && <Check size={14} color="#fff" strokeWidth={3} />}
                  </Tap>
                ))}
              </View>
            </View>
            <Field label="Name">
              <TextInput style={styles.input} value={form.name} onChangeText={(t) => set({ name: t })} placeholder="Your name" placeholderTextColor={colors.textMuted} maxLength={40} />
            </Field>
            <Field label="Username" helper="Letters, numbers and underscores.">
              <TextInput
                style={styles.input}
                value={form.username}
                onChangeText={(t) => set({ username: t.replace(/[^a-zA-Z0-9_]/g, "") })}
                placeholder="ahmed_male"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                maxLength={24}
              />
            </Field>
            <Field label="Bio" helper={`${form.bio.length}/160`}>
              <TextInput style={[styles.input, styles.textArea]} value={form.bio} onChangeText={(t) => set({ bio: t })} placeholder="What do you usually sell?" placeholderTextColor={colors.textMuted} multiline maxLength={160} />
            </Field>
            <Field label="Email">
              <TextInput style={styles.input} value={form.email} onChangeText={(t) => set({ email: t })} placeholder="you@example.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" />
            </Field>
          </Section>

          <Section title="Selling preferences">
            <Field label="Default island">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {atolls.flatMap((a) => a.islands).map((i) => (
                  <Tap key={i.id} style={[styles.chip, form.islandId === i.id && styles.chipActive]} onPress={() => set({ islandId: i.id })} scaleTo={0.92}>
                    <Text style={[styles.chipText, form.islandId === i.id && styles.chipTextActive]}>{i.name}</Text>
                  </Tap>
                ))}
              </ScrollView>
            </Field>
            <Field label="Preferred payment">
              <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
                {PAYMENT_OPTIONS.map((opt) => (
                  <Tap key={opt.value} style={[styles.chip, form.paymentMethod === opt.value && styles.chipActive]} onPress={() => set({ paymentMethod: opt.value })} scaleTo={0.92}>
                    <Text style={[styles.chipText, form.paymentMethod === opt.value && styles.chipTextActive]}>{opt.label}</Text>
                  </Tap>
                ))}
              </View>
            </Field>
            <View style={[styles.switchRow, { padding: spacing.md }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Deals and promotions</Text>
                <Text style={styles.switchHint}>Occasional messages about offers near you.</Text>
              </View>
              <Switch value={form.promoOptIn} onValueChange={(v) => set({ promoOptIn: v })} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
            </View>
          </Section>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.xs }]}>
          <Tap style={styles.saveButton} onPress={() => save()} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save changes</Text>}
          </Tap>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingTop: 0, paddingBottom: spacing.xl, width: "100%", maxWidth: 600, alignSelf: "center" },
  modeRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  modeOption: { flex: 1, alignItems: "center", gap: 6, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border },
  modeOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  modeLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted },
  sectionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.sm, marginLeft: 2 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, ...cardShadow, overflow: "hidden" },
  field: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: 6 },
  helper: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 6 },
  input: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, backgroundColor: colors.background, outlineStyle: "none" as any },
  textArea: { height: 88, paddingTop: spacing.sm + 2, textAlignVertical: "top" },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  avatarPreview: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  avatarPreviewText: { color: "#fff", fontWeight: fontWeight.extrabold, fontSize: fontSize.xl },
  colorRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  colorSwatch: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  channel: { paddingBottom: spacing.md },
  channelIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  switchLabel: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  switchHint: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, padding: spacing.md },
  linkText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md },
  chip: { paddingHorizontal: spacing.md, height: 38, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  chipTextActive: { color: "#fff" },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm + 2, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.pill, height: 52, alignItems: "center", justifyContent: "center", width: "100%", maxWidth: 600, alignSelf: "center" },
  saveText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
}));
