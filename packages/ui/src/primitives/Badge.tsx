import type { ReactNode } from "react";

export type BadgeColor = "neutral" | "blue" | "red" | "yellow" | "green";

export interface BadgeProps {
  color?: BadgeColor;
  children?: ReactNode;
}

export function Badge({ color = "neutral", children }: BadgeProps) {
  return <span className={`tag tag-${color}`}>{children}</span>;
}
