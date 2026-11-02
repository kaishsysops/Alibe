import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import Tap from "../components/Tap";
import CodeBoxes, { CODE_LENGTH } from "../components/CodeBoxes";
import { useShake } from "../components/Motion";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow, controlHeight, contentWidth } from "../theme/theme";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { useResponsive } from "../hooks/useResponsive";
import { formatPhone } from "../utils/phone";
import { isValidEmail, toE164 } from "./OnboardingScreen";

// Adds or changes the phone number or email used to sign in. Either one opens
// the same account, so people can move between them without losing anything.
function ChangeContact({ kind }: { kind: "phone" | "email" }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { user, updateUser } = useAuth();
  const { isDesktopWeb } = useResponsive();
  const [step, setStep] = useState<"enter" | "code">("enter");
  const [entry, setEntry] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const [retryIn, setRetryIn] = useState(0);
  const [shakeStyle, shake] = useShake();
  const codeRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const isPhone = kind === "phone";
  const current = isPhone ? formatPhone(user?.phone) : user?.email;
  const noun = isPhone ? "phone number" : "email";
  const value = isPhone ? toE164(entry) : entry.trim().toLowerCase();
  const valid = isPhone ? entry.replace(/\D/g, "").length >= 7 : isValidEmail(entry);
  const shown = isPhone ? formatPhone(value) : value;

  useEffect(() => {
    if (retryIn <= 0) return;
    const t = setTimeout(() => setRetryIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [retryIn]);

  const [requestCode, requesting] = useSingleFlight(async () => {
    if (!user) return;
    if (!valid) return toast.error(isPhone ? "Please enter a valid phone number." : "Please enter a valid email address.");
    try {
      const res = isPhone ? await api.requestPhoneChange(user.id, value) : await api.requestEmailChange(user.id, value);
      setRetryIn(res.retryIn);
      if (res.devCode) setDevCode(res.devCode);
      setCode("");
      setStep("code");
      setTimeout(() => codeRef.current?.focus(), 300);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const [verify, verifying] = useSingleFlight(async (c: string) => {
    if (!user) return;
    try {
      if (isPhone) await updateUser({ phone: (await api.verifyPhoneChange(user.id, value, c)).phone });
      else await updateUser({ email: (await api.verifyEmailChange(user.id, value, c)).email });
      toast.success(`Saved. You can now sign in with ${shown}.`);
      navigation.goBack();
    } catch (e) {
      shake();
      setTimeout(() => setCode(""), 340);
      toast.error(errorMessage(e));
    }
  });

  const onCode = (digits: string) => {
    setCode(digits);
    if (digits.length === CODE_LENGTH) verify(digits);
  };

  const title = `${current ? "Change" : "Add"} ${noun}`;
  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title={title} />}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {!!current && (
              <>
                <Text style={styles.current}>Current {noun}</Text>
                <Text style={styles.currentValue}>{current}</Text>
              </>
            )}

            {step === "enter" ? (
              <>
                <Text style={styles.label}>{current ? `New ${noun}` : `Your ${noun}`}</Text>
                <View style={styles.field}>
                  {isPhone && (
                    <>
                      <Text style={styles.prefix}>+960</Text>
                      <View style={styles.divider} />
                    </>
                  )}
                  <TextInput
                    style={styles.input}
                    value={entry}
                    onChangeText={setEntry}
                    keyboardType={isPhone ? "phone-pad" : "email-address"}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={isPhone ? "777 1234" : "you@example.com"}
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                    onSubmitEditing={() => requestCode()}
                    accessibilityLabel={title}
                  />
                </View>
                <Text style={styles.hint}>We'll send a code to confirm it's yours. Your listings and chats stay the same.</Text>
                <Tap style={[styles.button, !valid && styles.buttonDisabled]} onPress={() => requestCode()} disabled={requesting}>
                  {requesting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
                </Tap>
              </>
            ) : (
              <>
                <Text style={styles.label}>Code sent to {shown}</Text>
                <CodeBoxes value={code} onChange={onCode} inputRef={codeRef} animatedStyle={shakeStyle} />
                {!!devCode && <Text style={styles.hint}>Test mode: your code is {devCode}.</Text>}
                {verifying && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />}
                <Tap style={styles.link} onPress={() => requestCode()} disabled={retryIn > 0 || requesting}>
                  <Text style={styles.linkText}>{retryIn > 0 ? `Send a new code in ${retryIn}s` : "Send a new code"}</Text>
                </Tap>
                <Tap style={styles.link} onPress={() => setStep("enter")}>
                  <Text style={styles.linkText}>Change the {noun}</Text>
                </Tap>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export const ChangePhoneScreen = () => <ChangeContact kind="phone" />;
export const ChangeEmailScreen = () => <ChangeContact kind="email" />;

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: contentWidth.form, alignSelf: "center" },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...cardShadow },
  current: { fontSize: fontSize.caption, color: colors.textMuted, marginBottom: 2 },
  currentValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.lg },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm },
  field: { flexDirection: "row", alignItems: "center", height: controlHeight.input, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  prefix: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  divider: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: spacing.sm + 2 },
  input: { flex: 1, height: "100%", fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  hint: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm, lineHeight: fontSize.caption * 1.45 },
  button: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.lg },
  link: { alignItems: "center", paddingTop: spacing.lg },
  linkText: { color: colors.textMuted, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
}));
