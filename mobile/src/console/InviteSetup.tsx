import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { Eye, EyeOff, Lock, LinkIcon, Check } from "lucide-react-native";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import AlibeMark from "../components/AlibeMark";
import Tap from "../components/Tap";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, controlHeight, cardShadow } from "../theme/theme";
import { SITE } from "../site";

type Info = { name: string; username: string | null; site: "admin" | "portal"; expiresAt: string };

// Opened from a one-time sign-in link: the person chooses their password and
// is signed in. The link stops working once it's used.
export default function InviteSetup({ token, onDone }: { token: string; onDone: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const toast = useToast();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    api.staffInviteInfo(token).then(setInfo).catch((e) => setError(errorMessage(e)));
  }, [token]);

  const long = password.length >= 10;
  const match = long && password === again;

  const [submit, busy] = useSingleFlight(async () => {
    if (!long) return toast.error("Choose a password with at least 10 characters.");
    if (!match) return toast.error("The two passwords don't match.");
    try {
      const res = await api.acceptStaffInvite(token, password);
      await signIn(res.user, res.token);
      toast.success("You're in. Use your username and this password next time.");
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const wrongSite = info && info.site !== SITE;

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.brand}>
          <AlibeMark size={34} color={colors.primary} />
          <Text style={styles.brandText}>Alibe</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{SITE === "admin" ? "Admin" : "Staff portal"}</Text>
          </View>
        </View>

        {error ? (
          <>
            <View style={styles.badIcon}>
              <LinkIcon size={24} color={colors.danger} />
            </View>
            <Text style={styles.title}>Link not working</Text>
            <Text style={styles.lead}>{error}</Text>
            <Tap style={styles.button} onPress={onDone} scaleTo={0.97}>
              <Text style={styles.buttonText}>Go to sign in</Text>
            </Tap>
          </>
        ) : !info ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
        ) : (
          <>
            <Text style={styles.title}>Welcome, {info.name.split(" ")[0]}</Text>
            <Text style={styles.lead}>Choose a password to finish setting up your {info.site === "admin" ? "admin" : "staff"} login. This link works once.</Text>
            <View style={styles.userBox}>
              <Text style={styles.userLabel}>Your username</Text>
              <Text style={styles.userValue}>{info.username}</Text>
            </View>
            {wrongSite && <Text style={styles.warn}>This link is for the {info.site === "admin" ? "admin site" : "staff portal"}. You can set your password here and sign in there.</Text>}

            <Text style={styles.label}>New password</Text>
            <View style={styles.field}>
              <Lock size={18} color={colors.textMuted} />
              <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" accessibilityLabel="New password" maxLength={200} autoFocus />
              <Tap onPress={() => setShow((v) => !v)} hitSlop={10} scaleTo={0.9} accessibilityLabel={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
              </Tap>
            </View>
            <Text style={[styles.label, { marginTop: spacing.md }]}>Type it again</Text>
            <View style={styles.field}>
              <Lock size={18} color={colors.textMuted} />
              <TextInput style={styles.input} value={again} onChangeText={setAgain} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={() => submit()} accessibilityLabel="New password again" maxLength={200} />
            </View>
            <View style={styles.checks}>
              <Rule ok={long} text="At least 10 characters" />
              <Rule ok={match} text="Both match" />
            </View>
            <Tap style={[styles.button, !match && { opacity: 0.5 }]} onPress={() => submit()} disabled={busy} scaleTo={0.97}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Set password and sign in</Text>}
            </Tap>
          </>
        )}
      </View>
    </View>
  );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.rule}>
      <View style={[styles.ruleDot, ok && { backgroundColor: colors.success, borderColor: colors.success }]}>{ok && <Check size={10} color="#fff" strokeWidth={3.5} />}</View>
      <Text style={[styles.ruleText, ok && { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  page: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, backgroundColor: colors.background },
  card: { width: "100%", maxWidth: 420, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, ...cardShadow },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg },
  brandText: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  pillText: { fontSize: fontSize.micro, fontWeight: fontWeight.extrabold, color: colors.primary, textTransform: "uppercase", letterSpacing: 0.4 },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text },
  lead: { fontSize: fontSize.base, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg, lineHeight: 21 },
  badIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: `${colors.danger}14`, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  userBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.sm + 4, borderRadius: radius.md, backgroundColor: colors.primaryTint, marginBottom: spacing.md },
  userLabel: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semibold },
  userValue: { fontSize: fontSize.md, color: colors.primary, fontWeight: fontWeight.extrabold },
  warn: { fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 6 },
  field: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  input: { flex: 1, height: "100%", fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  checks: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm + 2, flexWrap: "wrap" },
  rule: { flexDirection: "row", alignItems: "center", gap: 6 },
  ruleDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  ruleText: { fontSize: fontSize.caption, color: colors.textMuted, fontWeight: fontWeight.semibold },
  button: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
}));
