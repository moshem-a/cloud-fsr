import type { Meeting } from "@scoach/types";
import { Brain, Copy, Doc, Globe, Notebook, Spark, User } from "@scoach/ui/icons";

import { ScreenSharePreview, type ScreenSharePreviewProps } from "./ScreenSharePreview.tsx";

export interface ContextRailProps extends ScreenSharePreviewProps {
  meeting: Meeting;
}

export function ContextRail({ meeting, stream, rmsDb, error, onPickSource }: ContextRailProps) {
  return (
    <aside className="rail">
      <ScreenSharePreview stream={stream} rmsDb={rmsDb} error={error} onPickSource={onPickSource} />

      <section className="card">
        <div className="card-head">
          <div className="card-title">
            <Spark size={16} /> Meeting goal
          </div>
          <button type="button" className="ghost-btn" aria-label="Copy goal">
            <Copy size={14} />
          </button>
        </div>
        <p className="goal-text">{meeting.goal ?? "(no goal set)"}</p>
        {/* Tags will be derived from real context-analysis insights once the
            pre-meeting analyze step has run. Hidden for fresh meetings. */}
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-title">
            <User size={16} /> In the room
          </div>
          <span className="card-meta">{meeting.participants.length}</span>
        </div>
        <ul className="people">
          {meeting.participants.map((p, i) => (
            <li key={`${p.name}-${i}`}>
              <div className="ppl-avatar" style={{ background: p.color }}>
                {p.initials}
              </div>
              <div className="ppl-info">
                <div className="ppl-name">{p.name}</div>
                <div className="ppl-role">{p.role}</div>
              </div>
              {p.side === "client" && i === 0 && (
                <div className="ppl-speaking" title="Currently speaking">
                  <span className="wave-bar" style={{ animationDelay: "0ms" }} />
                  <span className="wave-bar" style={{ animationDelay: "120ms" }} />
                  <span className="wave-bar" style={{ animationDelay: "240ms" }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-title">
            <Notebook size={16} /> Pinned context
          </div>
          <button type="button" className="ghost-btn">+ Add</button>
        </div>
        <ul className="ctx-list">
          {meeting.contextItems.map((c, i) => (
            <li key={`${c.label}-${i}`}>
              <div className={`ctx-icon ctx-${c.kind}`}>
                {c.kind === "url" ? <Globe size={14} /> : c.kind === "doc" ? <Doc size={14} /> : <Brain size={14} />}
              </div>
              <div>
                <div className="ctx-label">{c.label}</div>
                {c.note && <div className="ctx-note">{c.note}</div>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
