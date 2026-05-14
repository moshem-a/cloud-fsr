/* Stroke-based icon set ported from sales_mockup/icons.jsx.
 * 40 icons, 1.8px stroke, viewBox 24×24, default size varies (14–18px).
 * Each icon is its own component for tree-shaking. */

import type { CSSProperties, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "size"> {
  size?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
  title?: string;
}

const base = {
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function svg(size: number, props: IconProps) {
  const { color, style, className, title, size: _size, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    style: color ? { color, ...style } : style,
    className,
    "aria-label": title,
    role: title ? "img" : "presentation",
    ...rest,
  };
}

export const Search = (p: IconProps) => (
  <svg {...svg(p.size ?? 18, p)} {...base}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const Mic = (p: IconProps) => (
  <svg {...svg(p.size ?? 18, p)} {...base}>
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const MicOff = (p: IconProps) => (
  <svg {...svg(p.size ?? 18, p)} {...base}>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 12V6a3 3 0 0 0-5.94-.6" />
    <path d="M5 11a7 7 0 0 0 10.7 5.95M19 11a7 7 0 0 1-.34 2.16" />
    <path d="M12 18v3M3 3l18 18" />
  </svg>
);

export const Pause = (p: IconProps) => (
  <svg {...svg(p.size ?? 18, p)} {...base} strokeWidth={1.8}>
    <path d="M9 5v14M15 5v14" />
  </svg>
);

export const Play = (p: IconProps) => (
  <svg {...svg(p.size ?? 18, p)} fill="currentColor">
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);

export const Stop = (p: IconProps) => (
  <svg {...svg(p.size ?? 18, p)} fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const Send = (p: IconProps) => (
  <svg {...svg(p.size ?? 18, p)} {...base}>
    <path d="m4 12 16-8-6 16-2-7-8-1Z" />
  </svg>
);

export const Spark = (p: IconProps) => (
  <svg {...svg(p.size ?? 18, p)} {...base}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
  </svg>
);

export const Bolt = (p: IconProps) => (
  <svg {...svg(p.size ?? 18, p)} {...base}>
    <path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" />
  </svg>
);

export const Question = (p: IconProps) => (
  <svg {...svg(p.size ?? 18, p)} {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 0 1 5 .2c0 1.6-2.5 2.1-2.5 3.8M12 17h.01" />
  </svg>
);

export const Chev = (p: IconProps) => (
  <svg {...svg(p.size ?? 14, p)} {...base} strokeWidth={2}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const Close = (p: IconProps) => (
  <svg {...svg(p.size ?? 18, p)} {...base}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const Copy = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </svg>
);

export const Check = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base} strokeWidth={2.2}>
    <path d="m5 12 4 4 10-10" />
  </svg>
);

export const ThumbUp = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M7 22V10M2 11h5v11H2zM21 11.5c0-1-.8-1.5-1.7-1.5H14l1-3.5c.3-1-.4-2-1.5-2-.6 0-1.2.4-1.4 1L10 10v12h8.5c.9 0 1.6-.6 1.8-1.4l1.2-7.6c.05-.5.05-1 0-1.5Z" />
  </svg>
);

export const ThumbDn = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M17 2v12M22 13h-5V2h5zM3 12.5c0 1 .8 1.5 1.7 1.5H10l-1 3.5c-.3 1 .4 2 1.5 2 .6 0 1.2-.4 1.4-1L14 14V2H5.5c-.9 0-1.6.6-1.8 1.4L2.5 11c-.05.5-.05 1 0 1.5Z" />
  </svg>
);

export const Pin = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="m12 17 .01 5M5 9l7 7 7-7-3-2V3H8v4L5 9Z" />
  </svg>
);

export const Expand = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);

export const Doc = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

export const Globe = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);

export const Share = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="M15.8 6.4 8.2 10.6M8.2 13.4l7.6 4.2" />
  </svg>
);

export const Monitor = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <rect x="3" y="5" width="18" height="12" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

export const ShareUsers = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="m17 11 2 2 4-4" />
  </svg>
);

export const User = (p: IconProps) => (
  <svg {...svg(p.size ?? 18, p)} {...base}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

export const Trend = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="m3 17 6-6 4 4 8-8M14 7h7v7" />
  </svg>
);

export const Alert = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M12 3 2 21h20L12 3zM12 10v4M12 18h.01" />
  </svg>
);

export const Brain = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-3 3v2a3 3 0 0 0 3 3 3 3 0 0 0 3 3V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 3 3v2a3 3 0 0 1-3 3 3 3 0 0 1-3 3V4z" />
  </svg>
);

export const Filter = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M3 5h18l-7 9v6l-4-2v-4L3 5z" />
  </svg>
);

export const More = (p: IconProps) => (
  <svg {...svg(p.size ?? 18, p)} fill="currentColor">
    <circle cx="6" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="18" cy="12" r="1.6" />
  </svg>
);

export const Notebook = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M6 4h12a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM4 9h2M4 13h2M4 17h2" />
  </svg>
);

export const Eye = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOff = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17.7 17.7 0 0 1-2.7 3.4M6.5 7.6A17.6 17.6 0 0 0 2 12s3.5 7 10 7c1.6 0 3-.3 4.3-.8M9.9 9.9a3 3 0 1 0 4.2 4.2" />
  </svg>
);

export const Lock = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const Trash = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6" />
  </svg>
);

export const Logout = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H10" />
  </svg>
);

export const Settings = (p: IconProps) => (
  <svg {...svg(p.size ?? 18, p)} {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const Users = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
  </svg>
);

export const Plus = (p: IconProps) => (
  <svg {...svg(p.size ?? 14, p)} {...base} strokeWidth={2.2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const Link = (p: IconProps) => (
  <svg {...svg(p.size ?? 14, p)} {...base}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

export const Inbox = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5h13l3 7v6a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-6l3-7z" />
  </svg>
);

export const Chart = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <path d="M4 20V10M10 20V4M16 20v-8M22 20v-4" />
  </svg>
);

export const Image = (p: IconProps) => (
  <svg {...svg(p.size ?? 16, p)} {...base}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" />
  </svg>
);
