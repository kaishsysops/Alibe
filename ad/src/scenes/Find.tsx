import React from "react";
import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Smartphone, Sofa, Gamepad2, Ship, Bike, Camera, MapPin, LucideIcon } from "lucide-react";
import { AppTop, Phone } from "../parts/Phone";
import { C, clamp, easeOut, fontFamily } from "../theme";
import { useStage } from "../parts/stage";

// The app's Home: the search types "iphone" and listings fill in.
const ITEMS: Array<{ title: string; price: string; place: string; Icon: LucideIcon; tint: string }> = [
  { title: "iPhone 15 Pro, 256GB", price: "MVR 14,500", place: "Malé", Icon: Smartphone, tint: "#EAF2FF" },
  { title: "Rattan sofa set", price: "MVR 3,200", place: "Hulhumalé", Icon: Sofa, tint: "#FFF1E6" },
  { title: "PS5 Slim + 2 pads", price: "MVR 6,800", place: "Addu", Icon: Gamepad2, tint: "#F1ECFF" },
  { title: "Fishing dinghy, 40hp", price: "MVR 45,000", place: "Fuvahmulah", Icon: Ship, tint: "#E6F7F7" },
  { title: "Scooter, 2022", price: "MVR 18,900", place: "Kulhudhuffushi", Icon: Bike, tint: "#FFF7E0" },
  { title: "Sony mirrorless kit", price: "MVR 9,400", place: "Malé", Icon: Camera, tint: "#FDECEF" },
];

const Card: React.FC<{ i: number; frame: number; fps: number }> = ({ i, frame, fps }) => {
  const item = ITEMS[i];
  const start = 1.5 * fps + i * 0.12 * fps;
  return (
    <div
      style={{
        width: 255,
        borderRadius: 30,
        background: C.card,
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(20,20,20,0.07)",
        opacity: interpolate(frame, [start, start + 0.5 * fps], [0, 1], { ...clamp, easing: easeOut }),
        translate: interpolate(frame, [start, start + 0.7 * fps], ["0px 40px", "0px 0px"], { ...clamp, easing: easeOut }),
      }}
    >
      <div style={{ height: 190, background: item.tint, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <item.Icon size={96} color={C.ink} strokeWidth={1.4} />
      </div>
      <div style={{ padding: "16px 18px 20px", fontFamily }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: C.ink }}>{item.price}</div>
        <div style={{ fontSize: 24, fontWeight: 500, color: C.ink, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 21, color: C.muted }}>
          <MapPin size={18} color={C.muted} />
          {item.place}
        </div>
      </div>
    </div>
  );
};

const FindInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stage = useStage();
  const query = "iphone";
  const typed = query.slice(0, Math.max(0, Math.floor((frame - 0.7 * fps) / (0.09 * fps))));
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
        Find it near you.
      </Interactive.Div>
      <Interactive.Div
        name="Phone"
        style={{
          ...stage.phone,
          translate: interpolate(frame, [0, 1.1 * fps], ["0px 420px", "0px 0px"], { ...clamp, easing: easeOut }),
        }}
      >
        <Phone>
          <AppTop search={typed} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 22, padding: "28px 30px", justifyContent: "space-between" }}>
            {ITEMS.map((_, i) => (
              <Card key={i} i={i} frame={frame} fps={fps} />
            ))}
          </div>
        </Phone>
      </Interactive.Div>
    </>
  );
};

export const Find = Interactive.create({
  Component: FindInner,
  layout: "absolute-fill",
  schema: { ...Interactive.backgroundSchema },
});
