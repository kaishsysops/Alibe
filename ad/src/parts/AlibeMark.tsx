import React from "react";

// The Alibe logo mark (the smiling bag in a hat), from the app's brand artwork.
// `draw` (0..1) traces the lines in, for the end card.
export const AlibeMark: React.FC<{ size: number; color: string; draw?: number }> = ({ size, color, draw = 1 }) => {
  const dash = 700;
  const line = { strokeDasharray: dash, strokeDashoffset: dash * (1 - draw) };
  return (
    <svg width={size} height={size} viewBox="37 42 166 166">
      <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
        <g strokeWidth={12}>
          <path style={line} d="M74 100 L64 162 Q62 192 92 192 H101 Q120 206 139 192 H148 Q178 192 176 162 L166 100" />
          <path style={line} d="M54 100 H186" />
          <path style={line} d="M87 100 Q87 50 120 50 Q153 50 153 100" />
        </g>
        <g strokeWidth={8.5}>
          <path style={line} d="M89 82 Q120 92 151 82" />
          <path style={line} d="M103 154 Q120 170 137 154" />
        </g>
        <path d="M101 134 h0 M139 134 h0" strokeWidth={11} opacity={draw > 0.6 ? 1 : 0} />
      </g>
    </svg>
  );
};
