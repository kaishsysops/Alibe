// Approximate geography for the island picker's map. It's an illustration, not
// a chart: positions are close enough to read as the real country, and atoll
// shapes are drawn as rings of islets. Keyed by Atoll.code (backend seed).

export type AtollGeo = { lat: number; lng: number; ry: number; rx: number; short: string };

// North to south. ry/rx are the ring's half-height/half-width in degrees.
export const ATOLL_GEO: Record<string, AtollGeo> = {
  HA: { lat: 6.95, lng: 73.0, ry: 0.24, rx: 0.15, short: "Haa Alifu" },
  HDH: { lat: 6.66, lng: 73.1, ry: 0.19, rx: 0.13, short: "Haa Dhaalu" },
  SH: { lat: 6.3, lng: 73.25, ry: 0.21, rx: 0.12, short: "Shaviyani" },
  N: { lat: 5.86, lng: 73.36, ry: 0.19, rx: 0.14, short: "Noonu" },
  R: { lat: 5.56, lng: 72.98, ry: 0.29, rx: 0.12, short: "Raa" },
  BAA: { lat: 5.15, lng: 73.0, ry: 0.17, rx: 0.14, short: "Baa" },
  LH: { lat: 5.36, lng: 73.48, ry: 0.16, rx: 0.09, short: "Lhaviyani" },
  KAA: { lat: 4.3, lng: 73.5, ry: 0.44, rx: 0.13, short: "Kaafu" },
  AA: { lat: 4.15, lng: 72.88, ry: 0.29, rx: 0.12, short: "Alifu Alifu" },
  ALI: { lat: 3.66, lng: 72.86, ry: 0.19, rx: 0.13, short: "Alifu Dhaalu" },
  V: { lat: 3.45, lng: 73.5, ry: 0.19, rx: 0.11, short: "Vaavu" },
  F: { lat: 3.16, lng: 72.92, ry: 0.14, rx: 0.09, short: "Faafu" },
  M: { lat: 2.95, lng: 73.52, ry: 0.21, rx: 0.09, short: "Meemu" },
  DH: { lat: 2.8, lng: 72.9, ry: 0.17, rx: 0.09, short: "Dhaalu" },
  TH: { lat: 2.31, lng: 73.12, ry: 0.21, rx: 0.16, short: "Thaa" },
  LAA: { lat: 1.9, lng: 73.42, ry: 0.19, rx: 0.13, short: "Laamu" },
  GA: { lat: 0.72, lng: 73.3, ry: 0.27, rx: 0.27, short: "Gaafu Alifu" },
  GDH: { lat: 0.36, lng: 73.18, ry: 0.2, rx: 0.28, short: "Gaafu Dhaalu" },
  GN: { lat: -0.3, lng: 73.42, ry: 0.03, rx: 0.03, short: "Gnaviyani" },
  ADD: { lat: -0.63, lng: 73.13, ry: 0.07, rx: 0.08, short: "Addu" },
};

export const ATOLL_ORDER = Object.keys(ATOLL_GEO);

// Where the pin drops for the bigger islands. Others pin on their atoll.
export const ISLAND_GEO: Record<string, { lat: number; lng: number }> = {
  "KAA/Malé": { lat: 4.175, lng: 73.509 },
  "KAA/Hulhumalé": { lat: 4.21, lng: 73.54 },
  "KAA/Villimalé": { lat: 4.172, lng: 73.484 },
  "KAA/Maafushi": { lat: 3.94, lng: 73.49 },
  "KAA/Guraidhoo": { lat: 3.9, lng: 73.47 },
  "KAA/Thulusdhoo": { lat: 4.37, lng: 73.65 },
  "KAA/Himmafushi": { lat: 4.31, lng: 73.57 },
  "KAA/Dhiffushi": { lat: 4.44, lng: 73.71 },
  "KAA/Kaashidhoo": { lat: 4.95, lng: 73.47 },
  "HA/Dhidhdhoo": { lat: 6.887, lng: 73.114 },
  "HDH/Kulhudhuffushi": { lat: 6.622, lng: 73.07 },
  "HDH/Hanimaadhoo": { lat: 6.75, lng: 73.17 },
  "SH/Funadhoo": { lat: 6.15, lng: 73.29 },
  "N/Manadhoo": { lat: 5.767, lng: 73.41 },
  "R/Ungoofaaru": { lat: 5.668, lng: 73.03 },
  "BAA/Eydhafushi": { lat: 5.103, lng: 73.07 },
  "LH/Naifaru": { lat: 5.444, lng: 73.366 },
  "AA/Rasdhoo": { lat: 4.263, lng: 72.993 },
  "AA/Ukulhas": { lat: 4.215, lng: 72.86 },
  "AA/Thoddoo": { lat: 4.437, lng: 72.96 },
  "ALI/Mahibadhoo": { lat: 3.757, lng: 72.969 },
  "ALI/Dhangethi": { lat: 3.608, lng: 72.955 },
  "ALI/Dhigurah": { lat: 3.53, lng: 72.92 },
  "V/Felidhoo": { lat: 3.47, lng: 73.547 },
  "V/Fulidhoo": { lat: 3.68, lng: 73.42 },
  "M/Muli": { lat: 2.917, lng: 73.58 },
  "F/Nilandhoo": { lat: 3.057, lng: 72.89 },
  "DH/Kudahuvadhoo": { lat: 2.671, lng: 72.894 },
  "TH/Veymandoo": { lat: 2.188, lng: 73.1 },
  "TH/Thimarafushi": { lat: 2.21, lng: 73.15 },
  "LAA/Fonadhoo": { lat: 1.833, lng: 73.503 },
  "LAA/Gan": { lat: 1.92, lng: 73.54 },
  "GA/Villingili": { lat: 0.756, lng: 73.435 },
  "GDH/Thinadhoo": { lat: 0.531, lng: 72.996 },
  "GDH/Gadhdhoo": { lat: 0.29, lng: 73.45 },
  "GN/Fuvahmulah": { lat: -0.298, lng: 73.424 },
  "ADD/Hithadhoo": { lat: -0.61, lng: 73.09 },
  "ADD/Feydhoo": { lat: -0.68, lng: 73.13 },
  "ADD/Maradhoo": { lat: -0.66, lng: 73.11 },
  "ADD/Hulhudhoo": { lat: -0.6, lng: 73.23 },
};

// Shown first in every picker: where most people are.
export const POPULAR_ISLANDS: Array<[atollCode: string, island: string]> = [
  ["KAA", "Malé"],
  ["KAA", "Hulhumalé"],
  ["KAA", "Villimalé"],
  ["ADD", "Hithadhoo"],
  ["GN", "Fuvahmulah"],
  ["HDH", "Kulhudhuffushi"],
  ["GDH", "Thinadhoo"],
  ["LAA", "Fonadhoo"],
];

// New accounts and new listings start here unless the person says otherwise.
export const DEFAULT_ISLAND: [string, string] = ["KAA", "Malé"];
