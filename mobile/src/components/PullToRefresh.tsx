import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { RefreshCw } from "lucide-react-native";
import { spacing } from "../theme/theme";
import { makeStyles } from "../theme/ThemeContext";

// Native RefreshControl still drives the pull gesture (so it feels right on
// both platforms), but its own spinner is made transparent and this branded
// badge is drawn on top instead — synced to the same scroll offset.
export const invisibleRefreshProps = {
  tintColor: "transparent",
  colors: ["transparent"],
  progressBackgroundColor: "transparent",
};

export function usePullRefresh() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false });
  return { scrollY, onScroll };
}

export default function PullRefreshBadge({ scrollY, refreshing }: { scrollY: Animated.Value; refreshing: boolean }) {
  const styles = useStyles();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    if (refreshing) {
      spin.setValue(0);
      loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 750, easing: Easing.linear, useNativeDriver: true }));
      loop.start();
    } else {
      spin.stopAnimation();
      spin.setValue(0);
    }
    return () => loop?.stop();
  }, [refreshing]);

  const dragRotate = scrollY.interpolate({ inputRange: [-90, 0], outputRange: ["270deg", "0deg"], extrapolate: "clamp" });
  const spinRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const scale = scrollY.interpolate({ inputRange: [-70, -20, 0], outputRange: [1, 0.75, 0.4], extrapolate: "clamp" });
  const pullOpacity = scrollY.interpolate({ inputRange: [-40, -6, 0], outputRange: [1, 0.6, 0], extrapolate: "clamp" });

  return (
    <Animated.View pointerEvents="none" style={[styles.layer, { opacity: refreshing ? 1 : pullOpacity }]}>
      <Animated.View
        style={[styles.badge, { transform: [{ scale: refreshing ? 1 : scale }, { rotate: refreshing ? spinRotate : dragRotate }] }]}
      >
        <RefreshCw size={16} color="#fff" strokeWidth={2.4} />
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  layer: { position: "absolute", top: spacing.sm, left: 0, right: 0, alignItems: "center", zIndex: 10 },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
}));
