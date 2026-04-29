import type { ReferenceLink } from "@scoach/types";
import { Check, Globe, Spark } from "@scoach/ui/icons";
import { useMemo, useState } from "react";

export function ReferenceLinks({ refs }: { refs: ReferenceLink[] }) {
  const [included, setIncluded] = useState<Record<number, boolean>>(() =>
    refs.reduce<Record<number, boolean>>((a, _r, i) => {
      a[i] = i < 4;
      return a;
    }, {}),
  );
  const count = useMemo(() => Object.values(included).filter(Boolean).length, [included]);

  return (
    <>
      <ul className="ref-list">
        {refs.map((r, i) => (
          <li key={r.href} className={`ref-item ${included[i] ? "on" : ""}`}>
            <button
              type="button"
              className={`check-btn ${included[i] ? "on" : ""}`}
              onClick={() => setIncluded((s) => ({ ...s, [i]: !s[i] }))}
            >
              {included[i] ? <Check size={12} /> : null}
            </button>
            <div className="ref-icon">
              <Globe size={14} />
            </div>
            <div className="ref-info">
              <div className="ref-title">{r.title}</div>
              <div className="ref-href mono">{r.href}</div>
            </div>
            <span className="ref-source">{r.source}</span>
          </li>
        ))}
      </ul>
      <div className="ref-foot">
        <span>
          {count} of {refs.length} included in email
        </span>
        <button type="button" className="ghost-btn">
          <Spark size={14} /> Suggest more
        </button>
      </div>
    </>
  );
}
