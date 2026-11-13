import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, View, GestureResponderEvent } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { MapPin } from "lucide-react-native";
import { ATOLL_GEO, AtollGeo, ISLAND_GEO } from "../data/maldives";
import { useTheme } from "../theme/ThemeContext";

// An illustrated, interactive map of the Maldives. Each atoll is a ring of tiny
// islets. Tap anywhere and the nearest atoll is chosen; or drag a finger along
// the chain to scrub through atolls (each lights up, with a haptic tick on
// phones) and let go to choose. The chosen atoll glows
// with a slow pulse, and a pin drops onto the chosen island.
// The country is ~8° tall and ~1.4° wide, so the map stretches east-west to
// stay readable on a phone. It's an illustration, not a chart.

const LAT_TOP = 7.35;
const LAT_BOTTOM = -0.95;
const LNG_LEFT = 72.5;
const LNG_RIGHT = 74.0;
const PAD = 10;
const MALE = { lat: 4.175, lng: 73.509 };
const RING_SCALE = 0.85;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Same islets every render for a given atoll (no flicker), but irregular.
function seeded(code: string) {
  let h = 2166136261;
  for (const c of code) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h >>> 0) % 10000) / 10000;
  };
}

type Props = {
  width: number;
  height: number;
  // Atoll codes that exist in the app (others aren't drawn).
  codes?: string[];
  selected?: string;
  pin?: { lat: number; lng: number } | null;
  onSelectAtoll?: (code: string) => void;
  // Small, non-interactive version (e.g. inside a form field).
  thumbnail?: boolean;
};

