export interface StatTileProps {
  label: string;
  value: string | number;
  trend?: string;
  color: "blue" | "green" | "yellow" | "red";
}

export function StatTile({ label, value, trend, color }: StatTileProps) {
  return (
    <div className={`stat-tile stat-${color}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {trend && <div className="stat-trend">{trend}</div>}
    </div>
  );
}
