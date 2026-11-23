import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ActivityIndicator, Platform } from "react-native";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import AlibeMark from "../components/AlibeMark";
import GoogleButton from "../components/GoogleButton";
import Tap from "../components/Tap";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, controlHeight, cardShadow } from "../theme/theme";
import { SITE } from "../site";

// Sign-in for admin.alibe.online and portal.alibe.online: the same Alibe
// account (emailed code or Google), but nothing here creates accounts. Access
// then depends on the person's admin flag or portal roles.
export default function StaffSignIn() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  useEffect(() => {
    api.authMethods().then((m) => setGoogleClientId(m.googleClientId ?? null)).catch(() => {});
  }, []);

  const [send, sending] = useSingleFlight(async () => {
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) return toast.error("Enter your work email address.");
    try {
      const res = await api.requestEmailCode(address);
      setSent(address);
      setDevCode("devCode" in res && res.devCode ? res.devCode : null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const [verify, verifying] = useSingleFlight(async () => {
    if (!sent || code.length < 6) return;
    try {
      const res = await api.verifyEmailCode(sent, code);
      if ("newContact" in res) return toast.error("No Alibe account uses this email. Ask an admin to add you as staff.");
      await signIn(res.user, res.token);
    } catch (e) {
      toast.error(errorMessage(e));
      setCode("");
    }
  });

  const [google, signingInWithGoogle] = useSingleFlight(async (credential: string) => {
    try {
      const res = await api.googleSignIn(credential);
      await signIn(res.user, res.token);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

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
        <Text style={styles.title}>{sent ? "Check your email" : "Sign in"}</Text>
        <Text style={styles.lead}>{sent ? `We sent a 6-digit code to ${sent}.` : SITE === "admin" ? "For Alibe admins." : "For Alibe staff with a portal role."}</Text>

        {!sent ? (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              onSubmitEditing={() => send()}
              accessibilityLabel="Email"
            />
            <Tap style={styles.button} onPress={() => send()} disabled={sending} scaleTo={0.97}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Email me a code</Text>}
            </Tap>
            {googleClientId && Platform.OS === "web" && (
              <>
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or</Text>
                  <View style={styles.orLine} />
                </View>
                {signingInWithGoogle ? <ActivityIndicator color={colors.primary} /> : <GoogleButton clientId={googleClientId} onCredential={(c) => google(c)} />}
              </>
            )}
          </>
        ) : (
          <>
            {devCode && <Text style={styles.devCode}>Code (development): {devCode}</Text>}
            <Text style={styles.label}>Code</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              onSubmitEditing={() => verify()}
              accessibilityLabel="Code"
              autoFocus
            />
            <Tap style={[styles.button, code.length < 6 && { opacity: 0.5 }]} onPress={() => verify()} disabled={verifying || code.length < 6} scaleTo={0.97}>
              {verifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
            </Tap>
            <Tap style={styles.link} onPress={() => (setSent(null), setCode(""))} scaleTo={0.97}>
              <Text style={styles.linkText}>Use a different email</Text>
            </Tap>
          </>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  page: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, backgroundColor: colors.background },
  card: { width: "100%", maxWidth: 400, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, ...cardShadow },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg },
  brandText: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  pillText: { fontSize: fontSize.micro, fontWeight: fontWeight.extrabold, color: colors.primary, textTransform: "uppercase", letterSpacing: 0.4 },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text },
  lead: { fontSize: fontSize.base, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, marginBottom: 6 },
  input: { height: controlHeight.input, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: fontSize.md, color: colors.text, backgroundColor: colors.background, outlineStyle: "none" as any },
  codeInput: { fontSize: 22, letterSpacing: 6, fontWeight: fontWeight.bold, textAlign: "center" },
  button: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
  orRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { fontSize: fontSize.sm, color: colors.textMuted },
  link: { alignItems: "center", paddingVertical: spacing.md },
  linkText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  devCode: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm },
}));
