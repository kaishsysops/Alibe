import React from "react";
import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { C, clamp, easeOut, fontFamily } from "../theme";

// The private handover code fills in, then the shield. "Safe by design."
const DIGITS = ["4", "8", "2", "7"];

const SafeInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const wide = width > height;
  const done = 2.1 * fps;
  return (
    <>
      <div style={{ display: "flex", gap: 26, marginTop: wide ? 40 : -80 }}>
        {DIGITS.map((d, i) => {
          const at = (0.5 + i * 0.3) * fps;
          return (
            <div
              key={i}
              style={{
                width: 170,
                height: 210,
                borderRadius: 40,
                background: C.card,
                border: `4px solid ${frame >= done ? C.green : frame >= at ? C.orange : C.line}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily,
                fontSize: 120,
                fontWeight: 800,
                color: C.ink,
                boxShadow: "0 12px 30px rgba(20,20,20,0.06)",
                scale: interpolate(frame, [at, at + 0.12 * fps, at + 0.3 * fps], [1, 1.08, 1], clamp),
              }}
            >
              {frame >= at ? d : ""}
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 56,
          display: "flex",
          alignItems: "center",
          gap: 18,
          opacity: interpolate(frame, [done, done + 0.4 * fps], [0, 1], clamp),
          scale: interpolate(frame, [done, done + 0.5 * fps], [0.85, 1], { ...clamp, easing: easeOut, output: "perceptual-scale" }),
        }}
      >
        <ShieldCheck size={72} color={C.green} strokeWidth={2} />
        <span style={{ fontFamily, fontSize: 52, fontWeight: 700, color: C.green }}>Handover confirmed</span>
      </div>
      <Interactive.Div
        name="Headline"
        style={{
          position: "absolute",
          ...(wide ? { top: 90 } : { bottom: 360 }),
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily,
          fontSize: 112,
          fontWeight: 800,
          letterSpacing: -3,
          color: C.ink,
          opacity: interpolate(frame, [0.1 * fps, 0.7 * fps], [0, 1], { ...clamp, easing: easeOut }),
        }}
      >
        Safe by design.
      </Interactive.Div>
      <Interactive.Div
        name="Subline"
        style={{
          position: "absolute",
          bottom: wide ? 90 : 220,
          left: 110,
          right: 110,
          textAlign: "center",
          fontFamily,
          fontSize: 44,
          fontWeight: 500,
          lineHeight: 1.35,
          color: C.muted,
          opacity: interpolate(frame, [0.6 * fps, 1.2 * fps], [0, 1], clamp),
        }}
      >
        A private code confirms every handover. Verified sellers wear the <BadgeCheck size={40} color="#fff" fill={C.blue} style={{ verticalAlign: "-6px" }} /> tick.
      </Interactive.Div>
    </>
  );
};

export const Safe = Interactive.create({
  Component: SafeInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
