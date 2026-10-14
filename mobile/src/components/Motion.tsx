import React, { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, LayoutAnimation, Platform, StyleProp, UIManager, View, ViewStyle } from "react-native";
import { useReducedMotion } from "../hooks/useReducedMotion";

// Shared motion primitives. Every one of them collapses to "just show it"
// when the OS Reduce Motion setting is on.
const useNativeDriver = Platform.OS !== "web";

if (Platform.OS === "android") UIManager.setLayoutAnimationEnabledExperimental?.(true);

// Smoothly animates the next layout change (sections appearing, growing or
// collapsing). Call right before the state update that changes layout.
export function animateLayout() {
  if (Platform.OS === "web") return;
  LayoutAnimation.configureNext({
    duration: 260,
    create: { type: "easeInEaseOut", property: "opacity" },
    update: { type: "spring", springDamping: 0.85 },
    delete: { type: "easeInEaseOut", property: "opacity" },
  });
}

// Fades and rises content into place on mount. Stagger siblings with `delay`.
export function FadeIn({ delay = 0, distance = 14, style, children }: { delay?: number; distance?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return v.setValue(1);
    Animated.timing(v, { toValue: 1, duration: 380, delay, easing: Easing.out(Easing.cubic), useNativeDriver }).start();
  }, [reduceMotion]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// Springs content from small to full size on mount: checkmarks, digits, dots.
export function Pop({ delay = 0, from = 0.4, style, children }: { delay?: number; from?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return v.setValue(1);
    Animated.spring(v, { toValue: 1, delay, friction: 5, tension: 160, useNativeDriver }).start();
  }, [reduceMotion]);
  return (
    <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [from, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// Horizontal "no" shake for a wrong entry. Returns the style and a trigger.
export function useShake() {
  const reduceMotion = useReducedMotion();
  const x = useRef(new Animated.Value(0)).current;
  const shake = useCallback(() => {
    if (reduceMotion) return;
    x.setValue(0);
    Animated.sequence(
      [10, -10, 7, -7, 3, 0].map((toValue) => Animated.timing(x, { toValue, duration: 55, easing: Easing.linear, useNativeDriver }))
    ).start();
  }, [reduceMotion]);
  const style = { transform: [{ translateX: x }] };
  return [style, shake] as const;
}

// Gentle repeating nudge (e.g. a chevron pointing at the next step).
export function Nudge({ distance = 4, children }: { distance?: number; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver }),
        Animated.timing(v, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver }),
        Animated.delay(900),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion]);
  return <Animated.View style={{ transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, distance] }) }] }}>{children}</Animated.View>;
}

// Slow up-and-down hover for illustrations (empty states).
export function Float({ distance = 6, children }: { distance?: number; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(v, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion]);
  return <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] }) }] }}>{children}</Animated.View>;
}

// Plays a quick settle-in each time a tab screen gains focus.
export function FocusSettle({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const v = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (!focused) return;
    if (first.current || reduceMotion) {
      first.current = false;
      return;
    }
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver }).start();
  }, [focused, reduceMotion]);
  return (
    <Animated.View style={{ flex: 1, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

// Celebration for a finished delivery: the icon springs in while two rings
// ripple out behind it.
export function SuccessBurst({ color, size = 64, children }: { color: string; size?: number; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const pop = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    if (reduceMotion) return pop.setValue(1);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver }).start();
    Animated.stagger(
      260,
      rings.map((r) => Animated.timing(r, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver }))
    ).start();
  }, [reduceMotion]);
  const circle = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[circle, { alignItems: "center", justifyContent: "center" }]}>
      {rings.map((r, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            circle,
            {
              position: "absolute",
              borderWidth: 2,
              borderColor: color,
              opacity: r.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] }),
              transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
            },
          ]}
        />
      ))}
      <Animated.View style={[circle, { backgroundColor: `${color}1F`, alignItems: "center", justifyContent: "center", transform: [{ scale: pop }] }]}>{children}</Animated.View>
    </View>
  );
}

// A bar that fills left-to-right when `filled` turns true (progress steps).
export function FillLine({ filled, color, track, style }: { filled: boolean; color: string; track: string; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const v = useRef(new Animated.Value(filled ? 1 : 0)).current;
  const first = useRef(true);
  useEffect(() => {
    // Already-complete lines fill in on first render too, a beat after the dots.
    const target = filled ? 1 : 0;
    if (reduceMotion) return v.setValue(target);
    if (first.current) v.setValue(0);
    first.current = false;
    Animated.timing(v, { toValue: target, duration: 500, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver }).start();
  }, [filled, reduceMotion]);
  return (
    <View style={[style, { backgroundColor: track, overflow: "hidden" }]}>
      <Animated.View style={{ flex: 1, backgroundColor: color, transformOrigin: "left", transform: [{ scaleX: v }] } as any} />
    </View>
  );
}
