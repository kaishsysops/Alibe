import React, { useRef, useState } from "react";
import { View, Text, TextInput, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import ScreenHeader from "../components/ScreenHeader";
import WebNavBar from "../components/WebNavBar";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { spacing, radius, fontSize, fontWeight, cardShadow } from "../theme/theme";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { useResponsive } from "../hooks/useResponsive";
import { formatPhone } from "../utils/phone";
import { toE164 } from "./OnboardingScreen";

const OTP_LENGTH = 4;

export default function ChangePhoneScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { user, updateUser } = useAuth();
  const { isDesktopWeb } = useResponsive();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const otpRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const fullPhone = toE164(phone);
  const valid = phone.replace(/\D/g, "").length >= 7;

  const [requestCode, requesting] = useSingleFlight(async () => {
    if (!user) return;
    if (!valid) return toast.error("Please enter a valid phone number.");
    try {
      await api.requestPhoneChange(user.id, fullPhone);
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const [verify, verifying] = useSingleFlight(async (c: string) => {
    if (!user) return;
    try {
      const updated = await api.verifyPhoneChange(user.id, fullPhone, c);
      await updateUser({ phone: updated.phone });
      toast.success(`Your number is now ${formatPhone(updated.phone)}.`);
      navigation.goBack();
    } catch (e) {
      setCode("");
      toast.error(errorMessage(e));
    }
  });

  const onCode = (t: string) => {
    const digits = t.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setCode(digits);
    if (digits.length === OTP_LENGTH) verify(digits);
  };

  return (
    <View style={styles.container}>
      {isDesktopWeb ? <WebNavBar active="profile" /> : <ScreenHeader title="Change phone number" />}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.current}>Current number</Text>
            <Text style={styles.currentValue}>{formatPhone(user?.phone)}</Text>

            {step === "phone" ? (
              <>
                <Text style={styles.label}>New phone number</Text>
                <View style={styles.field}>
                  <Text style={styles.prefix}>+960</Text>
                  <View style={styles.divider} />
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="777 1234"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                    onSubmitEditing={() => requestCode()}
                    accessibilityLabel="New phone number"
                  />
                </View>
                <Text style={styles.hint}>We'll send a code to confirm it's yours. Your listings and chats stay the same.</Text>
                <Tap style={[styles.button, !valid && styles.buttonDisabled]} onPress={() => requestCode()} disabled={requesting}>
                  {requesting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
                </Tap>
              </>
            ) : (
              <>
                <Text style={styles.label}>Code sent to {formatPhone(fullPhone)}</Text>
                <Text style={styles.hint}>Demo mode: the code is always 1234.</Text>
                <Tap style={styles.otpRow} onPress={() => otpRef.current?.focus()} scaleTo={1}>
                  {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                    <View key={i} style={[styles.otpBox, i === code.length && { borderColor: colors.primary }]}>
                      <Text style={styles.otpText}>{code[i] ?? ""}</Text>
                    </View>
                  ))}
                </Tap>
                <TextInput ref={otpRef} value={code} onChangeText={onCode} keyboardType="number-pad" maxLength={OTP_LENGTH} style={styles.hidden} textContentType="oneTimeCode" />
                {verifying && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />}
                <Tap style={styles.link} onPress={() => setStep("phone")}>
                  <Text style={styles.linkText}>Change the number</Text>
                </Tap>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: 520, alignSelf: "center" },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...cardShadow },
  current: { fontSize: fontSize.caption, color: colors.textMuted },
  currentValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginTop: 2 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  field: { flexDirection: "row", alignItems: "center", height: 52, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, backgroundColor: colors.background },
  prefix: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  divider: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: spacing.sm + 2 },
  input: { flex: 1, height: "100%", fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  hint: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm, lineHeight: fontSize.caption * 1.45 },
  button: { height: 50, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
  otpRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  otpBox: { flex: 1, maxWidth: 60, height: 60, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  otpText: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  hidden: { position: "absolute", opacity: 0, width: 1, height: 1 },
  link: { alignItems: "center", paddingTop: spacing.lg },
  linkText: { color: colors.textMuted, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
}));
