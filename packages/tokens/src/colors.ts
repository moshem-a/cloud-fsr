export const brand = {
  blue: "#1A73E8",
  blue600: "#1557B0",
  blue50: "#E8F0FE",
  red: "#EA4335",
  red50: "#FCE8E6",
  yellow: "#F9AB00",
  yellow50: "#FEF7E0",
  green: "#1E8E3E",
  green50: "#E6F4EA",
} as const;

export const surfaceLight = {
  bg: "#F6F8FB",
  surface: "#FFFFFF",
  surface2: "#F1F3F6",
  surface3: "#E8EAED",
  border: "#DADCE0",
  borderSoft: "#E8EAED",
  text1: "#202124",
  text2: "#3C4043",
  text3: "#5F6368",
  text4: "#80868B",
} as const;

export const surfaceDark = {
  bg: "#0E1116",
  surface: "#161B22",
  surface2: "#1C232C",
  surface3: "#232B36",
  border: "#2A3340",
  borderSoft: "#222A35",
  text1: "#E8EAED",
  text2: "#C7CBD1",
  text3: "#9AA0A6",
  text4: "#6E7681",
} as const;

export type BrandColor = keyof typeof brand;
export type SurfaceToken = keyof typeof surfaceLight;
