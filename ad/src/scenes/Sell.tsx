import React from "react";
import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Guitar, Check } from "lucide-react";
import { Phone } from "../parts/Phone";
import { C, clamp, easeOut, fontFamily } from "../theme";
import { useStage } from "../parts/stage";

// Snap a photo, the listing fills in, it's live.
const SellInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stage = useStage();
  const snap = 1.3 * fps;
  const title = "Acoustic guitar";
  const typed = title.slice(0, Math.max(0, Math.floor((frame - snap - 0.4 * fps) / (0.045 * fps))));
  const live = 3.4 * fps;
  return (
    <>
      <Interactive.Div
        name="Headline"
        style={{
          ...stage.headline,
          fontFamily,
          fontSize: 104,
          fontWeight: 800,
          letterSpacing: -3,
          color: C.ink,
          opacity: interpolate(frame, [0, 0.6 * fps], [0, 1], { ...clamp, easing: easeOut }),
        }}
      >
        Sell in a minute.
      </Interactive.Div>
      <div style={stage.phone}>
        <Phone>
          {/* The camera: the item, framed. */}
          <div style={{ position: "absolute", inset: 0, background: "#1C1A18", display: "flex", alignItems: "center", justifyContent: "center", opacity: interpolate(frame, [snap + 0.3 * fps, snap + 0.6 * fps], [1, 0], clamp) }}>
            <div style={{ width: 460, height: 460, borderRadius: 40, border: "4px solid rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Guitar size={260} color="#F2D7B6" strokeWidth={1.2} />
            </div>
            <div style={{ position: "absolute", bottom: 90, width: 120, height: 120, borderRadius: 60, border: "8px solid #fff", background: "rgba(255,255,255,0.25)" }} />
          </div>
          {/* The listing. */}
          <div style={{ position: "absolute", inset: 0, padding: "110px 36px 0", fontFamily, opacity: interpolate(frame, [snap + 0.3 * fps, snap + 0.6 * fps], [0, 1], clamp) }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: C.ink }}>New listing</div>
            <div style={{ marginTop: 26, height: 400, borderRadius: 36, background: "#F6E9DA", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Guitar size={220} color={C.ink} strokeWidth={1.2} />
            </div>
            <div style={{ marginTop: 28, fontSize: 24, fontWeight: 700, color: C.muted }}>Title</div>
            <div style={{ marginTop: 8, height: 80, borderRadius: 24, background: C.card, border: `2px solid ${C.line}`, display: "flex", alignItems: "center", padding: "0 24px", fontSize: 32, fontWeight: 600, color: C.ink }}>{typed}</div>
            <div style={{ marginTop: 20, fontSize: 24, fontWeight: 700, color: C.muted }}>Price</div>
            <div
              style={{
                marginTop: 8,
                height: 80,
                borderRadius: 24,
                background: C.card,
                border: `2px solid ${C.line}`,
                display: "flex",
                alignItems: "center",
                padding: "0 24px",
                fontSize: 32,
                fontWeight: 600,
                color: C.ink,
                opacity: interpolate(frame, [snap + 1.3 * fps, snap + 1.6 * fps], [0, 1], clamp),
              }}
            >
              MVR 1,800
            </div>
            <div
              style={{
                marginTop: 34,
                height: 96,
                borderRadius: 48,
                background: interpolate(frame, [live - 0.2 * fps, live], [0, 1], clamp) > 0.5 ? C.green : C.orange,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                fontSize: 36,
                fontWeight: 800,
                color: "#fff",
                scale: interpolate(frame, [live - 0.3 * fps, live - 0.15 * fps, live], [1, 0.95, 1], clamp),
              }}
            >
              {frame >= live ? (
                <>
                  <Check size={40} color="#fff" strokeWidth={3.4} /> Live on Alibe
                </>
              ) : (
                "Publish"
              )}
            </div>
          </div>
          {/* Camera flash. */}
          <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: interpolate(frame, [snap, snap + 0.06 * fps, snap + 0.4 * fps], [0, 0.95, 0], clamp) }} />
        </Phone>
      </div>
    </>
  );
};

export const Sell = Interactive.create({
  Component: SellInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
