import React, { createContext, useContext, useEffect, useRef } from "react";
import { Animated, DimensionValue, Easing, Platform, StyleProp, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { spacing, radius } from "../theme/theme";
import { useReducedMotion } from "../hooks/useReducedMotion";

// One shared pulse drives every skeleton block on screen so they shimmer in sync.
const PulseContext = createContext<Animated.Value | null>(null);

function usePulse() {
  const shared = useContext(PulseContext);
  const own = useRef(new Animated.Value(0)).current;
  const value = shared ?? own;
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (shared || reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(own, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(own, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shared, own, reduceMotion]);
  return value;
}

export function SkeletonGroup({ children }: { children: React.ReactNode }) {
  const pulse = usePulse();
  return <PulseContext.Provider value={pulse}>{children}</PulseContext.Provider>;
}

export function Skeleton({
  width = "100%",
  height = 14,
  rounded = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const pulse = usePulse();
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });
  return <Animated.View style={[{ width, height, borderRadius: rounded, backgroundColor: colors.skeleton, opacity }, style]} />;
}

export function ListingCardSkeleton({ width }: { width: number }) {
  return (
    <View style={{ width, marginBottom: spacing.lg }}>
      <Skeleton width={width} height={width} rounded={radius.md} />
      <Skeleton width="85%" height={13} style={{ marginTop: spacing.sm }} />
      <Skeleton width="45%" height={15} style={{ marginTop: 6 }} />
    </View>
  );
}

export function GridSkeleton({ columns, cardWidth, rows = 2, gap = spacing.md }: { columns: number; cardWidth: number; rows?: number; gap?: number }) {
  return (
    <SkeletonGroup>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
        {Array.from({ length: columns * rows }).map((_, i) => (
          <ListingCardSkeleton key={i} width={cardWidth} />
        ))}
      </View>
    </SkeletonGroup>
  );
}

export function RailSkeleton({ horizontalPadding = spacing.md, cardWidth = 168 }: { horizontalPadding?: number; cardWidth?: number }) {
  return (
    <SkeletonGroup>
      <View style={{ paddingHorizontal: horizontalPadding, marginBottom: spacing.md }}>
        <Skeleton width={140} height={18} style={{ marginBottom: spacing.sm }} />
        <View style={{ flexDirection: "row", gap: spacing.md, overflow: "hidden" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <ListingCardSkeleton key={i} width={cardWidth} />
          ))}
        </View>
      </View>
    </SkeletonGroup>
  );
}

export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <SkeletonGroup>
      <View style={{ gap: spacing.sm }}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm }}>
            <Skeleton width={56} height={56} rounded={radius.md} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="50%" height={14} />
              <Skeleton width="80%" height={12} />
              <Skeleton width="65%" height={12} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}
