// Accent colours the user can pick on the welcome screen (and later in Edit
// Profile). Everything brand-coloured in the app derives from the chosen one.
export const ACCENTS = [
  { name: "Sunset", hex: "#FF6A00" },
  { name: "Ocean", hex: "#1E7BE0" },
  { name: "Lagoon", hex: "#00A3A3" },
  { name: "Reef", hex: "#16A34A" },
  { name: "Hibiscus", hex: "#E0336E" },
  { name: "Twilight", hex: "#7347E6" },
] as const;

export const DEFAULT_ACCENT = ACCENTS[0].hex;

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Linear mix of `hex` toward `target` by `amount` (0 = hex, 1 = target).
function mix(hex: string, target: string, amount: number) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const out = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export type Scheme = "light" | "dark";

export function buildColors(accent: string, scheme: Scheme = "light") {
  const dark = scheme === "dark";
  const background = dark ? "#121214" : "#F7F7F5";
  const card = dark ? "#1C1C1F" : "#FFFFFF";
  return {
    scheme,
    primary: accent,
    primaryDark: mix(accent, "#000000", 0.18),
    primaryLight: dark ? mix(accent, background, 0.55) : mix(accent, "#FFFFFF", 0.7),
    // Soft accent wash for selected rows/chips; mixed into the surface colour
    // so it reads correctly in both themes.
    primaryTint: dark ? mix(accent, card, 0.82) : mix(accent, "#FFFFFF", 0.92),
    accent: "#FF3D55",
    gold: "#F2A93B",
    background,
    card,
    // Raised surfaces that float over photos (back/heart buttons).
    floating: dark ? "rgba(28,28,31,0.92)" : "rgba(255,255,255,0.94)",
    text: dark ? "#F2F2EF" : "#1A1A1A",
    textMuted: dark ? "#A3A3A0" : "#6B6B6B",
    // Text drawn on a `text`-coloured background (selected dark chips).
    inverseText: dark ? "#121214" : "#FFFFFF",
    border: dark ? "#2E2E33" : "#E7E5E0",
    skeleton: dark ? "#26262A" : "#ECEBE7",
    danger: "#E5484D",
    success: "#22A45D",
    verified: "#1D9BF0",
    price: mix(accent, "#000000", 0.08),
  };
}

export type Colors = ReturnType<typeof buildColors>;

export const conditionColors: Record<string, string> = {
  NEW: "#22A45D",
  LIKE_NEW: "#1E7BE0",
  GOOD: "#E39A1F",
  FAIR: "#E5484D",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

// A single consistent type scale — every text style in the app should pull
// from here rather than using ad-hoc numbers, per standard UI type-scale
// practice (e.g. 12/14/16/18/24/32).
export const fontSize = {
  micro: 10, // ultra-compact badges/ribbons only (e.g. "-23%", "NEW") — never body copy
  caption: 12, // meta text: ratings, sold count, location, timestamps, hints, helper text
  sm: 13, // secondary labels, chip text, form field labels
  base: 14, // default body text, card titles, list rows
  md: 15, // emphasized body / primary input text
  lg: 17, // card prices, subheadings, section item titles
  xl: 20, // in-screen section titles ("Description", "My Listings")
  xxl: 24, // screen/page headers ("Sell an item", "Browse listings")
  display: 28, // hero headline (onboarding, home hero banner)
} as const;

export const fontWeight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
};

// Multipliers — multiply by the paired fontSize to get an absolute lineHeight.
export const lineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
};

// Shared soft-elevation shadow for cards/floating elements — used instead of
// hard borders per the card-based, shadow-over-border style direction.
export const cardShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

// Extra bottom padding for scroll content on tab screens so it doesn't sit
// behind the floating pill tab bar.
export const tabBarClearance = 100;
