import React from "react";
import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { AlibeMark } from "../parts/AlibeMark";
import { clamp, easeOut, fontFamily } from "../theme";

// Orange, the mark draws itself, the name, the address.
const EndCardInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = interpolate(frame, [0.1 * fps, 1.3 * fps], [0, 1], { ...clamp, easing: easeOut });
  return (
    <>
      <div
        style={{
          width: 300,
          height: 300,
          borderRadius: 80,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 30px 80px rgba(0,0,0,0.18)",
          scale: interpolate(frame, [0, 0.8 * fps], [0.7, 1], { ...clamp, easing: easeOut, output: "perceptual-scale" }),
          opacity: interpolate(frame, [0, 0.3 * fps], [0, 1], clamp),
        }}
      >
        <AlibeMark size={220} color="#FF6A00" draw={draw} />
      </div>
      <Interactive.Div
        name="Wordmark"
        style={{
          fontFamily,
          fontSize: 150,
          fontWeight: 800,
          letterSpacing: -5,
          color: "#fff",
          marginTop: 50,
          opacity: interpolate(frame, [0.8 * fps, 1.4 * fps], [0, 1], { ...clamp, easing: easeOut }),
          translate: interpolate(frame, [0.8 * fps, 1.6 * fps], ["0px 40px", "0px 0px"], { ...clamp, easing: easeOut }),
        }}
      >
        Alibe
      </Interactive.Div>
      <Interactive.Div
        name="Tagline"
        style={{
          fontFamily,
          fontSize: 52,
          fontWeight: 500,
          color: "rgba(255,255,255,0.92)",
          marginTop: 10,
          opacity: interpolate(frame, [1.3 * fps, 1.9 * fps], [0, 1], clamp),
        }}
      >
        Buy and sell across the Maldives.
      </Interactive.Div>
      <Interactive.Div
        name="Address"
        style={{
          position: "absolute",
          bottom: 200,
          paddingLeft: 56,
          paddingRight: 56,
          height: 110,
          borderRadius: 55,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          fontFamily,
          fontSize: 50,
          fontWeight: 800,
          color: "#FF6A00",
          opacity: interpolate(frame, [1.8 * fps, 2.4 * fps], [0, 1], clamp),
          translate: interpolate(frame, [1.8 * fps, 2.5 * fps], ["0px 30px", "0px 0px"], { ...clamp, easing: easeOut }),
        }}
      >
        alibe.online
      </Interactive.Div>
    </>
  );
};

export const EndCard = Interactive.create({
  Component: EndCardInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
