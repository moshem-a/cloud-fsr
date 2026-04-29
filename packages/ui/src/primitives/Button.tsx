import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

export type ButtonVariant = "primary" | "ghost" | "dashed" | "icon";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  recording?: boolean;
  muted?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

function classes(...cn: (string | false | undefined)[]) {
  return cn.filter(Boolean).join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading,
    recording,
    muted,
    leftIcon,
    rightIcon,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const base =
    variant === "icon"
      ? `icon-btn icon-btn-${size}`
      : variant === "dashed"
        ? `dashed-btn ${size === "lg" ? "lg" : ""}`
        : `pill-btn ${variant} ${size === "lg" ? "lg" : size === "sm" ? "sm" : ""}`;

  return (
    <button
      ref={ref}
      className={classes(
        base,
        recording && "recording",
        muted && "muted",
        loading && "loading",
        className,
      )}
      disabled={disabled ?? loading}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
});
