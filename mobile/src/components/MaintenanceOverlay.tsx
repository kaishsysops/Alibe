import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { apiIsUp, onMaintenance } from "../api/client";
import { DEFAULT_ACCENT } from "../theme/theme";
import AlibeMark from "./AlibeMark";

// Covers the app while a deploy restarts the backend (the web server answers
// API calls with code MAINTENANCE). Checks every few seconds and gets out of
// the way by itself: on the web it reloads, so people land on the new version.
const BRAND = DEFAULT_ACCENT;
const CHECK_EVERY_MS = 4000;
const useNativeDriver = Platform.OS !== "web";

export default function MaintenanceOverlay() {
  const [visible, setVisible] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => onMaintenance(() => setVisible(true)), []);

  // Fade in, then keep the mark bobbing and the dots pulsing.
  useEffect(() => {
    if (!visible) return;
    Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver }).start();
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver }),
          Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        ])
      ),
      ...dots.map((d, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 180),
            Animated.timing(d, { toValue: 1, duration: 360, useNativeDriver }),
            Animated.timing(d, { toValue: 0.3, duration: 360, useNativeDriver }),
            Animated.delay((2 - i) * 180),
          ])
        )
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [visible, fade, bob, dots]);

  // Poll until the API answers again.
  useEffect(() => {
    if (!visible) return;
    let stopped = false;
    const timer = setInterval(async () => {
      if (stopped || !(await apiIsUp())) return;
      stopped = true;
      clearInterval(timer);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.reload();
        return;
      }
      Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver }).start(() => setVisible(false));
    }, CHECK_EVERY_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [visible, fade]);

  if (!visible) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, { opacity: fade }]} accessibilityLiveRegion="polite">
      <Animated.View style={[styles.tile, { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] }]}>
        <AlibeMark size={58} color={BRAND} />
      </Animated.View>
      <Text style={styles.title}>Alibe is updating</Text>
      <Text style={styles.text}>We're putting in something new. It takes about a minute, and the app comes back by itself.</Text>
      <View style={styles.dots}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: BRAND, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, zIndex: 2000 },
  tile: { width: 96, height: 96, borderRadius: 30, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 28, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: -0.4, textAlign: "center" },
  text: { color: "rgba(255,255,255,0.9)", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 10, maxWidth: 320 },
  dots: { flexDirection: "row", gap: 8, marginTop: 26 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
});
