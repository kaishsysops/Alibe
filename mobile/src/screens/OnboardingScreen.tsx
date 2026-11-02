import React, { useContext, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, ActivityIndicator, KeyboardAvoidingView, Keyboard, Platform, Animated, Easing, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { ShoppingBag, ArrowRight, Check, ShieldCheck, ChevronLeft, Mail, Phone, MapPin, Tag, MessageCircle, BadgePercent, KeyRound, PackageCheck, LucideIcon } from "lucide-react-native";
import { api, errorMessage, setAuthToken, SignedIn, User } from "../api/client";
import { useAuth } from "../api/AuthContext";
import { useToast } from "../components/Toast";
import Tap from "../components/Tap";
import CodeBoxes, { CODE_LENGTH } from "../components/CodeBoxes";
import { EntranceGate, FadeIn, Float, Pop, SuccessBurst, animateLayout, useShake } from "../components/Motion";
import { makeStyles, useTheme } from "../theme/ThemeContext";
import { ACCENTS, spacing, radius, fontSize, fontWeight, controlHeight } from "../theme/theme";
import { useSingleFlight } from "../hooks/useSingleFlight";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { formatPhone } from "../utils/phone";

const useNativeDriver = Platform.OS !== "web";

// Local 7-digit numbers get the Maldives country code; anything else is sent as typed.
export function toE164(input: string) {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return `+${digits}`;
  return digits.length === 7 ? `+960${digits}` : `+${digits}`;
}

export const isValidEmail = (input: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());

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

type Slide = { Icon: LucideIcon; left: LucideIcon; right: LucideIcon; title: string; text: string };

const SLIDES: Slide[] = [
  { Icon: ShoppingBag, left: MapPin, right: Tag, title: "Buy and sell across every atoll", text: "From Malé to Addu, all in one place." },
  { Icon: MessageCircle, left: BadgePercent, right: Tag, title: "Chat and agree a price", text: "Message sellers and send offers right here in the app." },
  { Icon: ShieldCheck, left: KeyRound, right: PackageCheck, title: "Stay safe when you buy", text: "A private code confirms your item reached you." },
];
const SLIDE_MS = 4200;

// One welcome slide. The main tile and its two small tiles move at different
// speeds as the slide passes, which gives the swipe its depth.
function SlideView({ slide, index, width, scrollX }: { slide: Slide; index: number; width: number; scrollX: Animated.Value }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
  const drift = (distance: number) => ({ translateX: scrollX.interpolate({ inputRange, outputRange: [distance, 0, -distance] }) });
  const scale = scrollX.interpolate({ inputRange, outputRange: [0.72, 1, 0.72], extrapolate: "clamp" });
  const opacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: "clamp" });
  const { Icon, left: Left, right: Right } = slide;
  return (
    <View style={[styles.slide, { width }]}>
      <Animated.View style={[styles.art, { opacity }]}>
        <Animated.View style={[styles.artSmall, { left: 0, top: 26, transform: [drift(width * 0.5), { rotate: "-10deg" }] }]}>
          <Left size={26} color={colors.primary} strokeWidth={2.2} />
        </Animated.View>
        <Animated.View style={[styles.artSmall, { right: 0, bottom: 22, transform: [drift(width * 0.32), { rotate: "9deg" }] }]}>
          <Right size={26} color={colors.primary} strokeWidth={2.2} />
        </Animated.View>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Float distance={7}>
            <View style={styles.artMain}>
              <Icon size={58} color={colors.primary} strokeWidth={2} />
            </View>
          </Float>
        </Animated.View>
      </Animated.View>
      <Animated.View style={{ opacity, alignItems: "center", transform: [drift(width * 0.18)] }}>
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideText}>{slide.text}</Text>
      </Animated.View>
    </View>
  );
}

