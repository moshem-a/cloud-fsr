import type { ReactNode } from "react";

export interface ToggleRowProps {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleRow({ label, description, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <div className={`toggle-row ${disabled ? "disabled" : ""}`}>
      <div className="toggle-row-text">
        <div className="toggle-row-label">{label}</div>
        {description && <div className="toggle-row-desc">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`toggle-switch ${checked ? "on" : "off"}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}
