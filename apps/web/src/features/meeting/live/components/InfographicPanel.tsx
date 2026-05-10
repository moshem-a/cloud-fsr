import { Chart, Chev } from "@scoach/ui/icons";
import { useCallback, useEffect } from "react";

import { useLiveMeetingStore } from "../store.ts";
import { InfographicCard } from "./InfographicCard.tsx";

export function InfographicPanel() {
  const infographics = useLiveMeetingStore((s) => s.infographics);
  const activeIndex = useLiveMeetingStore((s) => s.activeInfographicIndex);
  const setIndex = useLiveMeetingStore((s) => s.setActiveInfographicIndex);
  const quietIg = useLiveMeetingStore((s) => s.quietInfographic);

  const count = infographics.length;
  const safeIndex = count > 0 ? Math.min(activeIndex, count - 1) : 0;
  const current = count > 0 ? infographics[safeIndex] : null;

  const prev = useCallback(() => {
    if (safeIndex > 0) setIndex(safeIndex - 1);
  }, [safeIndex, setIndex]);

  const next = useCallback(() => {
    if (safeIndex < count - 1) setIndex(safeIndex + 1);
  }, [safeIndex, count, setIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  if (count === 0 && !quietIg) {
    return (
      <div className="ig-empty">
        <Chart size={28} color="var(--text-4)" />
        <div className="ig-empty-title">Infographics</div>
        <div className="ig-empty-sub">Visual diagrams will appear as the conversation develops</div>
      </div>
    );
  }

  return (
    <div className="infographic-panel">
      {quietIg && (
        <div className="ig-quiet-pin">
          <InfographicCard infographic={quietIg} badge="Urgent" />
        </div>
      )}

      {current && (
        <div className="ig-carousel">
          <button
            type="button"
            className="ig-nav ig-nav-prev"
            onClick={prev}
            disabled={safeIndex === 0}
            aria-label="Previous infographic"
          >
            <Chev size={16} style={{ transform: "rotate(180deg)" }} />
          </button>

          <div className="ig-carousel-slide">
            <InfographicCard infographic={current} />
          </div>

          <button
            type="button"
            className="ig-nav ig-nav-next"
            onClick={next}
            disabled={safeIndex >= count - 1}
            aria-label="Next infographic"
          >
            <Chev size={16} />
          </button>
        </div>
      )}

      {count > 1 && (
        <div className="ig-dots">
          <span className="ig-counter mono">{safeIndex + 1} of {count}</span>
          <div className="ig-dot-row">
            {infographics.map((_, i) => (
              <button
                key={infographics[i]!.id}
                type="button"
                className={`ig-dot${i === safeIndex ? " active" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Go to infographic ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
