import { Bolt } from "@scoach/ui/icons";
import { useEffect, useRef } from "react";

import { useLiveMeetingStore } from "../store.ts";

function formatTime(epoch: number): string {
  const d = new Date(epoch);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function LiveTipsPanel() {
  const tips = useLiveMeetingStore((s) => s.liveTips);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && tips.length > 0) {
      scrollRef.current.scrollTop = 0;
    }
  }, [tips.length]);

  return (
    <section className="card tips-rail-card">
      <div className="card-head">
        <div className="card-title">
          <Bolt size={16} /> Live tips
        </div>
        {tips.length > 0 && <span className="card-meta mono">{tips.length}</span>}
      </div>
      {tips.length === 0 ? (
        <div className="tips-empty">
          Tips from your AI coach will appear here as the conversation progresses.
        </div>
      ) : (
        <div className="tips-scroll" ref={scrollRef}>
          {tips.map((tip) => (
            <div key={tip.id} className="tip-item tip-in">
              <span className="tip-text">{tip.text}</span>
              <span className="tip-time mono">{formatTime(tip.at)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
