export const ease = "cubic-bezier(.2,.8,.2,1)" as const;

export const duration = {
  fast: "150ms",
  base: "200ms",
  slow: "350ms",
} as const;

export const radius = {
  sm: "6px",
  md: "10px",
  lg: "14px",
  xl: "20px",
  pill: "999px",
} as const;

export const shadowLight = {
  s1: "0 1px 2px rgba(60,64,67,.08), 0 1px 3px rgba(60,64,67,.06)",
  s2: "0 2px 6px rgba(60,64,67,.08), 0 8px 24px rgba(60,64,67,.06)",
  s3: "0 4px 12px rgba(60,64,67,.10), 0 16px 40px rgba(60,64,67,.08)",
} as const;

export const shadowDark = {
  s1: "0 1px 2px rgba(0,0,0,.40)",
  s2: "0 2px 8px rgba(0,0,0,.45), 0 12px 28px rgba(0,0,0,.35)",
  s3: "0 4px 14px rgba(0,0,0,.55), 0 20px 48px rgba(0,0,0,.40)",
} as const;
