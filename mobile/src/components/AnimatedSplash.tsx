import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import AlibeMark from "./AlibeMark";
import { DEFAULT_ACCENT, fontWeight } from "../theme/theme";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useTheme } from "../theme/ThemeContext";

// Launch animation drawn over the app while it starts, in the colour of
// whoever is signed in. The phone's own launch screen (app.json) can only be
// Alibe orange, so this starts in that orange and blends into the person's
// colour, with no jump. The intro always plays to its last frame, then holds
// for a beat; it leaves once that and the sign-in state are both done.
const useNativeDriver = Platform.OS !== "web";
const BRAND = DEFAULT_ACCENT;
const WORD = "Alibe".split("");
const HOLD_MS = 180;

export default function AnimatedSplash({ ready, onExit }: { ready: boolean; onExit: () => void }) {
  const reduceMotion = useReducedMotion();
  const [gone, setGone] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const logo = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const letters = useRef(WORD.map(() => new Animated.Value(0))).current;
  const exit = useRef(new Animated.Value(0)).current;
  const { accent } = useTheme();
  // 0 = the launch screen's orange, 1 = this person's colour. Colours can't use
  // the native driver, so this lives on its own layer.
  const tint = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(tint, { toValue: 1, duration: reduceMotion ? 0 : 260, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [accent]);
  const background = tint.interpolate({ inputRange: [0, 1], outputRange: [BRAND, accent] });

  useEffect(() => {
    let hold: ReturnType<typeof setTimeout>;
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
    ]).start(() => {
      hold = setTimeout(() => setIntroDone(true), HOLD_MS);
    });
    return () => clearTimeout(hold);
  }, [reduceMotion]);

  useEffect(() => {
    if (!ready || !introDone) return;
    onExit();
    Animated.timing(exit, { toValue: 1, duration: reduceMotion ? 150 : 380, easing: Easing.in(Easing.cubic), useNativeDriver }).start(() => setGone(true));
  }, [ready, introDone]);

  if (gone) return null;

  return (
    <Animated.View
      pointerEvents={ready && introDone ? "none" : "auto"}
      style={[StyleSheet.absoluteFill, styles.container, { opacity: exit.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }) }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: background }]} />
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
            <AlibeMark size={58} color={accent} />
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
  container: { alignItems: "center", justifyContent: "center", zIndex: 1000 },
  logoWrap: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 96, height: 96, borderRadius: 30, borderWidth: 3, borderColor: "#fff" },
  logo: { width: 96, height: 96, borderRadius: 30, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  word: { flexDirection: "row", marginTop: 22 },
  letter: { fontSize: 40, fontWeight: fontWeight.extrabold, color: "#fff", letterSpacing: 0.5 },
});
