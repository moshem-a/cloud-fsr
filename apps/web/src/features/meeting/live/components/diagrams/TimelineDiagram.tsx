import type { TimelineData } from "@scoach/types";

const DOT_R = 6;
const ROW_H = 56;
const RAIL_X = 30;
const PAD = 16;

export function TimelineDiagram({ data }: { data: TimelineData }) {
  const entries = data.entries;
  if (entries.length === 0) return null;

  const svgH = PAD * 2 + entries.length * ROW_H;

  return (
    <svg viewBox={`0 0 360 ${svgH}`} className="ig-svg" preserveAspectRatio="xMidYMid meet">
      <line x1={RAIL_X} y1={PAD + DOT_R} x2={RAIL_X} y2={svgH - PAD - DOT_R} stroke="var(--border, #dadce0)" strokeWidth={2} />
      {entries.map((e, i) => {
        const cy = PAD + i * ROW_H + ROW_H / 2;
        const colors = ["var(--gc-blue)", "var(--gc-green)", "var(--gc-yellow)", "var(--gc-red)"];
        const color = colors[i % colors.length]!;
        return (
          <g key={i}>
            <circle cx={RAIL_X} cy={cy} r={DOT_R} fill={color} />
            {e.date && (
              <text x={RAIL_X + 16} y={cy - 8} fontSize={10} fill="var(--text-3)" fontFamily="monospace">
                {e.date}
              </text>
            )}
            <text x={RAIL_X + 16} y={cy + 5} fontSize={13} fontWeight={600} fill="var(--text-1)">
              {e.label.length > 36 ? `${e.label.slice(0, 34)}…` : e.label}
            </text>
            {e.detail && (
              <text x={RAIL_X + 16} y={cy + 20} fontSize={11} fill="var(--text-3)">
                {e.detail.length > 44 ? `${e.detail.slice(0, 42)}…` : e.detail}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
