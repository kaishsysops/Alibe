import React, { useRef } from "react";
import { Animated, Platform, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import { useReducedMotion } from "../hooks/useReducedMotion";

const useNativeDriver = Platform.OS !== "web";
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TapProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  // How far the element shrinks while pressed. Small chips/icons can use a
  // stronger effect; large cards a subtler one.
  scaleTo?: number;
  // A button drawn inside another pressable (e.g. the heart on a listing
  // card). On web a <button> can't contain a <button>, so this one renders
  // as a plain element instead.
  nested?: boolean;
  children?: React.ReactNode;
};

// The app's one pressable primitive: every tappable element springs down on
// press-in and back on release, so every tap gets visible feedback.
export default function Tap({ style, scaleTo = 0.96, nested, disabled, onPressIn, onPressOut, children, ...rest }: TapProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();

  const animate = (toScale: number, toOpacity: number) => {
    // Reduce Motion: keep the opacity dip as feedback, drop the scale spring.
    if (reduceMotion) toScale = 1;
    Animated.parallel([
      Animated.spring(scale, { toValue: toScale, useNativeDriver, speed: 40, bounciness: toScale === 1 ? 8 : 0 }),
      Animated.timing(opacity, { toValue: toOpacity, duration: 90, useNativeDriver }),
    ]).start();
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      accessibilityRole={rest.accessibilityRole ?? (nested && Platform.OS === "web" ? undefined : "button")}
      onPressIn={(e) => {
        animate(scaleTo, 0.85);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animate(1, 1);
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }], opacity }, Platform.OS === "web" && ({ cursor: disabled ? "default" : "pointer" } as any)]}
    >
      {children}
    </AnimatedPressable>
  );
}
