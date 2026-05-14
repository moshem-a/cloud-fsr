import { Chev, Image } from "@scoach/ui/icons";
import { useCallback, useEffect } from "react";

import { api } from "../../../../lib/http.ts";
import { useLiveMeetingStore } from "../store.ts";

export interface InfographicImagePanelProps {
  meetingId: string;
}

export function InfographicImagePanel({ meetingId }: InfographicImagePanelProps) {
  const images = useLiveMeetingStore((s) => s.infographicImages);
  const activeIndex = useLiveMeetingStore((s) => s.activeImageIndex);
  const setIndex = useLiveMeetingStore((s) => s.setActiveImageIndex);
  const interval = useLiveMeetingStore((s) => s.imageIntervalMin);
  const setImageInterval = useLiveMeetingStore((s) => s.setImageIntervalMin);

  const count = images.length;
  const safeIndex = count > 0 ? Math.min(activeIndex, count - 1) : 0;
  const current = count > 0 ? images[safeIndex] : null;

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

  function handleIntervalChange(min: number) {
    setImageInterval(min);
    void api(`/meetings/${meetingId}/infographic-interval`, {
      method: "PATCH",
      body: { intervalMin: min },
    }).catch(() => {});
  }

  const intervalSlider = (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-4)" }}>
      <span>Every</span>
      <input
        type="range"
        min={2}
        max={30}
        step={1}
        value={interval}
        onChange={(e) => handleIntervalChange(Number(e.target.value))}
        style={{ width: 70, accentColor: "var(--gc-blue)" }}
        title={`Generate infographic every ${interval} minutes`}
      />
      <span className="mono">{interval}m</span>
    </div>
  );

  if (count === 0) {
    return (
      <div className="ig-empty">
        <Image size={28} color="var(--text-4)" />
        <div className="ig-empty-title">Infographic</div>
        <div className="ig-empty-sub">
          AI-generated visual summaries will appear at regular intervals
        </div>
        <div style={{ marginTop: 12 }}>{intervalSlider}</div>
      </div>
    );
  }

  return (
    <div className="infographic-panel">
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 12px 0" }}>
        {intervalSlider}
      </div>

      {current && (
        <div className="ig-carousel">
          <button
            type="button"
            className="ig-nav ig-nav-prev"
            onClick={prev}
            disabled={safeIndex === 0}
            aria-label="Previous"
          >
            <Chev size={16} style={{ transform: "rotate(180deg)" }} />
          </button>

          <div className="ig-carousel-slide" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <img
              src={current.imageUrl ?? `data:${current.mimeType};base64,${current.imageBase64}`}
              alt={current.prompt}
              style={{ maxWidth: "100%", maxHeight: 400, borderRadius: 8, objectFit: "contain" }}
            />
          </div>

          <button
            type="button"
            className="ig-nav ig-nav-next"
            onClick={next}
            disabled={safeIndex >= count - 1}
            aria-label="Next"
          >
            <Chev size={16} />
          </button>
        </div>
      )}

      {count > 1 && (
        <div className="ig-dots">
          <span className="ig-counter mono">{safeIndex + 1} of {count}</span>
          <div className="ig-dot-row">
            {images.map((_, i) => (
              <button
                key={images[i]!.id}
                type="button"
                className={`ig-dot${i === safeIndex ? " active" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
