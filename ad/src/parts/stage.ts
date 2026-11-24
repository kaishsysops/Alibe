import type React from "react";
import { useVideoConfig } from "remotion";
import { PHONE_H, PHONE_W } from "./Phone";

// Where the headline and phone sit. Vertical (9:16): headline on top, phone
// below. Widescreen (16:9): headline on the left, a slightly smaller phone on the right.
export const useStage = () => {
  const { width, height } = useVideoConfig();
  const wide = width > height;
  const phoneScale = wide ? 0.7 : 1;
  const headline: React.CSSProperties = wide
    ? { position: "absolute", left: 200, width: 900, top: 0, bottom: 0, display: "flex", alignItems: "center", textAlign: "left" }
    : { position: "absolute", top: 150, left: 0, right: 0, textAlign: "center" };
  const phone: React.CSSProperties = wide
    ? { position: "absolute", left: width - 200 - PHONE_W * phoneScale, top: (height - (PHONE_H + 36) * phoneScale) / 2, scale: phoneScale, transformOrigin: "top left" }
    : { position: "absolute", left: (width - PHONE_W) / 2, top: 400 };
  return { wide, headline, phone };
};
