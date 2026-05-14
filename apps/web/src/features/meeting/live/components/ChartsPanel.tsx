import { Chart, Chev, Pin } from "@scoach/ui/icons";
import { useCallback, useEffect, useMemo } from "react";

import { useLiveMeetingStore } from "../store.ts";
import { InfographicCard } from "./InfographicCard.tsx";

export function ChartsPanel() {
  const infographics = useLiveMeetingStore((s) => s.infographics);
  const activeIndex = useLiveMeetingStore((s) => s.activeInfographicIndex);
  const setIndex = useLiveMeetingStore((s) => s.setActiveInfographicIndex);
  const quietIg = useLiveMeetingStore((s) => s.quietInfographic);
  const pinnedChartIds = useLiveMeetingStore((s) => s.pinnedChartIds);
  const togglePinnedChart = useLiveMeetingStore((s) => s.togglePinnedChart);

  const pinnedCharts = useMemo(
    () => infographics.filter((ig) => pinnedChartIds.has(ig.id)),
    [infographics, pinnedChartIds],
  );
  const unpinnedCharts = useMemo(
    () => infographics.filter((ig) => !pinnedChartIds.has(ig.id)),
    [infographics, pinnedChartIds],
  );

  const count = unpinnedCharts.length;
  const safeIndex = count > 0 ? Math.min(activeIndex, count - 1) : 0;
  const current = count > 0 ? unpinnedCharts[safeIndex] : null;

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

  if (infographics.length === 0 && !quietIg) {
    return (
      <div className="ig-empty">
        <Chart size={28} color="var(--text-4)" />
        <div className="ig-empty-title">Charts</div>
        <div className="ig-empty-sub">Mermaid diagrams will appear when relevant topics are discussed</div>
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

      {pinnedCharts.length > 0 && (
        <div className="coach-pinned" style={{ padding: "8px 8px 4px" }}>
          {pinnedCharts.map((ig) => (
            <div key={ig.id} style={{ position: "relative" }}>
              <InfographicCard infographic={ig} badge="Pinned" />
              <button
                type="button"
                className="icon-btn xs active"
                style={{ position: "absolute", top: 6, right: 6 }}
                onClick={() => togglePinnedChart(ig.id)}
                title="Unpin"
              >
                <Pin size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {current && (
        <div className="ig-carousel">
          <button
            type="button"
            className="ig-nav ig-nav-prev"
            onClick={prev}
            disabled={safeIndex === 0}
            aria-label="Previous chart"
          >
            <Chev size={16} style={{ transform: "rotate(180deg)" }} />
          </button>

          <div className="ig-carousel-slide" style={{ position: "relative" }}>
            <InfographicCard infographic={current} />
            <button
              type="button"
              className="icon-btn xs"
              style={{ position: "absolute", top: 6, right: 6 }}
              onClick={() => togglePinnedChart(current.id)}
              title="Pin chart"
            >
              <Pin size={12} />
            </button>
          </div>

          <button
            type="button"
            className="ig-nav ig-nav-next"
            onClick={next}
            disabled={safeIndex >= count - 1}
            aria-label="Next chart"
          >
            <Chev size={16} />
          </button>
        </div>
      )}

      {count > 1 && (
        <div className="ig-dots">
          <span className="ig-counter mono">{safeIndex + 1} of {count}</span>
          <div className="ig-dot-row">
            {unpinnedCharts.map((_, i) => (
              <button
                key={unpinnedCharts[i]!.id}
                type="button"
                className={`ig-dot${i === safeIndex ? " active" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Go to chart ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
