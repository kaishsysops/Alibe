import React from "react";
import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Gamepad2, Tag, Check } from "lucide-react";
import { Phone } from "../parts/Phone";
import { C, clamp, easeOut, fontFamily } from "../theme";
import { useStage } from "../parts/stage";

// Ask, offer, agreed: a conversation in Alibe chat.
const Bubble: React.FC<{ mine?: boolean; at: number; children: React.ReactNode }> = ({ mine, at, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: 440,
        padding: "22px 28px",
        borderRadius: 34,
        borderBottomRightRadius: mine ? 10 : 34,
        borderBottomLeftRadius: mine ? 34 : 10,
        background: mine ? C.orange : C.card,
        color: mine ? "#fff" : C.ink,
        fontFamily,
        fontSize: 31,
        fontWeight: 500,
        lineHeight: 1.3,
        boxShadow: mine ? "none" : "0 6px 18px rgba(20,20,20,0.06)",
        opacity: interpolate(frame, [at * fps, (at + 0.3) * fps], [0, 1], clamp),
        translate: interpolate(frame, [at * fps, (at + 0.5) * fps], ["0px 30px", "0px 0px"], { ...clamp, easing: easeOut }),
      }}
    >
      {children}
    </div>
  );
};

const ChatInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stage = useStage();
  const accepted = 3.2 * fps;
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
        Chat. Offer. Deal.
      </Interactive.Div>
      <div style={stage.phone}>
        <Phone>
          <div style={{ padding: "100px 30px 22px", display: "flex", alignItems: "center", gap: 18, borderBottom: `2px solid ${C.line}`, background: C.card, fontFamily }}>
            <div style={{ width: 76, height: 76, borderRadius: 22, background: "#F1ECFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Gamepad2 size={44} color={C.ink} strokeWidth={1.6} />
            </div>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, color: C.ink }}>Hassan</div>
              <div style={{ fontSize: 24, color: C.muted }}>PS5 Slim + 2 pads · MVR 6,800</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: 30 }}>
            <Bubble mine at={0.6}>
              Hi! Is the PS5 still available?
            </Bubble>
            <Bubble at={1.3}>Yes, it is. I'm in Addu, can send it on the ferry.</Bubble>
            {/* The offer card. */}
            <div
              style={{
                alignSelf: "flex-end",
                width: 440,
                borderRadius: 34,
                background: C.card,
                border: `3px solid ${frame >= accepted ? C.green : C.orange}`,
                padding: 26,
                fontFamily,
                opacity: interpolate(frame, [2.1 * fps, 2.4 * fps], [0, 1], clamp),
                translate: interpolate(frame, [2.1 * fps, 2.6 * fps], ["0px 30px", "0px 0px"], { ...clamp, easing: easeOut }),
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 24, fontWeight: 700, color: C.muted }}>
                <Tag size={24} color={C.muted} /> Your offer
              </div>
              <div style={{ fontSize: 52, fontWeight: 800, color: C.ink, marginTop: 6 }}>MVR 6,300</div>
              <div
                style={{
                  marginTop: 16,
                  height: 64,
                  borderRadius: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  fontSize: 28,
                  fontWeight: 800,
                  color: frame >= accepted ? "#fff" : C.orange,
                  background: frame >= accepted ? C.green : C.tint,
                  scale: interpolate(frame, [accepted, accepted + 0.12 * fps, accepted + 0.3 * fps], [1, 1.06, 1], clamp),
                }}
              >
                {frame >= accepted ? (
                  <>
                    <Check size={32} color="#fff" strokeWidth={3.4} /> Accepted
                  </>
                ) : (
                  "Waiting for Hassan..."
                )}
              </div>
            </div>
          </div>
        </Phone>
      </div>
    </>
  );
};

export const Chat = Interactive.create({
  Component: ChatInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
