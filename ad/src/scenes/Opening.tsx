import React from "react";
import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp, easeOut, fontFamily } from "../theme";

// "Every island. / One marketplace." Two lines, rising in one after the other.
const OpeningInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <Interactive.Div
        name="Line 1"
        style={{
          fontFamily,
          fontSize: 116,
          fontWeight: 800,
          letterSpacing: -3.5,
          color: C.ink,
          textAlign: "center",
          opacity: interpolate(frame, [0.2 * fps, 1 * fps], [0, 1], { ...clamp, easing: easeOut }),
          translate: interpolate(frame, [0.2 * fps, 1.2 * fps], ["0px 60px", "0px 0px"], { ...clamp, easing: easeOut }),
        }}
      >
        Every island.
      </Interactive.Div>
      <Interactive.Div
        name="Line 2"
        style={{
          fontFamily,
          fontSize: 116,
          fontWeight: 800,
          letterSpacing: -3.5,
          color: C.orange,
          textAlign: "center",
          marginTop: 8,
          opacity: interpolate(frame, [1.1 * fps, 1.9 * fps], [0, 1], { ...clamp, easing: easeOut }),
          translate: interpolate(frame, [1.1 * fps, 2.1 * fps], ["0px 60px", "0px 0px"], { ...clamp, easing: easeOut }),
        }}
      >
        One marketplace.
      </Interactive.Div>
    </>
  );
};

export const Opening = Interactive.create({
  Component: OpeningInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
