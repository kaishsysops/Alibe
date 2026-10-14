import React, { useRef, useState } from "react";
import { View, Text, TextInput, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShoppingBag, ArrowRight, Check } from "lucide-react-native";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import Tap from "../components/Tap";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { ACCENTS, spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { useSingleFlight } from "../hooks/useSingleFlight";

const OTP_LENGTH = 4;

// Local 7-digit numbers get the Maldives country code; anything else is sent as typed.
export function toE164(input: string) {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return `+${digits}`;
  return digits.length === 7 ? `+960${digits}` : `+${digits}`;
}

export function AccentPicker() {
  const styles = useStyles();
  const { accent, setAccent } = useTheme();
  const selected = ACCENTS.find((a) => a.hex === accent);
  return (
    <View>
      <View style={styles.swatchRow}>
        {ACCENTS.map((a) => {
          const active = a.hex === accent;
          return (
            <Tap
              key={a.hex}
              style={[styles.swatch, { backgroundColor: a.hex }, active && styles.swatchActive]}
              onPress={() => setAccent(a.hex)}
              scaleTo={0.85}
              accessibilityLabel={`${a.name} colour`}
              accessibilityState={{ selected: active }}
            >
              {active && <Check size={18} color="#fff" strokeWidth={3} />}
            </Tap>
          );
        })}
      </View>
      <Text style={styles.swatchName}>{selected?.name ?? "Custom"}</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const styles = useStyles();
  const { colors, accent } = useTheme();
  const { signIn } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const otpInputRef = useRef<TextInput>(null);
  const fullPhone = toE164(phone);
  const phoneValid = /^\+[0-9]{7,15}$/.test(fullPhone) && phone.replace(/\D/g, "").length >= 7;

  const [requestOtp, requesting] = useSingleFlight(async () => {
    if (!phoneValid) {
      toast.error("Please enter a valid phone number.");
      return;
    }
    try {
      await api.requestOtp(fullPhone);
      setStep("otp");
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const [verify, verifying] = useSingleFlight(async (fullCode: string) => {
    try {
      const { user } = await api.verifyOtp(fullPhone, fullCode, accent);
      await signIn(user);
    } catch (e) {
      setCode("");
      toast.error(errorMessage(e));
    }
  });

  const onCodeChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "").slice(0, OTP_LENGTH);
    setCode(digits);
    if (digits.length === OTP_LENGTH) verify(digits);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.formWrap}>
            <View style={styles.logoBadge}>
              <ShoppingBag size={26} color="#fff" />
            </View>
            <Text style={styles.headline}>Buy and sell across every atoll.</Text>
            <Text style={styles.tagline}>Phones, furniture, bikes and homes from people near you.</Text>

            {step === "phone" ? (
              <>
                <Text style={styles.label}>Phone number</Text>
                <View style={styles.phoneField}>
                  <Text style={styles.phonePrefix}>+960</Text>
                  <View style={styles.phoneDivider} />
                  <TextInput
                    style={styles.phoneInput}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="777 1234"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    onSubmitEditing={() => requestOtp()}
                    accessibilityLabel="Phone number"
                    maxLength={16}
                  />
                </View>
                <Text style={styles.hint}>We'll text you a 4-digit code. No password needed.</Text>

                <Tap style={[styles.button, !phoneValid && styles.buttonDisabled]} onPress={() => requestOtp()} disabled={requesting}>
                  {requesting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Continue</Text>
                      <ArrowRight size={18} color="#fff" />
                    </>
                  )}
                </Tap>
              </>
            ) : (
              <>
                <Text style={styles.label}>Enter the code sent to {fullPhone}</Text>
                <Text style={styles.hint}>Demo mode: the code is always 1234.</Text>

                <Tap style={styles.otpRow} onPress={() => otpInputRef.current?.focus()} scaleTo={1}>
                  {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                    <View key={i} style={[styles.otpBox, i === code.length && styles.otpBoxActive, i < code.length && styles.otpBoxFilled]}>
                      <Text style={styles.otpBoxText}>{code[i] ?? ""}</Text>
                    </View>
                  ))}
                </Tap>
                <TextInput
                  ref={otpInputRef}
                  value={code}
                  onChangeText={onCodeChange}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={OTP_LENGTH}
                  style={styles.hiddenInput}
                />

                <Tap
                  style={[styles.button, code.length < OTP_LENGTH && styles.buttonDisabled]}
                  onPress={() => verify(code)}
                  disabled={verifying || code.length < OTP_LENGTH}
                >
                  {verifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify and continue</Text>}
                </Tap>
                <Tap
                  style={styles.linkButton}
                  onPress={() => {
                    setStep("phone");
                    setCode("");
                  }}
                >
                  <Text style={styles.linkText}>Use a different number</Text>
                </Tap>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  formWrap: { width: "100%", maxWidth: 420, alignSelf: "center" },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    alignSelf: "center",
  },
  headline: { fontSize: fontSize.display, fontWeight: fontWeight.extrabold, color: colors.text, lineHeight: fontSize.display * 1.15, letterSpacing: -0.5 },
  tagline: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.sm, lineHeight: fontSize.md * 1.4 },
  label: { fontSize: fontSize.sm, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.lg, fontWeight: fontWeight.semibold },
  hint: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm },
  swatchRow: { flexDirection: "row", gap: spacing.sm + 2, flexWrap: "wrap" },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  swatchActive: { borderWidth: 3, borderColor: colors.card, shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  swatchName: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm },
  phoneField: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    height: 54,
    paddingHorizontal: spacing.lg,
  },
  phonePrefix: { fontSize: fontSize.md, color: colors.text, fontWeight: fontWeight.semibold },
  phoneDivider: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: spacing.sm + 4 },
  phoneInput: { flex: 1, height: "100%", fontSize: fontSize.md, color: colors.text, outlineStyle: "none" as any },
  otpRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  otpBox: {
    flex: 1,
    maxWidth: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  otpBoxActive: { borderColor: colors.primary },
  otpBoxFilled: { backgroundColor: colors.primaryTint, borderColor: colors.primaryLight },
  otpBoxText: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  hiddenInput: { position: "absolute", opacity: 0, height: 1, width: 1 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md },
  linkButton: { alignItems: "center", padding: spacing.md },
  linkText: { color: colors.textMuted, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
}));