// Slides itself along until the last slide, then stays put. Touching it hands
// over to the person. Dots work with a mouse on web, where you can't swipe.
function WelcomeCarousel({ active }: { active: boolean }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const entranceOpen = useContext(EntranceGate);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);
  const index = useRef(0);
  const [autoplay, setAutoplay] = useState(true);

  const goTo = (i: number) => {
    index.current = i;
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
  };

  useEffect(() => {
    if (!autoplay || !active || !entranceOpen || reduceMotion) return;
    const t = setInterval(() => {
      if (index.current >= SLIDES.length - 1) return clearInterval(t);
      goTo(index.current + 1);
    }, SLIDE_MS);
    return () => clearInterval(t);
  }, [autoplay, active, entranceOpen, reduceMotion, width]);

  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver })}
        onScrollBeginDrag={() => setAutoplay(false)}
        onMomentumScrollEnd={(e) => {
          index.current = Math.round(e.nativeEvent.contentOffset.x / width);
        }}
      >
        {SLIDES.map((slide, i) => (
          <SlideView key={slide.title} slide={slide} index={i} width={width} scrollX={scrollX} />
        ))}
      </Animated.ScrollView>
      <View style={styles.dots}>
        {SLIDES.map((slide, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          return (
            <Tap
              key={slide.title}
              hitSlop={10}
              scaleTo={0.8}
              accessibilityLabel={`Show slide ${i + 1} of ${SLIDES.length}`}
              onPress={() => {
                setAutoplay(false);
                goTo(i);
              }}
            >
              <Animated.View
                style={[
                  styles.dot,
                  {
                    opacity: scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: "clamp" }),
                    transform: [{ scaleX: scrollX.interpolate({ inputRange, outputRange: [1, 2.6, 1], extrapolate: "clamp" }) }],
                  },
                ]}
              />
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

// Phone / Email switch with a pill that springs between the two.
function MethodSwitch({ method, onChange }: { method: Method; onChange: (m: Method) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const pillWidth = Math.max(0, (trackWidth - 8) / 2);

  useEffect(() => {
    const toValue = method === "email" ? pillWidth : 0;
    if (reduceMotion) x.setValue(toValue);
    else Animated.spring(x, { toValue, friction: 8, tension: 110, useNativeDriver }).start();
  }, [method, pillWidth, reduceMotion]);

  return (
    <View style={styles.switchTrack} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
      {pillWidth > 0 && <Animated.View style={[styles.switchPill, { width: pillWidth, transform: [{ translateX: x }] }]} />}
      {(
        [
          { key: "phone", label: "Phone", Icon: Phone },
          { key: "email", label: "Email", Icon: Mail },
        ] as const
      ).map(({ key, label, Icon }) => {
        const active = method === key;
        return (
          <Tap key={key} style={styles.switchOption} scaleTo={0.96} onPress={() => onChange(key)} accessibilityRole="tab" accessibilityState={{ selected: active }}>
            <Icon size={17} color={active ? colors.primary : colors.textMuted} strokeWidth={2.4} />
            <Text style={[styles.switchText, active && { color: colors.primary }]}>{label}</Text>
          </Tap>
        );
      })}
    </View>
  );
}

type Method = "phone" | "email";
type Step = "welcome" | "enter" | "code" | "name" | "staff" | "done";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const haptic = (run: () => Promise<void>) => {
  if (Platform.OS !== "web") run().catch(() => {});
};

// Time for the last digit's pop to land before the screen moves on.
const DIGIT_SETTLE_MS = 420;
// Long enough for SuccessBurst's two ripples to finish and the words to be read.
const SUCCESS_MS = 1900;

export default function OnboardingScreen() {
  const styles = useStyles();
  const { colors, accent } = useTheme();
  const { signIn } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [step, setStep] = useState<Step>("welcome");
  const [method, setMethod] = useState<Method>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<{ destination: string; code: string }>();
  const [retryIn, setRetryIn] = useState(0);
  const [session, setSession] = useState<SignedIn>();
  const [name, setName] = useState("");
  const [greeting, setGreeting] = useState("");
  const [staffEntryCode, setStaffEntryCode] = useState("");
  const [staffUsername, setStaffUsername] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [focused, setFocused] = useState(false);
  const [shakeStyle, shake] = useShake();
  const entryRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const codeRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const nameRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const staffRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const sheet = useRef(new Animated.Value(0)).current;

  const isPhone = method === "phone";
  const destination = isPhone ? toE164(phone) : email.trim().toLowerCase();
  const entryValid = isPhone ? /^\+[0-9]{7,15}$/.test(destination) && phone.replace(/\D/g, "").length >= 7 : isValidEmail(email);
  const cardUp = step !== "welcome";

  const moveTo = (next: Step) => {
    animateLayout();
    setStep(next);
  };

  // The keyboard waits for the card to land, so it never yanks it mid-slide.
  useEffect(() => {
    const focusEntry = () => {
      if (cardUp) entryRef.current?.focus();
    };
    if (reduceMotion) {
      sheet.setValue(cardUp ? 1 : 0);
      return focusEntry();
    }
    Animated.spring(sheet, { toValue: cardUp ? 1 : 0, friction: 10, tension: 70, restSpeedThreshold: 0.02, restDisplacementThreshold: 0.005, useNativeDriver }).start(({ finished }) => {
      if (finished) focusEntry();
    });
  }, [cardUp, reduceMotion]);

  useEffect(() => {
    if (retryIn <= 0) return;
    const t = setTimeout(() => setRetryIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [retryIn]);

  const switchMethod = (next: Method) => {
    if (next === method) return;
    haptic(() => Haptics.selectionAsync());
    setMethod(next);
    // The new field mounts next frame; focusing it swaps the keyboard over.
    setTimeout(() => entryRef.current?.focus(), 30);
  };

  const [requestCode, requesting] = useSingleFlight(async () => {
    if (!entryValid) {
      toast.error(isPhone ? "Please enter a valid phone number." : "Please enter a valid email address.");
      return;
    }
    try {
      const res = isPhone ? await api.requestOtp(destination) : await api.requestEmailCode(destination);
      if ("staffEntry" in res && res.staffEntry) {
        setStaffEntryCode(destination);
        setPhone("");
        moveTo("staff");
        setTimeout(() => staffRef.current?.focus(), 300);
        return;
      }
      setRetryIn(res.retryIn);
      if (res.devCode) setDevCode({ destination, code: res.devCode });
      setCode("");
      if (step !== "code") moveTo("code");
      setTimeout(() => codeRef.current?.focus(), 300);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  // Plays the success moment to the end, and only then opens the app.
  const finish = async (user: User, token: string, firstName: string, isNew: boolean) => {
    Keyboard.dismiss();
    setGreeting(isNew ? `You're all set, ${firstName}!` : `Welcome back, ${firstName}!`);
    moveTo("done");
    haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    await wait(reduceMotion ? 600 : SUCCESS_MS);
    await signIn(user, token);
  };

  const [verify, verifying] = useSingleFlight(async (fullCode: string) => {
    const call = isPhone ? api.verifyOtp(destination, fullCode, accent) : api.verifyEmailCode(destination, fullCode, accent);
    const [result] = await Promise.allSettled([call, wait(DIGIT_SETTLE_MS)]);
    if (result.status === "rejected") {
      haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
      shake();
      toast.error(errorMessage(result.reason));
      // Empty the boxes once the shake has finished.
      await wait(340);
      setCode("");
      return;
    }
    const signedIn = result.value;
    if (signedIn.needsName) {
      // Signed in, but the app stays on this screen until they've got a name.
      setAuthToken(signedIn.token);
      setSession(signedIn);
      moveTo("name");
      setTimeout(() => nameRef.current?.focus(), 300);
      return;
    }
    await finish(signedIn.user, signedIn.token, signedIn.user.name.split(" ")[0], false);
  });

  const onCodeChange = (digits: string) => {
    setCode(digits);
    if (digits.length === CODE_LENGTH) verify(digits);
  };

  const trimmedName = name.trim();
  const [saveName, savingName] = useSingleFlight(async () => {
    if (!session) return;
    if (trimmedName.length < 2) {
      toast.error("Your name needs at least 2 characters.");
      return;
    }
    try {
      const updated = await api.updateProfile(session.user.id, { name: trimmedName });
      await finish(updated, session.token, trimmedName.split(" ")[0], true);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const staffReady = !!staffUsername.trim() && !!staffPassword;
  const [staffSignIn, signingInStaff] = useSingleFlight(async () => {
    if (!staffReady) return;
    try {
      const { user, token } = await api.staffSignIn(staffEntryCode, staffUsername, staffPassword);
      setStaffPassword("");
      await finish(user, token, user.name.split(" ")[0], false);
    } catch (e) {
      haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
      shake();
      toast.error(errorMessage(e));
    }
  });

  const back = () => {
    if (step === "staff") {
      setStaffPassword("");
      setStaffEntryCode("");
      moveTo("enter");
      setTimeout(() => entryRef.current?.focus(), 300);
    } else if (step === "code") {
      setCode("");
      moveTo("enter");
      setTimeout(() => entryRef.current?.focus(), 300);
    } else {
      // Close the keyboard first so the card slides down in one clean move.
      Keyboard.dismiss();
      setStep("welcome");
    }
  };

  const welcomeFade = sheet.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: "clamp" });
  const shownDestination = isPhone ? formatPhone(destination) : destination;

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <LinearGradient colors={["rgba(255,255,255,0.1)", "rgba(0,0,0,0.2)"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Drift size={width * 0.9} x={-width * 0.35} y={-width * 0.25} duration={5200} delay={0} />
      <Drift size={width * 0.55} x={width * 0.62} y={height * 0.22} duration={6400} delay={600} />
      <Drift size={width * 0.4} x={width * 0.05} y={height * 0.62} duration={5800} delay={1200} />

      <View style={[styles.brand, { paddingTop: insets.top + spacing.md }]}>
        <Pop from={0.5}>
          <View style={styles.logo}>
            <ShoppingBag size={24} color={colors.primary} strokeWidth={2.4} />
          </View>
        </Pop>
        <FadeIn delay={120} distance={6}>
          <Text style={styles.wordmark}>Alibe</Text>
        </FadeIn>
      </View>

      <Animated.View pointerEvents={cardUp ? "none" : "auto"} style={{ flex: 1, opacity: welcomeFade }}>
        <FadeIn delay={200} style={{ flex: 1 }}>
          <WelcomeCarousel active={!cardUp} />
        </FadeIn>
        <View style={[styles.welcomeBottom, { paddingBottom: insets.bottom + spacing.lg }]}>
          <FadeIn delay={420}>
            <Tap style={styles.startButton} onPress={() => setStep("enter")} scaleTo={0.96}>
              <Text style={[styles.startText, { color: colors.primary }]}>Get started</Text>
              <ArrowRight size={20} color={colors.primary} strokeWidth={2.6} />
            </Tap>
          </FadeIn>
        </View>
      </Animated.View>

      <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior={Platform.OS === "ios" ? "padding" : undefined} pointerEvents="box-none">
        <View style={{ flex: 1 }} pointerEvents="none" />
        <Animated.View
          pointerEvents={cardUp ? "auto" : "none"}
          style={[styles.card, { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [height * 0.8, 0] }) }] }]}
        >
          {(step === "enter" || step === "code" || step === "staff" || step === "welcome") && (
            <Tap style={styles.back} onPress={back} hitSlop={10} scaleTo={0.88} accessibilityLabel="Go back">
              <ChevronLeft size={22} color={colors.text} strokeWidth={2.4} />
            </Tap>
          )}

          {(step === "enter" || step === "welcome") && (
            <>
              <MethodSwitch method={method} onChange={switchMethod} />
              <FadeIn key={method} distance={6}>
                <Text style={styles.cardTitle}>{isPhone ? "What's your number?" : "What's your email?"}</Text>
                <Text style={styles.cardText}>{isPhone ? "We'll text you a code. No password needed." : "We'll email you a code. No password needed."}</Text>
              </FadeIn>
              <View style={[styles.field, focused && styles.fieldFocused]}>
                {isPhone ? (
                  <>
                    <Text style={styles.prefix}>+960</Text>
                    <View style={styles.fieldDivider} />
                  </>
                ) : (
                  <Mail size={20} color={colors.textMuted} style={{ marginRight: spacing.sm + 2 }} />
                )}
                <TextInput
                  key={method}
                  ref={entryRef}
                  style={styles.input}
                  value={isPhone ? phone : email}
                  onChangeText={isPhone ? setPhone : setEmail}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  keyboardType={isPhone ? "phone-pad" : "email-address"}
                  textContentType={isPhone ? "telephoneNumber" : "emailAddress"}
                  autoComplete={isPhone ? "tel" : "email"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={isPhone ? "777 1234" : "you@example.com"}
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={() => requestCode()}
                  accessibilityLabel={isPhone ? "Phone number" : "Email address"}
                  maxLength={isPhone ? 16 : 254}
                />
              </View>
              <Tap style={[styles.button, !entryValid && styles.buttonDisabled]} onPress={() => requestCode()} disabled={requesting} scaleTo={0.97}>
                {requesting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
              </Tap>
            </>
          )}

          {step === "staff" && (
            <FadeIn key="staff">
              <Text style={styles.cardTitle}>Staff sign in</Text>
              <Text style={styles.cardText}>For Alibe staff only.</Text>
              <Animated.View style={shakeStyle}>
                <View style={styles.field}>
                  <TextInput
                    ref={staffRef}
                    style={styles.input}
                    value={staffUsername}
                    onChangeText={setStaffUsername}
                    textContentType="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Username"
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel="Username"
                    maxLength={40}
                  />
                </View>
                <View style={[styles.field, { marginTop: spacing.sm + 4 }]}>
                  <TextInput
                    style={styles.input}
                    value={staffPassword}
                    onChangeText={setStaffPassword}
                    secureTextEntry
                    textContentType="password"
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Password"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    onSubmitEditing={() => staffSignIn()}
                    accessibilityLabel="Password"
                    maxLength={200}
                  />
                </View>
              </Animated.View>
              <Tap style={[styles.button, !staffReady && styles.buttonDisabled]} onPress={() => staffSignIn()} disabled={signingInStaff || !staffReady} scaleTo={0.97}>
                {signingInStaff ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
              </Tap>
            </FadeIn>
          )}

          {step === "code" && (
            <FadeIn key="code">
              <Text style={styles.cardTitle}>Enter your code</Text>
              <Text style={styles.cardText}>We sent 6 numbers to {shownDestination}.</Text>
              <CodeBoxes value={code} onChange={onCodeChange} inputRef={codeRef} animatedStyle={shakeStyle} />
              {devCode?.destination === destination && (
                <Tap style={styles.testCode} onPress={() => onCodeChange(devCode.code)} scaleTo={0.97} accessibilityLabel="Use the test code">
                  <Text style={styles.testCodeText}>Test mode: tap to use {devCode.code}</Text>
                </Tap>
              )}
              <Tap style={[styles.button, code.length < CODE_LENGTH && styles.buttonDisabled]} onPress={() => verify(code)} disabled={verifying || code.length < CODE_LENGTH} scaleTo={0.97}>
                {verifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
              </Tap>
              <Tap style={styles.resend} onPress={() => requestCode()} disabled={retryIn > 0 || requesting} hitSlop={8}>
                <Text style={[styles.resendText, retryIn <= 0 && { color: colors.primary }]}>{retryIn > 0 ? `Didn't get it? Send a new code in ${retryIn}s` : "Send a new code"}</Text>
              </Tap>
              {!isPhone && <Text style={styles.spamHint}>Can't find it? Check your spam folder.</Text>}
            </FadeIn>
          )}

          {step === "name" && (
            <FadeIn key="name">
              <Text style={[styles.cardTitle, styles.noBackTop]}>What's your name?</Text>
              <Text style={styles.cardText}>This is what buyers and sellers will see.</Text>
              <View style={[styles.field, focused && styles.fieldFocused]}>
                <TextInput
                  ref={nameRef}
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  textContentType="name"
                  autoComplete="name"
                  autoCapitalize="words"
                  placeholder="Your name"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={() => saveName()}
                  accessibilityLabel="Your name"
                  maxLength={40}
                />
              </View>
              <Tap style={[styles.button, trimmedName.length < 2 && styles.buttonDisabled]} onPress={() => saveName()} disabled={savingName} scaleTo={0.97}>
                {savingName ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
              </Tap>
            </FadeIn>
          )}

          {step === "done" && (
            <View style={styles.done} accessibilityLiveRegion="polite">
              <SuccessBurst color={colors.primary} size={84}>
                <Check size={42} color={colors.primary} strokeWidth={3} />
              </SuccessBurst>
              <FadeIn delay={220}>
                <Text style={styles.doneTitle}>{greeting}</Text>
              </FadeIn>
              <FadeIn delay={340}>
                <Text style={styles.doneText}>Opening Alibe...</Text>
              </FadeIn>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, overflow: "hidden" },
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm + 2, paddingBottom: spacing.sm },
  logo: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  wordmark: { fontSize: 30, fontWeight: fontWeight.extrabold, color: "#fff", letterSpacing: 0.5 },

  slide: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  art: { width: 250, height: 200, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  artMain: { width: 124, height: 124, borderRadius: 38, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  artSmall: { position: "absolute", width: 58, height: 58, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  slideTitle: { fontSize: fontSize.display, lineHeight: 34, fontWeight: fontWeight.extrabold, color: "#fff", textAlign: "center", maxWidth: 340 },
  slideText: { fontSize: fontSize.lg, lineHeight: fontSize.lg * 1.35, color: "rgba(255,255,255,0.92)", marginTop: spacing.sm, textAlign: "center", fontWeight: fontWeight.medium, maxWidth: 320 },
  dots: { flexDirection: "row", justifyContent: "center", gap: spacing.lg, paddingVertical: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },

  welcomeBottom: { paddingHorizontal: spacing.lg, width: "100%", maxWidth: 520, alignSelf: "center" },
  startButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 58, borderRadius: radius.pill, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  startText: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },

  card: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingTop: spacing.md, width: "100%", maxWidth: 520, alignSelf: "center" },
  back: { width: 40, height: 40, borderRadius: 20, marginLeft: -spacing.sm, marginBottom: spacing.xs, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: spacing.xs },
  noBackTop: { marginTop: spacing.md },
  cardText: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },

  switchTrack: { flexDirection: "row", height: 48, padding: 4, borderRadius: radius.pill, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  switchPill: { position: "absolute", left: 3, top: 3, bottom: 3, borderRadius: radius.pill, backgroundColor: colors.card, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  switchOption: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  switchText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textMuted },

  swatchRow: { flexDirection: "row", gap: spacing.sm + 2, flexWrap: "wrap" },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  swatchActive: { borderWidth: 3, borderColor: colors.card, shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  swatchName: { fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm },

  field: { flexDirection: "row", alignItems: "center", height: 58, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  fieldFocused: { borderColor: colors.primary },
  prefix: { fontSize: fontSize.lg, color: colors.text, fontWeight: fontWeight.bold },
  fieldDivider: { width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: spacing.sm + 4 },
  input: { flex: 1, height: "100%", fontSize: fontSize.lg, color: colors.text, outlineStyle: "none" as any },
  testCode: { alignSelf: "center", marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  testCodeText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  button: { height: controlHeight.primary, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.lg },
  resend: { alignItems: "center", paddingTop: spacing.md },
  resendText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted },
  spamHint: { fontSize: fontSize.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },

  done: { alignItems: "center", paddingTop: spacing.xl + spacing.md, paddingBottom: spacing.lg },
  doneTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: spacing.xl, textAlign: "center" },
  doneText: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.xs, textAlign: "center" },
}));
