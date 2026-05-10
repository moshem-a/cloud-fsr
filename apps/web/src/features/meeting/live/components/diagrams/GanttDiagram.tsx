import type { GanttData } from "@scoach/types";

const PAD = 16;
const LABEL_W = 110;
const BAR_H = 22;
const ROW_H = 32;
const CHART_PAD = 8;

function toDay(s: string): number {
  return Math.floor(new Date(s).getTime() / 86_400_000);
}

export function GanttDiagram({ data }: { data: GanttData }) {
  const tasks = data.tasks;
  if (tasks.length === 0) return null;

  const allDays = tasks.flatMap((t) => [toDay(t.start), toDay(t.end)]);
  const minDay = Math.min(...allDays);
  const maxDay = Math.max(...allDays);
  const span = Math.max(maxDay - minDay, 1);

  const chartW = 240;
  const svgW = PAD * 2 + LABEL_W + CHART_PAD + chartW;
  const svgH = PAD * 2 + tasks.length * ROW_H;
  const colors = ["var(--gc-blue)", "var(--gc-green)", "var(--gc-yellow)", "var(--gc-red)"];

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="ig-svg" preserveAspectRatio="xMidYMid meet">
      {tasks.map((t, i) => {
        const y = PAD + i * ROW_H;
        const startFrac = (toDay(t.start) - minDay) / span;
        const endFrac = (toDay(t.end) - minDay) / span;
        const barX = PAD + LABEL_W + CHART_PAD + startFrac * chartW;
        const barW = Math.max((endFrac - startFrac) * chartW, 4);
        const color = colors[i % colors.length]!;
        return (
          <g key={i}>
            <text x={PAD} y={y + ROW_H / 2 + 4} fontSize={11} fontWeight={600} fill="var(--text-1)">
              {t.name.length > 16 ? `${t.name.slice(0, 14)}…` : t.name}
            </text>
            <rect x={barX} y={y + (ROW_H - BAR_H) / 2} width={barW} height={BAR_H} rx={4} fill={color} opacity={0.7} />
            <text x={barX + barW + 4} y={y + ROW_H / 2 + 3} fontSize={9} fill="var(--text-3)" fontFamily="monospace">
              {t.start}
            </text>
          </g>
        );
      })}
      <line
        x1={PAD + LABEL_W + CHART_PAD}
        y1={PAD - 2}
        x2={PAD + LABEL_W + CHART_PAD}
        y2={svgH - PAD + 2}
        stroke="var(--border, #dadce0)"
        strokeWidth={1}
      />
    </svg>
  );
}
