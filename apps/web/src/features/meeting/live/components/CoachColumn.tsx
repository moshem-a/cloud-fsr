import { Question, Spark } from "@scoach/ui/icons";
import { useEffect, useMemo, useRef } from "react";

import { api } from "../../../../lib/http.ts";
import { useLiveMeetingStore } from "../store.ts";
import { FollowupList } from "./FollowupList.tsx";
import { HintCard } from "./HintCard.tsx";

export interface CoachColumnProps {
  meetingId: string;
}

export function CoachColumn({ meetingId }: CoachColumnProps) {
  const hints = useLiveMeetingStore((s) => s.hints);
  const pinnedIds = useLiveMeetingStore((s) => s.pinnedHintIds);
  const threshold = useLiveMeetingStore((s) => s.hintThreshold);
  const setThreshold = useLiveMeetingStore((s) => s.setHintThreshold);
  const togglePinned = useLiveMeetingStore((s) => s.togglePinned);
  const followupSets = useLiveMeetingStore((s) => s.followupSets);
  const followupCount = followupSets[followupSets.length - 1]?.items.length ?? 0;
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => hints.filter((h) => h.confidence >= threshold),
    [hints, threshold],
  );

  const pinned = useMemo(
    () => filtered.filter((h) => pinnedIds.has(h.id)),
    [filtered, pinnedIds],
  );

  const unpinned = useMemo(
    () => filtered.filter((h) => !pinnedIds.has(h.id)),
    [filtered, pinnedIds],
  );

  useEffect(() => {
    if (scrollRef.current && unpinned.length > 0) {
      scrollRef.current.scrollTop = 0;
    }
  }, [unpinned.length]);

  const setRightTab = useLiveMeetingStore((s) => s.setRightPanelTab);
  const setGenerating = useLiveMeetingStore((s) => s.setInfographicGenerating);

  function handlePin(hintId: string) {
    const hint = hints.find((h) => h.id === hintId);
    const wasPinned = pinnedIds.has(hintId);
    togglePinned(hintId);
    if (!wasPinned && hint) {
      setGenerating(true);
      setRightTab("infographic");
      void api(`/meetings/${meetingId}/generate-infographic`, {
        method: "POST",
        body: { hintTopic: hint.title },
      }).catch(() => {
        setGenerating(false);
      });
    }
  }

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__sallyPinHint = handlePin;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { delete (window as any).__sallyPinHint; };
  });

  return (
    <section className="panel coach-panel coach-hero">
      <section className="panel" style={{ minHeight: 0 }}>
        <div className="panel-head">
          <div className="panel-title-row" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
            <div className="seg seg-tabs" style={{ pointerEvents: "none", flex: 1 }}>
              <button type="button" className="on">
                <Spark size={14} /> Live coaching <span className="tab-count">{filtered.length}</span>
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-4)" }}>
              <span>Min</span>
              <input
                type="range"
                min={0.5}
                max={1}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                style={{ width: 60, accentColor: "var(--gc-blue)" }}
                title={`Confidence threshold: ${Math.round(threshold * 100)}%`}
              />
              <span className="mono">{Math.round(threshold * 100)}%</span>
            </div>
          </div>
        </div>

        {pinned.length > 0 && (
          <div className="coach-pinned">
            {pinned.map((h) => (
              <HintCard key={h.id} hint={h} meetingId={meetingId} />
            ))}
          </div>
        )}

        <div className="coach-scroll scroll" ref={scrollRef}>
          {filtered.length === 0 && (
            <div className="hint-thinking hint-in">
              <div className="ht-row">
                <span className="dot dot-pulse" style={{ background: "var(--gc-blue)" }} />
                <span className="dot dot-pulse" style={{ background: "var(--gc-blue)", animationDelay: "160ms" }} />
                <span className="dot dot-pulse" style={{ background: "var(--gc-blue)", animationDelay: "320ms" }} />
                <span className="ht-label">Listening for the conversation…</span>
              </div>
            </div>
          )}
          {unpinned.map((h, i) => (
            <HintCard key={h.id} hint={h} meetingId={meetingId} style={i === 0 ? undefined : { animationDelay: "0ms" }} />
          ))}
        </div>
      </section>

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
