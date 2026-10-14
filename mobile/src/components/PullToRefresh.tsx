import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { makeStyles, useTheme } from "../theme/ThemeContext";

// Native RefreshControl still drives the pull gesture (so it feels right on
// both platforms), but its own spinner is made transparent and this branded
// "island drop" is drawn on top instead — synced to the same scroll offset.
//
// On iPhones with a Dynamic Island (or notch) the drop is pure black and
// starts hidden inside the cutout, so it looks like the island itself drips
// down, fills a ring as you pull, spins while loading, then gets sucked back up.
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

const PULL_DISTANCE = 80;
const DROP = 36;
const NECK_WIDTH = 22;
const RING_R = 11;
const RING_STROKE = 2.6;
const RING_C = 2 * Math.PI * RING_R;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function PullRefreshBadge({ scrollY, refreshing }: { scrollY: Animated.Value; refreshing: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Dynamic Island phones report a ~59-62pt top inset, notch phones ~44-50.
  const hasCutout = Platform.OS === "ios" && insets.top >= 44;
  const hasIsland = Platform.OS === "ios" && insets.top >= 51;
  const anchorY = hasIsland ? insets.top - 30 : hasCutout ? 14 : insets.top - DROP / 2;
  const restY = insets.top + 26;
  const travel = restY - anchorY;
  const dropColor = hasCutout ? "#000" : colors.primary;
  const ringColor = hasCutout ? colors.primary : "#fff";

  const hold = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    if (refreshing) {
      setHolding(true);
      hold.setValue(0.85);
      Animated.spring(hold, { toValue: 1, friction: 4, tension: 120, useNativeDriver: false }).start();
      spin.setValue(0);
      loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }));
      loop.start();
    } else if (holding) {
      // Retract back into the island.
      Animated.timing(hold, { toValue: 0, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: false }).start(() =>
        setHolding(false)
      );
    }
    return () => loop?.stop();
  }, [refreshing]);

  const pull = scrollY.interpolate({ inputRange: [-PULL_DISTANCE, 0], outputRange: [1, 0], extrapolate: "clamp" });
  const progress = holding ? hold : pull;

  const dropY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });
  const dropScale = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.55, 0.8, 1], extrapolate: "clamp" });
  // A little liquid stretch mid-pull that settles once the drop "lets go".
  const dropStretch = progress.interpolate({ inputRange: [0, 0.55, 0.9, 1], outputRange: [1, 1.14, 1.04, 1], extrapolate: "clamp" });
  const layerOpacity = hasCutout
    ? 1
    : progress.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: "clamp" });

  // Neck connecting the island to the drop: thins out, then snaps off near the end.
  const neckScaleY = progress.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1], extrapolate: "clamp" });
  const neckY = progress.interpolate({ inputRange: [0, 1], outputRange: [-travel / 2, 0], extrapolate: "clamp" });
  const neckScaleX = progress.interpolate({ inputRange: [0, 0.5, 0.85, 1], outputRange: [1, 0.45, 0.2, 0.1], extrapolate: "clamp" });
  const neckOpacity = progress.interpolate({ inputRange: [0.8, 0.95], outputRange: [1, 0], extrapolate: "clamp" });

  const ringOffset = pull.interpolate({ inputRange: [0.15, 1], outputRange: [RING_C, 0], extrapolate: "clamp" });
  const ringOpacity = progress.interpolate({ inputRange: [0.1, 0.35], outputRange: [0, 1], extrapolate: "clamp" });
  const spinRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const size = DROP;
  const center = size / 2;

  return (
    <Animated.View pointerEvents="none" style={[styles.layer, { opacity: layerOpacity }]}>
      {hasCutout && (
        <Animated.View
          style={[
            styles.neck,
            {
              top: anchorY,
              height: travel,
              backgroundColor: dropColor,
              opacity: neckOpacity,
              transform: [{ translateY: neckY }, { scaleY: neckScaleY }, { scaleX: neckScaleX }],
            },
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.drop,
          {
            top: anchorY - size / 2,
            backgroundColor: dropColor,
            transform: [{ translateY: dropY }, { scale: dropScale }, { scaleY: dropStretch }],
          },
        ]}
      >
        {/* Fade (JS-driven) and spin (native-driven) live on separate views:
            one view can't mix the two drivers. */}
        <Animated.View style={{ opacity: ringOpacity }}>
        <Animated.View style={{ transform: [{ rotate: holding ? spinRotate : "-90deg" }] }}>
          <Svg width={size} height={size}>
            <Circle cx={center} cy={center} r={RING_R} stroke={ringColor} strokeOpacity={0.22} strokeWidth={RING_STROKE} fill="none" />
            {holding ? (
              <Circle
                cx={center}
                cy={center}
                r={RING_R}
                stroke={ringColor}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${RING_C * 0.3} ${RING_C}`}
                fill="none"
              />
            ) : (
              <AnimatedCircle
                cx={center}
                cy={center}
                r={RING_R}
                stroke={ringColor}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${RING_C} ${RING_C}`}
                strokeDashoffset={ringOffset}
                fill="none"
              />
            )}
          </Svg>
        </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles(() => ({
  layer: { position: "absolute", top: 0, left: 0, right: 0, height: 160, alignItems: "center", zIndex: 10 },
  neck: { position: "absolute", left: "50%", marginLeft: -NECK_WIDTH / 2, width: NECK_WIDTH, borderRadius: NECK_WIDTH / 2 },
  drop: {
    position: "absolute",
    left: "50%",
    marginLeft: -DROP / 2,
    width: DROP,
    height: DROP,
    borderRadius: DROP / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
}));
