import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "tabs" | "block";
  ariaLabel?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  variant = "default",
  ariaLabel,
}: SegmentedControlProps<T>) {
  const cls =
    variant === "tabs"
      ? `seg seg-tabs ${size === "sm" ? "seg-sm" : size === "lg" ? "seg-lg" : ""}`
      : variant === "block"
        ? `seg seg-block ${size === "sm" ? "seg-sm" : ""}`
        : `seg ${size === "sm" ? "seg-sm" : size === "lg" ? "seg-lg" : ""}`;

  return (
    <div className={cls.trim()} role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          disabled={opt.disabled}
          className={value === opt.value ? "on" : ""}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon}
          {opt.label}
          {typeof opt.count === "number" && (
            <span className="segment-count">{opt.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
