import { Trend } from "@scoach/ui/icons";
import { useMemo } from "react";

import { useLiveMeetingStore } from "../store.ts";

const W = 220;
const H = 36;
const PAD = 4;

function colorFor(kind?: "positive" | "buying" | "concern" | "neutral"): string {
  switch (kind) {
    case "positive": return "var(--gc-green)";
    case "buying":   return "var(--gc-blue)";
    case "concern":  return "var(--gc-yellow)";
    default:         return "var(--text-4)";
  }
}

/**
 * Compact sentiment summary used in the bottom of the ContextRail. The full
 * SentimentView (with events list and per-tick markers) is unused on the live
 * screen post-layout-flip but stays as the source of truth for the chart math.
 */
export function SentimentMini() {
  // Subscribe to the raw arrays (stable refs from the store) and derive in
  // useMemo. Mapping inside the selector returns a NEW array each call which
  // breaks Zustand's reference-equality check → infinite re-render (React #185).
  const sentimentSeries = useLiveMeetingStore((s) => s.sentimentSeries);
  const events = useLiveMeetingStore((s) => s.sentimentEvents);
  const series = useMemo(() => sentimentSeries.map((sample) => sample.value), [sentimentSeries]);

  if (series.length === 0) {
    return (
      <div className="sentiment-mini">
        <div className="sentiment-mini-head">
          <span>Sentiment</span>
          <span className="sentiment-mini-val" style={{ color: "var(--text-4)" }}>—</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-4)" }}>Waiting for samples…</div>
      </div>
    );
  }

  const last = series[series.length - 1] ?? 0;
  const xs = (i: number) => PAD + (i / Math.max(series.length - 1, 1)) * (W - PAD * 2);
  const ys = (v: number) => H - PAD - ((v - 0) / 100) * (H - PAD * 2);
  const path = series
    .map((v, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`)
    .join(" ");
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const valueColor = last >= 60 ? "var(--gc-green)" : last >= 35 ? "var(--gc-yellow)" : "var(--gc-red, #b00020)";

  return (
    <div className="sentiment-mini">
      <div className="sentiment-mini-head">
        <span>Sentiment</span>
        <span className="sentiment-mini-val" style={{ color: valueColor }}>
          <Trend size={11} /> {last}/100
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="sentiment-mini-sparkline" role="img" aria-label="Sentiment sparkline">
        <path d={path} stroke="var(--gc-blue)" strokeWidth={1.5} fill="none" />
        {lastEvent && series[lastEvent.at] != null && (
          <circle cx={xs(lastEvent.at)} cy={ys(series[lastEvent.at]!)} r={2.5} fill={colorFor(lastEvent.kind)} />
        )}
      </svg>
      {lastEvent && (
        <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>
          <span style={{ color: colorFor(lastEvent.kind), fontWeight: 600 }}>{lastEvent.kind}</span>
          {" · "}
          {lastEvent.label}
        </div>
      )}
    </div>
  );
}
