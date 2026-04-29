export interface SpinnerProps {
  size?: number;
  color?: string;
}

export function Spinner({ size = 16, color = "currentColor" }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ animation: "spinner-spin 0.9s linear infinite" }}
      aria-label="Loading"
      role="status"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="40 60"
      />
      <style>{`@keyframes spinner-spin { to { transform: rotate(360deg); transform-origin: center; } }`}</style>
    </svg>
  );
}

export interface ShimmerProps {
  width?: number | string;
  height?: number | string;
}

export function Shimmer({ width = "100%", height = 14 }: ShimmerProps) {
  return (
    <div
      className="shimmer"
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: 6,
      }}
      aria-hidden
    />
  );
}
