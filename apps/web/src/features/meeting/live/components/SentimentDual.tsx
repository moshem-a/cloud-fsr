import { Trend, User } from "@scoach/ui/icons";
import { useMemo } from "react";

import { useLiveMeetingStore } from "../store.ts";

const W = 220;
const H = 30;
const PAD = 3;

function colorFor(kind?: "positive" | "buying" | "concern" | "neutral"): string {
  switch (kind) {
    case "positive": return "var(--gc-green)";
    case "buying":   return "var(--gc-blue)";
    case "concern":  return "var(--gc-yellow)";
    default:         return "var(--text-4)";
  }
}

interface SparkProps {
  values: number[];
  stroke: string;
}

function Spark({ values, stroke }: SparkProps) {
  if (values.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="sentiment-mini-sparkline" role="img" aria-label="">
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="var(--border-soft)" strokeDasharray="2 3" />
      </svg>
    );
  }
  const xs = (i: number) => PAD + (i / Math.max(values.length - 1, 1)) * (W - PAD * 2);
  const ys = (v: number) => H - PAD - ((v - 0) / 100) * (H - PAD * 2);
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sentiment-mini-sparkline" role="img" aria-label="Sentiment over time">
      <path d={path} stroke={stroke} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Two stacked mini sparklines: rep ("You") and client. Each is the speaker's
 * own sentiment over time, classified separately on the server (per-speaker
 * transcript window every 10s).
 *
 * Replaces the older single combined SentimentMini in the rail.
 */
export function SentimentDual() {
  const sentimentRep = useLiveMeetingStore((s) => s.sentimentRep);
  const sentimentClient = useLiveMeetingStore((s) => s.sentimentClient);
  const events = useLiveMeetingStore((s) => s.sentimentEvents);

  const repValues = useMemo(() => sentimentRep.map((s) => s.value), [sentimentRep]);
  const clientValues = useMemo(() => sentimentClient.map((s) => s.value), [sentimentClient]);

  const repLast = repValues[repValues.length - 1] ?? 0;
  const clientLast = clientValues[clientValues.length - 1] ?? 0;

  const lastEvent = events.length > 0 ? events[events.length - 1] : null;

  function valColor(v: number): string {
    if (v >= 60) return "var(--gc-green)";
    if (v >= 35) return "var(--gc-yellow)";
    return "var(--gc-red, #b00020)";
  }

  return (
    <div className="sentiment-dual">
      <div className="sentiment-dual-head">
        <span><Trend size={11} /> Live sentiment</span>
        {lastEvent && (
          <span style={{ color: colorFor(lastEvent.kind) }}>{lastEvent.kind}</span>
        )}
      </div>

      <div className="sentiment-row">
        <div className="sentiment-row-head">
          <User size={11} /> <span className="sentiment-row-label">You</span>
          <span className="sentiment-row-val" style={{ color: repValues.length ? valColor(repLast) : "var(--text-4)" }}>
            {repValues.length ? `${repLast}/100` : "—"}
          </span>
        </div>
        <Spark values={repValues} stroke="var(--gc-blue)" />
      </div>

      <div className="sentiment-row">
        <div className="sentiment-row-head">
          <User size={11} /> <span className="sentiment-row-label">Client</span>
          <span className="sentiment-row-val" style={{ color: clientValues.length ? valColor(clientLast) : "var(--text-4)" }}>
            {clientValues.length ? `${clientLast}/100` : "—"}
          </span>
        </div>
        <Spark values={clientValues} stroke="var(--gc-green)" />
      </div>

      {repValues.length === 0 && clientValues.length === 0 && (
        <div className="sentiment-empty">Sentiment will populate as the call progresses.</div>
      )}
    </div>
  );
}
