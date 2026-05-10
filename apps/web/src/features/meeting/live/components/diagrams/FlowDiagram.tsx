import type { FlowData } from "@scoach/types";

const NODE_W = 140;
const NODE_H = 40;
const GAP_X = 60;
const GAP_Y = 60;
const PAD = 20;

export function FlowDiagram({ data }: { data: FlowData }) {
  const nodes = data.nodes;
  const edges = data.edges;
  if (nodes.length === 0) return null;

  const cols = nodes.length <= 4 ? nodes.length : Math.ceil(Math.sqrt(nodes.length));
  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((n, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(n.id, {
      x: PAD + col * (NODE_W + GAP_X),
      y: PAD + row * (NODE_H + GAP_Y),
    });
  });

  const maxCol = Math.min(nodes.length, cols);
  const maxRow = Math.ceil(nodes.length / cols);
  const svgW = PAD * 2 + maxCol * NODE_W + (maxCol - 1) * GAP_X;
  const svgH = PAD * 2 + maxRow * NODE_H + (maxRow - 1) * GAP_Y;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="ig-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="flow-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="var(--gc-blue, #1a73e8)" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const from = positions.get(e.from);
        const to = positions.get(e.to);
        if (!from || !to) return null;
        const x1 = from.x + NODE_W / 2;
        const y1 = from.y + NODE_H;
        const x2 = to.x + NODE_W / 2;
        const y2 = to.y;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--gc-blue, #1a73e8)" strokeWidth={1.5} markerEnd="url(#flow-arrow)" />
            {e.label && (
              <text x={mx} y={my - 4} textAnchor="middle" fontSize={10} fill="var(--text-3)">
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {nodes.map((n) => {
        const pos = positions.get(n.id)!;
        return (
          <g key={n.id}>
            <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={8} fill="var(--surface-2, #f1f3f4)" stroke="var(--gc-blue, #1a73e8)" strokeWidth={1.5} />
            <text x={pos.x + NODE_W / 2} y={pos.y + NODE_H / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-1)">
              {n.label.length > 18 ? `${n.label.slice(0, 16)}…` : n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
