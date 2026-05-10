import type { ComparisonData } from "@scoach/types";

const COL_W = 150;
const PAD = 16;
const ROW_H = 28;
const HEADER_H = 32;
const GAP = 12;

export function ComparisonDiagram({ data }: { data: ComparisonData }) {
  const cols = data.columns;
  if (cols.length === 0) return null;

  const maxItems = Math.max(...cols.map((c) => c.items.length));
  const svgW = PAD * 2 + cols.length * COL_W + (cols.length - 1) * GAP;
  const svgH = PAD * 2 + HEADER_H + maxItems * ROW_H + 8;
  const colors = ["var(--gc-blue)", "var(--gc-green)", "var(--gc-yellow)", "var(--gc-red)"];

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="ig-svg" preserveAspectRatio="xMidYMid meet">
      {cols.map((col, ci) => {
        const x = PAD + ci * (COL_W + GAP);
        const color = colors[ci % colors.length]!;
        return (
          <g key={ci}>
            <rect x={x} y={PAD} width={COL_W} height={HEADER_H} rx={6} fill={color} opacity={0.15} />
            <text x={x + COL_W / 2} y={PAD + HEADER_H / 2 + 5} textAnchor="middle" fontSize={12} fontWeight={700} fill={color}>
              {col.header}
            </text>
            {col.items.map((item, ii) => {
              const iy = PAD + HEADER_H + 8 + ii * ROW_H;
              return (
                <g key={ii}>
                  <rect x={x} y={iy} width={COL_W} height={ROW_H - 4} rx={4} fill="var(--surface-2, #f1f3f4)" />
                  <text x={x + 8} y={iy + ROW_H / 2 + 2} fontSize={11} fill="var(--text-1)">
                    {item.length > 20 ? `${item.slice(0, 18)}…` : item}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
