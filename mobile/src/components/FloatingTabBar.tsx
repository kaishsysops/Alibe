import React, { useEffect, useState } from "react";
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, ZoomIn } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Home, MessageCircle, Plus, Search, User } from "lucide-react-native";
import { useTheme } from "../theme/ThemeContext";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useKeyboardVisible } from "../hooks/useKeyboardVisible";

const ICONS: Record<string, typeof Home> = { HomeTab: Home, SearchTab: Search, SellTab: Plus, ChatsTab: MessageCircle, ProfileTab: User };

export const TAB_BAR_HEIGHT = 64;
const MARGIN = 20;
const BUBBLE = 48;
const SPRING = { damping: 18, stiffness: 220, mass: 0.9 };
// Frosted glass where blur is cheap; Android gets a solid bar.
const GLASS = Platform.OS !== "android";

const tick = (strong = false) => {
  if (Platform.OS === "web") return;
  if (strong) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  else Haptics.selectionAsync().catch(() => {});
};

function TabButton({
  routeName,
  label,
  focused,
  badge,
  onPress,
  onLongPress,
}: {
  routeName: string;
  label: string;
  focused: boolean;
  badge?: string | number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const Icon = ICONS[routeName] ?? Home;
  const isSell = routeName === "SellTab";
  const press = useSharedValue(1);
  const pop = useSharedValue(1);

  // A little bounce on the icon each time its tab becomes active.
  useEffect(() => {
    if (focused && !reduceMotion) pop.value = withSequence(withTiming(1.22, { duration: 110 }), withSpring(1, { damping: 9, stiffness: 260 }));
  }, [focused, reduceMotion]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value * pop.value }] }));

  return (
    <Pressable
      style={styles.slot}
      onPress={() => {
        tick(isSell);
        onPress();
      }}
      onLongPress={onLongPress}
      onPressIn={() => {
        press.value = withSpring(isSell ? 0.86 : 0.8, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, { damping: 10, stiffness: 300 });
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
      hitSlop={4}
    >
      <Animated.View style={iconStyle}>
        {isSell ? (
          <View style={[styles.sell, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
            <Icon size={24} color="#fff" strokeWidth={2.6} />
          </View>
        ) : (
          <Icon size={22} color={focused ? colors.primary : colors.textMuted} strokeWidth={focused ? 2.4 : 2} />
        )}
      </Animated.View>
      {badge !== undefined && (
        <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)} style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.card }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

// Floating glass tab bar with a highlight bubble that springs between tabs.
export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const keyboardOpen = useKeyboardVisible();
  const [width, setWidth] = useState(0);
  const slot = width / state.routes.length;
  const x = useSharedValue(0);
  const hidden = useSharedValue(0);

  useEffect(() => {
    if (!slot) return;
    const target = state.index * slot + (slot - BUBBLE) / 2;
    x.value = reduceMotion || x.value === 0 ? target : withSpring(target, SPRING);
  }, [state.index, slot, reduceMotion]);

  // Slide away while typing so the bar never covers the field in use.
  useEffect(() => {
    hidden.value = withTiming(keyboardOpen ? 1 : 0, { duration: 220 });
  }, [keyboardOpen]);

  const bubbleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const barStyle = useAnimatedStyle(() => ({
    opacity: 1 - hidden.value,
    transform: [{ translateY: hidden.value * (TAB_BAR_HEIGHT + 40) }],
  }));

  const dark = colors.scheme === "dark";
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <Animated.View
      pointerEvents={keyboardOpen ? "none" : "auto"}
      style={[styles.bar, { bottom: Math.max(insets.bottom - 10, 12), borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }, barStyle]}
    >
      {GLASS && <BlurView intensity={70} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card, opacity: GLASS ? 0.74 : 0.98 }]} />
      <View style={styles.row} onLayout={onLayout}>
        {width > 0 && <Animated.View style={[styles.bubble, { backgroundColor: colors.primary + (dark ? "40" : "1F") }, bubbleStyle]} />}
        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const focused = state.index === i;
          return (
            <TabButton
              key={route.key}
              routeName={route.name}
              label={(options.title as string) ?? route.name}
              focused={focused}
              badge={options.tabBarBadge}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: MARGIN,
    right: MARGIN,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      web: { boxShadow: "0 10px 30px rgba(20,20,30,0.16)" } as object,
      default: { shadowColor: "#14141E", shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
    }),
  },
  row: { flex: 1, flexDirection: "row", alignItems: "center" },
  bubble: { position: "absolute", left: 0, top: (TAB_BAR_HEIGHT - BUBBLE) / 2, width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2 },
  slot: { flex: 1, height: TAB_BAR_HEIGHT, alignItems: "center", justifyContent: "center" },
  sell: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  badge: {
    position: "absolute",
    top: 8,
    left: "52%",
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
