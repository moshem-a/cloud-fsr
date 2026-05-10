import { Question, Spark } from "@scoach/ui/icons";
import { useEffect, useRef } from "react";

import { useLiveMeetingStore } from "../store.ts";
import { FollowupList } from "./FollowupList.tsx";
import { HintCard } from "./HintCard.tsx";

export interface CoachColumnProps {
  meetingId: string;
}

export function CoachColumn({ meetingId }: CoachColumnProps) {
  const hints = useLiveMeetingStore((s) => s.hints);
  const followupSets = useLiveMeetingStore((s) => s.followupSets);
  const followupCount = followupSets[followupSets.length - 1]?.items.length ?? 0;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && hints.length > 0) {
      scrollRef.current.scrollTop = 0;
    }
  }, [hints.length]);

  return (
    <section className="panel coach-panel coach-hero">
      {/* Hints — top, scrollable, newest first */}
      <section className="panel" style={{ minHeight: 0 }}>
        <div className="panel-head">
          <div className="seg seg-tabs" style={{ pointerEvents: "none" }}>
            <button type="button" className="on">
              <Spark size={14} /> Live coaching <span className="tab-count">{hints.length}</span>
            </button>
          </div>
        </div>
        <div className="coach-scroll scroll" ref={scrollRef}>
          {hints.length === 0 && (
            <div className="hint-thinking hint-in">
              <div className="ht-row">
                <span className="dot dot-pulse" style={{ background: "var(--gc-blue)" }} />
                <span className="dot dot-pulse" style={{ background: "var(--gc-blue)", animationDelay: "160ms" }} />
                <span className="dot dot-pulse" style={{ background: "var(--gc-blue)", animationDelay: "320ms" }} />
                <span className="ht-label">Listening for the conversation…</span>
              </div>
            </div>
          )}
          {hints.map((h, i) => (
            <HintCard key={h.id} hint={h} meetingId={meetingId} style={i === 0 ? undefined : { animationDelay: "0ms" }} />
          ))}
        </div>
      </section>

      {/* Follow-ups — bottom, always visible, with history below the latest set */}
      <section className="panel coach-hero-followups">
        <div className="panel-head">
          <div className="seg seg-tabs" style={{ pointerEvents: "none" }}>
            <button type="button" className="on">
              <Question size={14} /> Suggested follow-ups <span className="tab-count">{followupCount}</span>
            </button>
          </div>
        </div>
        <div className="fu-scroll">
          <FollowupList />
        </div>
      </section>
    </section>
  );
}
