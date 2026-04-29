import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function Card({ className = "", children, ...rest }: CardProps) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHead({ className = "", children, ...rest }: CardProps) {
  return (
    <div className={`card-head ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...rest }: CardProps) {
  return (
    <div className={`card-title ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardMeta({ className = "", children, ...rest }: CardProps) {
  return (
    <div className={`card-meta ${className}`} {...rest}>
      {children}
    </div>
  );
}
