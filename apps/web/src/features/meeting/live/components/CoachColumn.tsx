import { Filter, Question, Spark, Trend } from "@scoach/ui/icons";
import { useState } from "react";

import { useLiveMeetingStore } from "../store.ts";
import { FollowupList } from "./FollowupList.tsx";
import { HintCard } from "./HintCard.tsx";
import { SentimentView } from "./SentimentView.tsx";

type Tab = "hints" | "followups" | "sentiment";

export interface CoachColumnProps {
  meetingId: string;
}

export function CoachColumn({ meetingId }: CoachColumnProps) {
  const hints = useLiveMeetingStore((s) => s.hints);
  const followups = useLiveMeetingStore((s) => s.followups);
  const [tab, setTab] = useState<Tab>("hints");

  return (
    <section className="panel coach-panel">
      <div className="panel-head">
        <div className="seg seg-tabs">
          <button type="button" className={tab === "hints" ? "on" : ""} onClick={() => setTab("hints")}>
            <Spark size={14} /> Hints <span className="tab-count">{hints.length}</span>
          </button>
          <button type="button" className={tab === "followups" ? "on" : ""} onClick={() => setTab("followups")}>
            <Question size={14} /> Follow-ups <span className="tab-count">{followups.length}</span>
          </button>
          <button type="button" className={tab === "sentiment" ? "on" : ""} onClick={() => setTab("sentiment")}>
            <Trend size={14} /> Sentiment
          </button>
        </div>
        <button type="button" className="ghost-btn">
          <Filter size={14} /> Filter
        </button>
      </div>

      <div className="coach-scroll scroll">
        {tab === "hints" && (
          <>
            {hints.map((h, i) => (
              <HintCard key={h.id} hint={h} meetingId={meetingId} style={{ animationDelay: `${i * 60}ms` }} />
            ))}
            <div className="hint-thinking hint-in">
              <div className="ht-row">
                <span className="dot dot-pulse" style={{ background: "var(--gc-blue)" }} />
                <span className="dot dot-pulse" style={{ background: "var(--gc-blue)", animationDelay: "160ms" }} />
                <span className="dot dot-pulse" style={{ background: "var(--gc-blue)", animationDelay: "320ms" }} />
                <span className="ht-label">Listening for new entities…</span>
              </div>
            </div>
          </>
        )}

        {tab === "followups" && <FollowupList />}
        {tab === "sentiment" && <SentimentView />}
      </div>
    </section>
  );
}
