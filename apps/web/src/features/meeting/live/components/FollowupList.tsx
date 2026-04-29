import { Check, Spark } from "@scoach/ui/icons";
import { useState } from "react";

import { useLiveMeetingStore } from "../store.ts";

export function FollowupList() {
  const followups = useLiveMeetingStore((s) => s.followups);
  const [used, setUsed] = useState<Record<number, boolean>>({});

  return (
    <div className="fu-wrap">
      <p className="fu-intro">
        Suggested questions, ranked by likelihood of unlocking a buying signal. Tap to mark as asked.
      </p>
      <ul className="fu-list">
        {followups.map((q, i) => (
          <li
            key={`${i}-${q.slice(0, 16)}`}
            className={`fu-item ${used[i] ? "fu-used" : ""}`}
            onClick={() => setUsed((u) => ({ ...u, [i]: !u[i] }))}
          >
            <div className="fu-num mono">{String(i + 1).padStart(2, "0")}</div>
            <div className="fu-text">{q}</div>
            <button type="button" className="ghost-btn fu-act">
              {used[i] ? (
                <>
                  <Check size={14} /> Asked
                </>
              ) : (
                <>Mark asked</>
              )}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="dashed-btn">
        <Spark size={14} /> Generate more from current context
      </button>
    </div>
  );
}
