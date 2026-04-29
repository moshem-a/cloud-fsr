import { Alert, Trend } from "@scoach/ui/icons";

import { useLiveMeetingStore } from "../store.ts";

const W = 380;
const H = 140;
const PAD = 8;
const MAX = 100;
const MIN = 0;

function colorFor(kind: "positive" | "buying" | "concern" | "neutral"): string {
  switch (kind) {
    case "positive":
      return "var(--gc-green)";
    case "buying":
      return "var(--gc-blue)";
    case "concern":
      return "var(--gc-yellow)";
    default:
      return "var(--text-4)";
  }
}

export function SentimentView() {
  const series = useLiveMeetingStore((s) => s.sentimentSeries.map((sample) => sample.value));
  const events = useLiveMeetingStore((s) => s.sentimentEvents);
  const startedAt = useLiveMeetingStore((s) => s.startedAt);

  if (series.length === 0) {
    return (
      <div className="sent-wrap">
        <p className="fu-intro">Engagement signal will appear once the conversation starts.</p>
      </div>
    );
  }

  const last = series[series.length - 1] ?? 0;
  const xs = (i: number) => PAD + (i / Math.max(series.length - 1, 1)) * (W - PAD * 2);
  const ys = (v: number) => H - PAD - ((v - MIN) / (MAX - MIN)) * (H - PAD * 2);
  const path = series
    .map((v, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`)
    .join(" ");
  const area = `${path} L ${xs(series.length - 1).toFixed(1)} ${H - PAD} L ${PAD} ${H - PAD} Z`;

  const opening = series[0] ?? last;
  const delta = last - opening;
  const elapsed = startedAt
    ? `${Math.floor((Date.now() - startedAt) / 60000)
        .toString()
        .padStart(2, "0")}:${(Math.floor((Date.now() - startedAt) / 1000) % 60).toString().padStart(2, "0")}`
    : "00:00";

  return (
    <div className="sent-wrap">
      <div className="sent-row">
        <div className="sent-stat">
          <div className="sent-stat-label">Engagement</div>
          <div className="sent-stat-val" style={{ color: "var(--gc-green)" }}>
            {last}
            <span>/100</span>
          </div>
          <div className="sent-stat-trend">
            <Trend size={12} /> {delta >= 0 ? "+" : ""}
            {delta} since opening
          </div>
        </div>
        <div className="sent-stat">
          <div className="sent-stat-label">Tone</div>
          <div className="sent-stat-val">Confident</div>
          <div className="sent-stat-trend">Pace +12% · steady</div>
        </div>
        <div className="sent-stat">
          <div className="sent-stat-label">Hesitation</div>
          <div className="sent-stat-val" style={{ color: "var(--gc-yellow)" }}>
            Low
          </div>
          <div className="sent-stat-trend">2 fillers · last @ 01:18</div>
        </div>
      </div>

      <div className="sent-chart-card">
        <div className="sent-chart-head">
          <span className="sent-chart-title">Client engagement over time</span>
          <span className="mono sent-chart-x">00:00 → {elapsed}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="sent-chart" role="img" aria-label="Sentiment over time">
          <defs>
            <linearGradient id="sentGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--gc-blue)" stopOpacity=".35" />
              <stop offset="100%" stopColor="var(--gc-blue)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[25, 50, 75].map((g) => (
            <line key={g} x1={PAD} x2={W - PAD} y1={ys(g)} y2={ys(g)} stroke="var(--border-soft)" strokeDasharray="2 4" />
          ))}
          <path d={area} fill="url(#sentGrad)" />
          <path d={path} stroke="var(--gc-blue)" strokeWidth={2} fill="none" />
          {events.map((e, i) => {
            const v = series[e.at];
            if (v == null) return null;
            return (
              <g key={`${i}-${e.label}`} transform={`translate(${xs(e.at)} ${ys(v)})`}>
                <circle r={4} fill={colorFor(e.kind)} />
                <circle r={9} fill="none" stroke={colorFor(e.kind)} strokeOpacity={0.25} />
              </g>
            );
          })}
        </svg>
        <ul className="sent-events">
          {events.map((e, i) => (
            <li key={`${i}-${e.label}`} className={`sent-ev sent-ev-${e.kind}`}>
              <span className="sent-ev-dot" style={{ background: colorFor(e.kind) }} />
              <span className="sent-ev-label">{e.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {events.some((e) => e.kind === "buying") && (
        <div className="sent-flag">
          <div className="sent-flag-icon" style={{ background: "var(--gc-green-50)", color: "var(--gc-green)" }}>
            <Alert size={14} />
          </div>
          <div>
            <div className="sent-flag-title">Buying signal detected</div>
            <div className="sent-flag-sub">
              "…it has to happen this quarter. The board is pushing." — confidence elevated, urgency present.
              Consider asking about decision-makers and procurement timeline.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
