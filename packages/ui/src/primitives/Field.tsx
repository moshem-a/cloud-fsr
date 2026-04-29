import type { ReactNode } from "react";

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children?: ReactNode;
}

export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && <div className="field-hint">{hint}</div>}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