export default function MaldivesMap({ width, height, codes, selected, pin, onSelectAtoll, thumbnail }: Props) {
  const { colors, scheme } = useTheme();
  const dark = scheme === "dark";
  const project = useMemo(() => {
    const w = width - PAD * 2;
    const h = height - PAD * 2;
    return {
      x: (lng: number) => PAD + ((lng - LNG_LEFT) / (LNG_RIGHT - LNG_LEFT)) * w,
      y: (lat: number) => PAD + ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * h,
      sx: w / (LNG_RIGHT - LNG_LEFT),
      sy: h / (LAT_TOP - LAT_BOTTOM),
    };
  }, [width, height]);

  const atolls = useMemo(
    () =>
      Object.entries(ATOLL_GEO)
        .filter(([code]) => !codes || codes.includes(code))
        .map(([code, g]) => ({ code, g, ...ring(code, g) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codes?.join(","), project]
  );

  function ring(code: string, g: AtollGeo) {
    const cx = project.x(g.lng);
    const cy = project.y(g.lat);
    // Drawn a little smaller than life so neighbouring atolls never touch.
    const rx = Math.max(2.5, g.rx * project.sx * RING_SCALE);
    const ry = Math.max(2.5, g.ry * project.sy * RING_SCALE);
    const rand = seeded(code);
    const perimeter = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    const count = Math.max(1, Math.min(42, Math.round(perimeter / (thumbnail ? 9 : 6.5))));
    const islets = Array.from({ length: count }, (_, i) => {
      const t = (i / count) * Math.PI * 2 + rand() * 0.25;
      const wobble = 0.82 + rand() * 0.3;
      return { x: cx + Math.cos(t) * rx * wobble, y: cy + Math.sin(t) * ry * wobble, r: (thumbnail ? 0.8 : 1.1) + rand() * (thumbnail ? 0.8 : 1.4) };
    });
    return { cx, cy, rx, ry, islets: count === 1 ? [{ x: cx, y: cy, r: thumbnail ? 2 : 3.2 }] : islets };
  }

  // Slow pulse around the chosen atoll.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!selected || thumbnail) return;
    pulse.setValue(0);
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [selected, thumbnail, pulse]);

  // The pin drops in whenever it moves.
  const drop = useRef(new Animated.Value(1)).current;
  const pinKey = pin ? `${pin.lat},${pin.lng}` : "";
  useEffect(() => {
    if (!pin) return;
    drop.setValue(0);
    Animated.spring(drop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey]);

  // The nearest atoll (by drawn distance) to a point, so small atolls are as
  // easy to hit as big ones.
  const nearest = (x: number, y: number) => {
    let best: string | undefined;
    let bestD = Infinity;
    for (const a of atolls) {
      const d = Math.hypot((x - a.cx) / Math.max(a.rx, 14), (y - a.cy) / Math.max(a.ry, 14));
      if (d < bestD) {
        bestD = d;
        best = a.code;
      }
    }
    return best;
  };

  // Scrubbing: the atoll under the finger is highlighted while it moves, and
  // chosen when it lifts.
  const [hover, setHover] = useState<string>();
  const hoverRef = useRef<string | undefined>(undefined);
  const track = (e: GestureResponderEvent) => {
    const code = nearest(e.nativeEvent.locationX, e.nativeEvent.locationY);
    if (!code || code === hoverRef.current) return;
    hoverRef.current = code;
    setHover(code);
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  };
  const release = () => {
    const code = hoverRef.current;
    hoverRef.current = undefined;
    setHover(undefined);
    if (code && onSelectAtoll) onSelectAtoll(code);
  };
  const gestures =
    onSelectAtoll && !thumbnail
      ? {
          onStartShouldSetResponder: () => true,
          onMoveShouldSetResponder: () => true,
          // Keep the finger on the map even inside a scrolling sheet.
          onResponderTerminationRequest: () => false,
          onResponderGrant: track,
          onResponderMove: track,
          onResponderRelease: release,
          onResponderTerminate: release,
        }
      : {};

  const water = dark ? ["#0B2A3C", "#0E3A52"] : ["#E6F6FB", "#C9ECF5"];
  const reef = dark ? "rgba(120,210,230,0.35)" : "rgba(40,150,180,0.35)";
  const sand = dark ? "#E9DFC6" : "#F3E3BC";
  const islet = dark ? "#BFE6D2" : "#3E9E78";
  const sel = colors.primary;
  const equatorY = project.y(0);
  const shown = hover ?? selected;
  const selectedRing = atolls.find((a) => a.code === shown);
  const male = { x: project.x(MALE.lng), y: project.y(MALE.lat) };

  const map = (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="sea" x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={water[0]} />
          <Stop offset="1" stopColor={water[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} rx={thumbnail ? 10 : 18} fill="url(#sea)" />

      {!thumbnail && (
        <>
          {/* Equator: Gaafu and Addu sit just south of it. */}
          <Line x1={6} x2={width - 6} y1={equatorY} y2={equatorY} stroke={reef} strokeWidth={1} strokeDasharray="3 4" />
          <SvgText x={8} y={equatorY - 4} fontSize={9} fill={reef} fontWeight="700">
            0°
          </SvgText>
          {/* North arrow */}
          <G x={width - 18} y={16}>
            <Path d="M0 -8 L5 6 L0 3 L-5 6 Z" fill={reef} />
            <SvgText x={0} y={18} fontSize={9} fill={reef} fontWeight="800" textAnchor="middle">
              N
            </SvgText>
          </G>
        </>
      )}

      {selectedRing && !thumbnail && (
        <AnimatedCircle
          cx={selectedRing.cx}
          cy={selectedRing.cy}
          r={pulse.interpolate({ inputRange: [0, 1], outputRange: [Math.max(selectedRing.rx, selectedRing.ry, 8), Math.max(selectedRing.rx, selectedRing.ry, 8) + 18] })}
          fill="none"
          stroke={sel}
          strokeWidth={2}
          opacity={pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }) as any}
        />
      )}

      {atolls.map((a) => {
        const on = a.code === shown;
        return (
          <G key={a.code}>
            {/* Lagoon */}
            {a.islets.length > 1 && <Ellipse cx={a.cx} cy={a.cy} rx={a.rx} ry={a.ry} fill={on ? sel : reef} fillOpacity={on ? 0.18 : 0.14} stroke={on ? sel : reef} strokeOpacity={on ? 0.6 : 0.35} strokeWidth={1} />}
            {a.islets.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={on ? p.r + 0.4 : p.r} fill={on ? sel : i % 3 ? islet : sand} />
            ))}
          </G>
        );
      })}

      {/* The capital */}
      <G>
        <Circle cx={male.x} cy={male.y} r={thumbnail ? 2.2 : 3.4} fill={dark ? "#fff" : "#1B2B34"} stroke={sand} strokeWidth={1.2} />
        {!thumbnail && (
          <SvgText x={male.x + 7} y={male.y + 3} fontSize={10} fontWeight="800" fill={dark ? "#fff" : "#1B2B34"}>
            Malé
          </SvgText>
        )}
      </G>

      {selectedRing && !thumbnail && shown !== "KAA" && (
        <SvgText
          x={selectedRing.cx > width / 2 ? selectedRing.cx - selectedRing.rx - 6 : selectedRing.cx + selectedRing.rx + 6}
          y={selectedRing.cy + 4}
          fontSize={11}
          fontWeight="800"
          fill={sel}
          textAnchor={selectedRing.cx > width / 2 ? "end" : "start"}
        >
          {ATOLL_GEO[selectedRing.code].short}
        </SvgText>
      )}
    </Svg>
  );

  const pinX = pin ? project.x(pin.lng) : 0;
  const pinY = pin ? project.y(pin.lat) : 0;
  const pinSize = thumbnail ? 14 : 24;

  return (
    <View style={{ width, height }}>
      <View {...gestures} accessible={!!onSelectAtoll && !thumbnail} accessibilityLabel="Map of the Maldives. Tap or drag along the atolls to choose one." style={Platform.OS === "web" ? ({ cursor: onSelectAtoll && !thumbnail ? "pointer" : "default", touchAction: "none", userSelect: "none" } as any) : undefined}>
        {/* The drawing ignores touches so locationX/Y are always relative to this wrapper. */}
        <View pointerEvents="none">{map}</View>
      </View>
      {pin && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: pinX - pinSize / 2,
            top: pinY - pinSize,
            opacity: drop,
            transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) }],
          }}
        >
          <MapPin size={pinSize} color="#fff" fill={sel} strokeWidth={2} />
        </Animated.View>
      )}
    </View>
  );
}

