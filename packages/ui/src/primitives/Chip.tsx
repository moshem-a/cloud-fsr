import type { ReactNode } from "react";
import { Close } from "../icons/index.tsx";
import type { BadgeColor } from "./Badge.tsx";

export interface ChipProps {
  color?: BadgeColor;
  removable?: boolean;
  onRemove?: () => void;
  children?: ReactNode;
}

export function Chip({ color = "neutral", removable, onRemove, children }: ChipProps) {
  return (
    <span className={`chip chip-${color}`}>
      {children}
      {removable && (
        <button
          type="button"
          aria-label="Remove"
          className="chip-remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
        >
          <Close size={12} />
        </button>
      )}
    </span>
  );
}
