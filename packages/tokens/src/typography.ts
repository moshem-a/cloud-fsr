export const fontFamily = {
  sans: '"Inter", "Heebo", "Helvetica Neue", Helvetica, Arial, sans-serif',
  display: '"Manrope", "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  rtl: '"Heebo", "Inter", sans-serif',
} as const;

export const fontSize = {
  xxs: "9px",
  xs: "11px",
  sm: "12px",
  body: "13px",
  bodyLg: "13.5px",
  md: "14px",
  cardTitle: "13px",
  panelTitle: "14px",
  h3: "18px",
  h2: "22px",
  h1: "32px",
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const lineHeight = {
  tight: 1.15,
  normal: 1.45,
  relaxed: 1.6,
} as const;
