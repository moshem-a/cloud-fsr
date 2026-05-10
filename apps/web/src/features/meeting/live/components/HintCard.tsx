import type { Hint } from "@scoach/types";
import { Check, Copy, Doc, Pin, Spark, ThumbDn, ThumbUp } from "@scoach/ui/icons";
import { type CSSProperties, useState } from "react";

import { api } from "../../../../lib/http.ts";
import { useLiveMeetingStore } from "../store.ts";

export interface HintCardProps {
  hint: Hint;
  meetingId: string;
  style?: CSSProperties;
}

const COLOR_MAP = {
  blue: { tint: "var(--gc-blue-50)", strong: "var(--gc-blue)" },
  red: { tint: "var(--gc-red-50)", strong: "var(--gc-red)" },
  yellow: { tint: "var(--gc-yellow-50)", strong: "var(--gc-yellow)" },
  green: { tint: "var(--gc-green-50)", strong: "var(--gc-green)" },
} as const;

export function HintCard({ hint, meetingId, style }: HintCardProps) {
  const acted = useLiveMeetingStore((s) => s.actedHintIds.has(hint.id));
  const pinned = useLiveMeetingStore((s) => s.pinnedHintIds.has(hint.id));
  const markActed = useLiveMeetingStore((s) => s.markHintActed);
  const togglePinned = useLiveMeetingStore((s) => s.togglePinned);
  const [open, setOpen] = useState(true);

  const c = COLOR_MAP[hint.color];

  function handleAct() {
    markActed(hint.id);
    api(`/meetings/${meetingId}/hints/${hint.id}/feedback`, {
      method: "POST",
      body: { actedOn: true },
    }).catch(() => {});
  }
  function handleNotRelevant() {
    void meetingId;
  }

  return (
    <article
      className={`hint-card hint-in ${acted ? "is-acted" : ""} ${hint.priority === "high" ? "hint-priority-high" : ""}`}
      style={style}
    >
      <div className="hint-rail" style={{ background: c.strong }} />
      <div className="hint-body">
        <header className="hint-head">
          <div className="hint-cat" style={{ background: c.tint, color: c.strong }}>
            <Spark size={12} /> {hint.category}
          </div>
          <div className="hint-meta mono">@ {hint.timestamp}</div>
          <div className="hint-confidence" title="Confidence">
            <span className="conf-bar">
              <span style={{ width: `${hint.confidence * 100}%`, background: c.strong }} />
            </span>
            <span className="conf-num mono">{Math.round(hint.confidence * 100)}%</span>
          </div>
          <button
            type="button"
            className={`icon-btn xs ${pinned ? "active" : ""}`}
            onClick={() => togglePinned(hint.id)}
            title="Pin"
          >
            <Pin size={14} />
          </button>
        </header>

        <h3 className="hint-title">{hint.title}</h3>
        <p className="hint-summary">{hint.summary}</p>

        {hint.comparisonTable && (
          <>
            <div className="hint-compare-topic">{hint.comparisonTable.topic}</div>
            <div className="hint-compare">
              <div className={`hint-compare-side is-${hint.comparisonTable.left.verdict ?? "neutral"}`}>
                <h4>{hint.comparisonTable.left.name}</h4>
                <ul>
                  {hint.comparisonTable.left.points.map((p, i) => (
                    <li key={`l-${i}`}>{p}</li>
                  ))}
                </ul>
              </div>
              <div className={`hint-compare-side is-${hint.comparisonTable.right.verdict ?? "neutral"}`}>
                <h4>{hint.comparisonTable.right.name}</h4>
                <ul>
                  {hint.comparisonTable.right.points.map((p, i) => (
                    <li key={`r-${i}`}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
            {hint.comparisonTable.recommendation && (
              <div className="hint-compare-rec">{hint.comparisonTable.recommendation}</div>
            )}
          </>
        )}

        {open && hint.proofPoints.length > 0 && (
          <ul className="hint-points">
            {hint.proofPoints.map((p, i) => (
              <li key={`${i}-${p.slice(0, 8)}`}>
                <span className="hp-dot" style={{ background: c.strong }} />
                {p}
              </li>
            ))}
          </ul>
        )}

        <div className="hint-sources">
          {hint.sources.map((s) => (
            <span key={s} className="src-chip">
              <Doc size={12} /> {s}
            </span>
          ))}
        </div>

        <footer className="hint-foot">
          <div className="hint-foot-actions">
            <button type="button" className="ghost-btn" onClick={() => setOpen((o) => !o)}>
              {open ? "Collapse" : "Expand"}
            </button>
            <button type="button" className="ghost-btn">
              <Copy size={14} /> Copy
            </button>
            <button type="button" className="ghost-btn">Send to Drive</button>
          </div>
          <div className="hint-foot-feedback">
            <button
              type="button"
              className={`icon-btn xs ${acted ? "active-good" : ""}`}
              onClick={handleAct}
              title="Used this"
            >
              <ThumbUp size={14} />
            </button>
            <button type="button" className="icon-btn xs" onClick={handleNotRelevant} title="Not relevant">
              <ThumbDn size={14} />
            </button>
          </div>
        </footer>
        {acted && (
          <div className="acted-stripe">
            <Check size={12} /> Marked as used in conversation
          </div>
        )}
      </div>
    </article>
  );
}
