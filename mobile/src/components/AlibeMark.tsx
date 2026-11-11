import React from "react";
import Svg, { G, Path } from "react-native-svg";

// The Alibe logo mark (the smiling bag in a hat) as line art, tightly cropped.
// Source artwork: assets/brand/*.svg
export default function AlibeMark({ size = 32, color = "#FF6A00" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="37 42 166 166" accessibilityLabel="Alibe">
      <G fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
        <G strokeWidth={12}>
          <Path d="M74 100 L64 162 Q62 192 92 192 H101 Q120 206 139 192 H148 Q178 192 176 162 L166 100" />
          <Path d="M54 100 H186" />
          <Path d="M87 100 Q87 50 120 50 Q153 50 153 100" />
        </G>
        <G strokeWidth={8.5}>
          <Path d="M89 82 Q120 92 151 82" />
          <Path d="M103 154 Q120 170 137 154" />
        </G>
        <Path d="M101 134 h0 M139 134 h0" strokeWidth={11} />
      </G>
    </Svg>
  );
}
