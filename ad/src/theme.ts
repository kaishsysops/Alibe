import { Easing } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

// Alibe's look: the app's orange, warm off-white, near-black type.
export const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });

export const C = {
  orange: "#FF6A00",
  orangeDeep: "#E85500",
  paper: "#F7F5F2",
  ink: "#141414",
  muted: "#6E6A66",
  card: "#FFFFFF",
  line: "#E9E4DE",
  blue: "#1E7BE0",
  green: "#22A06B",
  tint: "#FFF1E6",
};

// Apple-style motion: quick start, long soft landing.
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
