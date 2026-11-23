import React, { useRef, useState } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { Eye, EyeOff, Lock, User as UserIcon } from "lucide-react-native";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import AlibeMark from "../components/AlibeMark";
import Tap from "../components/Tap";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, controlHeight, cardShadow } from "../theme/theme";
import { SITE } from "../site";

// Sign-in for admin.alibe.online and portal.alibe.online: the username and
// password an admin created for you. Marketplace accounts (email, Google)
// don't work here.
export default function StaffSignIn() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const ready = username.trim().length > 0 && password.length > 0;

  const [submit, busy] = useSingleFlight(async () => {
    if (!ready) return;
    try {
      const res = await api.staffSignIn(username.trim().toLowerCase(), password);
      setPassword("");
      await signIn(res.user, res.token);
    } catch (e) {
      setPassword("");
      toast.error(errorMessage(e));
    }
  });

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.brand}>
          <AlibeMark size={34} color={colors.primary} />
          <Text style={styles.brandText}>Alibe</Text>
          <View style={[styles.pill, SITE === "admin" && { backgroundColor: colors.text }]}>
            <Text style={[styles.pillText, SITE === "admin" && { color: colors.background }]}>{SITE === "admin" ? "Admin" : "Staff portal"}</Text>
          </View>
        </View>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.lead}>Use the username and password your admin gave you.</Text>

        <Text style={styles.label}>Username</Text>
        <View style={styles.field}>
          <UserIcon size={18} color={colors.textMuted} />
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            accessibilityLabel="Username"
            maxLength={40}
            autoFocus
          />
        </View>

        <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
        <View style={styles.field}>
          <Lock size={18} color={colors.textMuted} />
          <TextInput
            ref={passwordRef}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => submit()}
            accessibilityLabel="Password"
            maxLength={200}
          />
          <Tap onPress={() => setShow((v) => !v)} hitSlop={10} scaleTo={0.9} accessibilityLabel={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
          </Tap>
        </View>

        <Tap style={[styles.button, !ready && { opacity: 0.5 }]} onPress={() => submit()} disabled={busy || !ready} scaleTo={0.97}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Tap>
        <Text style={styles.help}>Forgot your password? Ask an admin to set a new one. After 5 wrong tries the login locks for 15 minutes.</Text>
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
  field: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: controlHeight.input, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  input: { flex: 1, height: "100%", fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  button: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
  help: { fontSize: fontSize.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.md, lineHeight: 17 },
}));
