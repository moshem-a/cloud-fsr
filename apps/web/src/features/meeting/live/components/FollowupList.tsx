import { Check, Spark } from "@scoach/ui/icons";
import { useState } from "react";

import { useLiveMeetingStore } from "../store.ts";

function relativeTime(at: number): string {
  const ms = Date.now() - at;
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m === 1) return "1 min ago";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h === 1 ? "1 hr ago" : `${h} hrs ago`;
}

export function FollowupList() {
  const sets = useLiveMeetingStore((s) => s.followupSets);
  const fallback = useLiveMeetingStore((s) => s.followups);
  const [used, setUsed] = useState<Record<string, boolean>>({});

  // Latest set wins for the "current" list. Older sets render in history below.
  const latest = sets[sets.length - 1] ?? (fallback.length > 0 ? { items: fallback, at: Date.now() } : null);
  const history = sets.slice(0, -1).reverse(); // newest-first older sets

  if (!latest || latest.items.length === 0) {
    return (
      <div className="fu-wrap">
        <p className="fu-intro" style={{ color: "var(--text-3)" }}>
          Follow-up questions will appear here as the conversation progresses. Updated about every minute.
        </p>
      </div>
    );
  }

  return (
    <div className="fu-wrap">
      <p className="fu-intro">
        Suggested questions, ranked by likelihood of unlocking a buying signal. Tap to mark as asked.
      </p>
      <ul className="fu-list">
        {latest.items.map((q, i) => {
          const key = `latest-${i}-${q.slice(0, 24)}`;
          return (
            <li
              key={key}
              className={`fu-item ${used[key] ? "fu-used" : ""}`}
              onClick={() => setUsed((u) => ({ ...u, [key]: !u[key] }))}
            >
              <div className="fu-num mono">{String(i + 1).padStart(2, "0")}</div>
              <div className="fu-text">{q}</div>
              <button type="button" className="ghost-btn fu-act">
                {used[key] ? (
                  <>
                    <Check size={14} /> Asked
                  </>
                ) : (
                  <>Mark asked</>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {history.length > 0 && (
        <div className="fu-history-section">
          <div className="fu-history-head">Earlier follow-ups</div>
          {history.map((set, idx) => (
            <div key={`hist-${set.at}-${idx}`} className="fu-history-set">
              <div className="fu-history-time">{relativeTime(set.at)}</div>
              <ul className="fu-list">
                {set.items.map((q, i) => (
                  <li key={`hist-${set.at}-${i}`} className="fu-item">
                    <div className="fu-num mono">{String(i + 1).padStart(2, "0")}</div>
                    <div className="fu-text">{q}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="dashed-btn">
        <Spark size={14} /> Generate more from current context
      </button>
    </div>
  );
}
