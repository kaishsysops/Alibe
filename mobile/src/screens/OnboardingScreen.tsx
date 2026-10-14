import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Easing, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShoppingBag, ArrowRight, Check, ShieldCheck, ChevronLeft } from "lucide-react-native";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import Tap from "../components/Tap";
import { FadeIn, Pop } from "../components/Motion";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { ACCENTS, spacing, radius, fontSize, fontWeight } from "../theme/theme";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { useReducedMotion } from "../hooks/useReducedMotion";

const OTP_LENGTH = 4;
const useNativeDriver = Platform.OS !== "web";

// Local 7-digit numbers get the Maldives country code; anything else is sent as typed.
export function toE164(input: string) {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return `+${digits}`;
  return digits.length === 7 ? `+960${digits}` : `+${digits}`;
}

// Colour swatches (used in Edit Profile).
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

// Soft shapes drifting slowly behind the welcome screen.
function Drift({ size, x, y, duration, delay }: { size: number; x: number; y: number; duration: number; delay: number }) {
  const reduceMotion = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "rgba(255,255,255,0.1)",
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) },
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
        ],
      }}
    />
  );
}

type Step = "welcome" | "phone" | "otp";

export default function OnboardingScreen() {
  const styles = useStyles();
  const { colors, accent } = useTheme();
  const { signIn } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState<Step>("welcome");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const phoneInputRef = useRef<TextInput>(null);
  const otpInputRef = useRef<TextInput>(null);
  const sheet = useRef(new Animated.Value(0)).current;
  const fullPhone = toE164(phone);
  const phoneValid = /^\+[0-9]{7,15}$/.test(fullPhone) && phone.replace(/\D/g, "").length >= 7;

  // The white sign-in card slides up over the brand screen.
  useEffect(() => {
    Animated.spring(sheet, { toValue: step === "welcome" ? 0 : 1, friction: 9, tension: 60, useNativeDriver }).start();
    if (step === "phone") setTimeout(() => phoneInputRef.current?.focus(), 350);
  }, [step]);

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
      const { user, token } = await api.verifyOtp(fullPhone, fullCode, accent);
      await signIn(user, token);
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

  const back = () => {
    if (step === "otp") {
      setStep("phone");
      setCode("");
    } else setStep("welcome");
  };

  // Brand content lifts and fades a little as the card comes up.
  const heroShift = sheet.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.16] });
  const heroFade = sheet.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] });
  const welcomeFade = sheet.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: "clamp" });

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <Drift size={width * 0.9} x={-width * 0.35} y={-width * 0.25} duration={5200} delay={0} />
      <Drift size={width * 0.55} x={width * 0.62} y={height * 0.22} duration={6400} delay={600} />
      <Drift size={width * 0.4} x={width * 0.05} y={height * 0.62} duration={5800} delay={1200} />

      <Animated.View style={[styles.hero, { paddingTop: insets.top, opacity: heroFade, transform: [{ translateY: heroShift }] }]}>
        <Pop from={0.5}>
          <View style={styles.logo}>
            <ShoppingBag size={36} color={colors.primary} strokeWidth={2.4} />
          </View>
        </Pop>
        <FadeIn delay={150}>
          <Text style={styles.wordmark}>Alibe</Text>
        </FadeIn>
        <FadeIn delay={260}>
          <Text style={styles.headline}>Buy and sell across every atoll.</Text>
        </FadeIn>
      </Animated.View>

      <Animated.View pointerEvents={step === "welcome" ? "auto" : "none"} style={[styles.welcomeBottom, { paddingBottom: insets.bottom + spacing.lg, opacity: welcomeFade }]}>
        <FadeIn delay={420}>
          <Tap style={styles.startButton} onPress={() => setStep("phone")} scaleTo={0.96}>
            <Text style={[styles.startText, { color: colors.primary }]}>Get started</Text>
            <ArrowRight size={20} color={colors.primary} strokeWidth={2.6} />
          </Tap>
        </FadeIn>
        <FadeIn delay={520}>
          <View style={styles.trustLine}>
            <ShieldCheck size={15} color="rgba(255,255,255,0.85)" />
            <Text style={styles.trustText}>Scam protection built in</Text>
          </View>
        </FadeIn>
      </Animated.View>

      <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior={Platform.OS === "ios" ? "padding" : undefined} pointerEvents="box-none">
        <View style={{ flex: 1 }} pointerEvents="none" />
        <Animated.View
          pointerEvents={step === "welcome" ? "none" : "auto"}
          style={[styles.card, { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [height * 0.7, 0] }) }] }]}
        >
          <Tap style={styles.back} onPress={back} hitSlop={10} scaleTo={0.88} accessibilityLabel="Go back">
            <ChevronLeft size={22} color={colors.text} strokeWidth={2.4} />
          </Tap>

          {step !== "otp" ? (
            <>
              <Text style={styles.cardTitle}>What's your number?</Text>
              <Text style={styles.cardText}>We'll text you a code. No password needed.</Text>
              <View style={styles.phoneField}>
                <Text style={styles.phonePrefix}>+960</Text>
                <View style={styles.phoneDivider} />
                <TextInput
                  ref={phoneInputRef}
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
              <Tap style={[styles.button, !phoneValid && styles.buttonDisabled]} onPress={() => requestOtp()} disabled={requesting} scaleTo={0.97}>
                {requesting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
              </Tap>
            </>
          ) : (
            <FadeIn key="otp">
              <Text style={styles.cardTitle}>Enter your code</Text>
              <Text style={styles.cardText}>Sent to {fullPhone}. Test code: 1234.</Text>
              <Tap style={styles.otpRow} onPress={() => otpInputRef.current?.focus()} scaleTo={1}>
                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                  <View key={i} style={[styles.otpBox, i === code.length && styles.otpBoxActive, i < code.length && styles.otpBoxFilled]}>
                    {code[i] ? (
                      <Pop key={`${i}-${code[i]}`} from={0.5}>
                        <Text style={styles.otpBoxText}>{code[i]}</Text>
                      </Pop>
                    ) : null}
                  </View>
                ))}
              </Tap>
              <TextInput ref={otpInputRef} value={code} onChangeText={onCodeChange} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={OTP_LENGTH} style={styles.hiddenInput} />
              <Tap style={[styles.button, code.length < OTP_LENGTH && styles.buttonDisabled]} onPress={() => verify(code)} disabled={verifying || code.length < OTP_LENGTH} scaleTo={0.97}>
                {verifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
              </Tap>
            </FadeIn>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, overflow: "hidden" },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  logo: { width: 84, height: 84, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  wordmark: { fontSize: 44, fontWeight: fontWeight.extrabold, color: "#fff", marginTop: spacing.lg, letterSpacing: 0.5, textAlign: "center" },
  headline: { fontSize: fontSize.lg, color: "rgba(255,255,255,0.9)", marginTop: spacing.sm, textAlign: "center", fontWeight: fontWeight.medium },

  welcomeBottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg },
  startButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 58, borderRadius: radius.pill, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  startText: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  trustLine: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.md },
  trustText: { fontSize: fontSize.sm, color: "rgba(255,255,255,0.85)", fontWeight: fontWeight.semibold },

  card: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingTop: spacing.md, width: "100%", maxWidth: 520, alignSelf: "center" },
  back: { width: 40, height: 40, borderRadius: 20, marginLeft: -spacing.sm, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: spacing.xs },
  cardText: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },

  swatchRow: { flexDirection: "row", gap: spacing.sm + 2, flexWrap: "wrap" },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  swatchActive: { borderWidth: 3, borderColor: colors.card, shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  swatchName: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm },

  phoneField: { flexDirection: "row", alignItems: "center", height: 58, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  phonePrefix: { fontSize: fontSize.lg, color: colors.text, fontWeight: fontWeight.bold },
  phoneDivider: { width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: spacing.sm + 4 },
  phoneInput: { flex: 1, height: "100%", fontSize: fontSize.lg, color: colors.text, outlineStyle: "none" as any },
  otpRow: { flexDirection: "row", gap: spacing.sm + 4, justifyContent: "center" },
  otpBox: { flex: 1, maxWidth: 68, height: 68, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  otpBoxActive: { borderColor: colors.primary },
  otpBoxFilled: { backgroundColor: colors.primaryTint, borderColor: colors.primaryLight },
  otpBoxText: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0 },
  button: { height: 56, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.lg },
}));
