export type AvatarSize = "xs" | "sm" | "md" | "lg";

export interface AvatarProps {
  name: string;
  initials?: string;
  color?: string;
  size?: AvatarSize;
  online?: boolean;
}

const SIZE_PX: Record<AvatarSize, number> = { xs: 20, sm: 24, md: 32, lg: 44 };

function colorFromString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash << 5) - hash + s.charCodeAt(i);
  const palette = ["#1A73E8", "#1E8E3E", "#F9AB00", "#EA4335", "#7C3AED", "#0EA5E9", "#DB2777"];
  return palette[Math.abs(hash) % palette.length] ?? palette[0]!;
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({ name, initials, color, size = "md", online }: AvatarProps) {
  const text = initials ?? deriveInitials(name);
  const bg = color ?? colorFromString(name);
  const px = SIZE_PX[size];
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{
        background: bg,
        width: px,
        height: px,
        fontSize: Math.max(10, Math.floor(px * 0.4)),
      }}
      aria-label={name}
      title={name}
    >
      {text}
      {online && <span className="avatar-dot" />}
    </span>
  );
}
