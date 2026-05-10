import type { StepData } from "@scoach/types";

const CIRCLE_R = 18;
const STEP_W = 100;
const GAP = 40;
const PAD = 20;

export function StepsDiagram({ data }: { data: StepData }) {
  const steps = data.steps;
  if (steps.length === 0) return null;

  const svgW = PAD * 2 + steps.length * STEP_W + (steps.length - 1) * GAP;
  const svgH = 130;
  const cy = 50;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="ig-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="step-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="var(--gc-blue, #1a73e8)" />
        </marker>
      </defs>
      {steps.map((step, i) => {
        const cx = PAD + i * (STEP_W + GAP) + STEP_W / 2;
        const colors = ["var(--gc-blue)", "var(--gc-green)", "var(--gc-yellow)", "var(--gc-red)"];
        const color = colors[i % colors.length]!;
        return (
          <g key={i}>
            {i < steps.length - 1 && (
              <line
                x1={cx + CIRCLE_R + 4}
                y1={cy}
                x2={cx + STEP_W + GAP - CIRCLE_R - 4}
                y2={cy}
                stroke="var(--gc-blue, #1a73e8)"
                strokeWidth={1.5}
                markerEnd="url(#step-arrow)"
              />
            )}
            <circle cx={cx} cy={cy} r={CIRCLE_R} fill={color} opacity={0.15} stroke={color} strokeWidth={2} />
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill={color}>
              {i + 1}
            </text>
            <text x={cx} y={cy + CIRCLE_R + 16} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text-1)">
              {step.title.length > 14 ? `${step.title.slice(0, 12)}…` : step.title}
            </text>
            {step.detail && (
              <text x={cx} y={cy + CIRCLE_R + 30} textAnchor="middle" fontSize={10} fill="var(--text-3)">
                {step.detail.length > 16 ? `${step.detail.slice(0, 14)}…` : step.detail}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