// ---- one atoll, up close ------------------------------------------------------
// The chosen atoll's lagoon with each island as a dot you can tap. Islands with
// known positions sit where they really are; the rest are spaced around the
// rim. Tapping anywhere picks the nearest island.

type DetailIsland = { id: string; name: string };

export function AtollDetailMap({
  width,
  height,
  code,
  islands,
  selectedId,
  onSelectIsland,
}: {
  width: number;
  height: number;
  code: string;
  islands: DetailIsland[];
  selectedId?: string | null;
  onSelectIsland?: (id: string) => void;
}) {
  const { colors, scheme } = useTheme();
  const dark = scheme === "dark";
  const g = ATOLL_GEO[code];
  const pad = 22;

  const layout = useMemo(() => {
    if (!g) return null;
    // Frame the lagoon with a margin; small atolls get a minimum span.
    const latSpan = Math.max(0.16, g.ry * 2.5);
    const lngSpan = Math.max(0.16, g.rx * 2.5);
    const x = (lng: number) => pad + ((lng - (g.lng - lngSpan / 2)) / lngSpan) * (width - pad * 2);
    const y = (lat: number) => pad + (((g.lat + latSpan / 2) - lat) / latSpan) * (height - pad * 2);
    const cx = x(g.lng);
    const cy = y(g.lat);
    const rx = Math.max(10, (g.rx / lngSpan) * (width - pad * 2));
    const ry = Math.max(10, (g.ry / latSpan) * (height - pad * 2));
    const rand = seeded(code + "detail");
    const reefDots = Array.from({ length: 56 }, (_, i) => {
      const t = (i / 56) * Math.PI * 2 + rand() * 0.1;
      const w = 0.9 + rand() * 0.18;
      return { x: cx + Math.cos(t) * rx * w, y: cy + Math.sin(t) * ry * w, r: 0.8 + rand() * 1.2 };
    });
    const unplaced = islands.filter((i) => !ISLAND_GEO[`${code}/${i.name}`]);
    const points = islands.map((i) => {
      const known = ISLAND_GEO[`${code}/${i.name}`];
      if (known) return { ...i, x: x(known.lng), y: y(known.lat) };
      if (islands.length === 1) return { ...i, x: cx, y: cy };
      const k = unplaced.indexOf(i);
      const t = -Math.PI / 2 + (k / unplaced.length) * Math.PI * 2 + 0.4;
      return { ...i, x: cx + Math.cos(t) * rx * 0.82, y: cy + Math.sin(t) * ry * 0.82 };
    });
    return { cx, cy, rx, ry, reefDots, points };
  }, [g, code, islands, width, height]);

  if (!g || !layout) return null;
  const sel = colors.primary;
  const water = dark ? ["#0B2A3C", "#0E3A52"] : ["#E6F6FB", "#C9ECF5"];
  const reef = dark ? "rgba(120,210,230,0.35)" : "rgba(40,150,180,0.35)";
  const ink = dark ? "#E8F1F5" : "#1B2B34";

  const pick = (e: GestureResponderEvent) => {
    if (!onSelectIsland) return;
    const { locationX: px, locationY: py } = e.nativeEvent;
    let best = layout.points[0];
    let bestD = Infinity;
    for (const p of layout.points) {
      const d = Math.hypot(px - p.x, py - p.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) {
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      onSelectIsland(best.id);
    }
  };

  // Labels go on whichever side has room, so close neighbours don't collide.
  const labelRight = (p: { x: number }) => p.x < width * 0.62;

  const drawing = (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="seaDetail" x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={water[0]} />
          <Stop offset="1" stopColor={water[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} rx={16} fill="url(#seaDetail)" />
      {islands.length > 1 && <Ellipse cx={layout.cx} cy={layout.cy} rx={layout.rx} ry={layout.ry} fill={reef} fillOpacity={0.16} stroke={reef} strokeOpacity={0.45} strokeWidth={1.2} />}
      {islands.length > 1 && layout.reefDots.map((d, i) => <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={reef} />)}
      {layout.points.map((p) => {
        const on = p.id === selectedId;
        const right = labelRight(p);
        return (
          <G key={p.id}>
            {on && <Circle cx={p.x} cy={p.y} r={13} fill={sel} fillOpacity={0.18} />}
            <Circle cx={p.x} cy={p.y} r={on ? 7 : 5} fill={on ? sel : dark ? "#BFE6D2" : "#3E9E78"} stroke={dark ? "#0B2A3C" : "#fff"} strokeWidth={2} />
            <SvgText x={right ? p.x + 10 : p.x - 10} y={p.y + 4} fontSize={on ? 12 : 10.5} fontWeight={on ? "800" : "600"} fill={on ? sel : ink} textAnchor={right ? "start" : "end"}>
              {p.name}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );

  return onSelectIsland ? (
    <View onStartShouldSetResponder={() => true} onResponderRelease={pick} accessible accessibilityLabel={`Map of ${g.short}. Tap an island to choose it.`} style={Platform.OS === "web" ? ({ cursor: "pointer", userSelect: "none" } as any) : undefined}>
      <View pointerEvents="none">{drawing}</View>
    </View>
  ) : (
    drawing
  );
}
