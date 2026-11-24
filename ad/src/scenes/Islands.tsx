import React from "react";
import { CanvasImage, Interactive, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp, easeOut, fontFamily } from "../theme";

// The Maldives from above, slowly drifting closer. "From Malé to Addu."
const IslandsInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const wide = width > height;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <CanvasImage
          src={staticFile("maldives.jpg")}
          fit="cover"
          style={{
            width,
            height,
            scale: interpolate(frame, [0, durationInFrames], [1.12, 1.28], clamp),
            translate: interpolate(frame, [0, durationInFrames], ["0px 0px", "-40px -60px"], clamp),
          }}
        />
      </div>
      {/* Soft shade so the words read on the water. */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)" }} />
      <div style={{ position: "absolute", left: wide ? 200 : 90, right: 90, bottom: wide ? 130 : 220 }}>
        <Interactive.Div
          name="Headline"
          style={{
            fontFamily,
            fontSize: 120,
            fontWeight: 800,
            letterSpacing: -3,
            lineHeight: 1.02,
            color: "#fff",
            opacity: interpolate(frame, [0.4 * fps, 1.3 * fps], [0, 1], { ...clamp, easing: easeOut }),
            translate: interpolate(frame, [0.4 * fps, 1.4 * fps], ["0px 50px", "0px 0px"], { ...clamp, easing: easeOut }),
          }}
        >
          From Malé
          <br />
          to Addu.
        </Interactive.Div>
        <Interactive.Div
          name="Subline"
          style={{
            fontFamily,
            fontSize: 48,
            fontWeight: 500,
            color: "rgba(255,255,255,0.88)",
            marginTop: 28,
            opacity: interpolate(frame, [1.2 * fps, 2 * fps], [0, 1], { ...clamp, easing: easeOut }),
          }}
        >
          Buy and sell across every atoll.
        </Interactive.Div>
      </div>
      <div style={{ position: "absolute", top: wide ? 80 : 120, left: wide ? 200 : 90, fontFamily, fontSize: 40, fontWeight: 800, color: "#fff", letterSpacing: -0.5, opacity: 0.9 }}>
        Alibe
        <span style={{ color: C.orange }}>.</span>
      </div>
    </>
  );
};

export const Islands = Interactive.create({
  Component: IslandsInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
