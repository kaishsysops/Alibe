import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { ShoppingBag } from "lucide-react-native";
import { DEFAULT_ACCENT, fontWeight } from "../theme/theme";
import { useReducedMotion } from "../hooks/useReducedMotion";

// Launch animation drawn over the app while it starts. Always the Alibe brand
// orange (not the user's accent) so it continues seamlessly from the native
// splash in app.json. It never adds waiting: it plays while sign-in state
// loads and leaves as soon as both are done (about a second at most).
const useNativeDriver = Platform.OS !== "web";
const BRAND = DEFAULT_ACCENT;
const WORD = "Alibe".split("");
const MIN_MS = 950;

export default function AnimatedSplash({ ready }: { ready: boolean }) {
  const reduceMotion = useReducedMotion();
  const [gone, setGone] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const logo = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const letters = useRef(WORD.map(() => new Animated.Value(0))).current;
  const exit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      logo.setValue(1);
      letters.forEach((l) => l.setValue(1));
      setIntroDone(true);
      return;
    }
    Animated.parallel([
      Animated.spring(logo, { toValue: 1, friction: 5, tension: 90, useNativeDriver }),
      Animated.timing(ring, { toValue: 1, duration: 900, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver }),
      Animated.stagger(
        55,
        letters.map((l) => Animated.timing(l, { toValue: 1, duration: 320, delay: 220, easing: Easing.out(Easing.back(1.6)), useNativeDriver }))
      ),
    ]).start();
    const t = setTimeout(() => setIntroDone(true), MIN_MS);
    return () => clearTimeout(t);
  }, [reduceMotion]);

  useEffect(() => {
    if (!ready || !introDone) return;
    Animated.timing(exit, { toValue: 1, duration: reduceMotion ? 150 : 380, easing: Easing.in(Easing.cubic), useNativeDriver }).start(() => setGone(true));
  }, [ready, introDone]);

  if (gone) return null;

  return (
    <Animated.View
      pointerEvents={ready && introDone ? "none" : "auto"}
      style={[StyleSheet.absoluteFill, styles.container, { opacity: exit.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }) }]}
    >
      <Animated.View style={{ alignItems: "center", transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }}>
        <View style={styles.logoWrap}>
          <Animated.View
            style={[
              styles.ring,
              { opacity: ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }] },
            ]}
          />
          <Animated.View
            style={[
              styles.logo,
              {
                opacity: logo.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
                transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }, { rotate: logo.interpolate({ inputRange: [0, 1], outputRange: ["-14deg", "0deg"] }) }],
              },
            ]}
          >
            <ShoppingBag size={40} color={BRAND} strokeWidth={2.4} />
          </Animated.View>
        </View>
        <View style={styles.word}>
          {WORD.map((ch, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.letter,
                { opacity: letters[i], transform: [{ translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] },
              ]}
            >
              {ch}
            </Animated.Text>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: BRAND, alignItems: "center", justifyContent: "center", zIndex: 1000 },
  logoWrap: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 96, height: 96, borderRadius: 30, borderWidth: 3, borderColor: "#fff" },
  logo: { width: 96, height: 96, borderRadius: 30, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  word: { flexDirection: "row", marginTop: 22 },
  letter: { fontSize: 40, fontWeight: fontWeight.extrabold, color: "#fff", letterSpacing: 0.5 },
});
