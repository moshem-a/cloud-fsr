import type { InfographicImage } from "@scoach/types";
import { Chev, Close, Expand, Image } from "@scoach/ui/icons";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../../../../lib/http.ts";
import { useLiveMeetingStore } from "../store.ts";

const API_BASE = import.meta.env.VITE_API_BASE_URL === undefined
  ? "http://localhost:8080"
  : (import.meta.env.VITE_API_BASE_URL as string);

function imgSrc(img: InfographicImage): string {
  if (img.imageUrl) {
    if (img.imageUrl.startsWith("http")) return img.imageUrl;
    return `${API_BASE}${img.imageUrl}`;
  }
  return `data:${img.mimeType};base64,${img.imageBase64}`;
}

export interface InfographicImagePanelProps {
  meetingId: string;
}

export function InfographicImagePanel({ meetingId }: InfographicImagePanelProps) {
  const images = useLiveMeetingStore((s) => s.infographicImages);
  const activeIndex = useLiveMeetingStore((s) => s.activeImageIndex);
  const setIndex = useLiveMeetingStore((s) => s.setActiveImageIndex);
  const interval = useLiveMeetingStore((s) => s.imageIntervalMin);
  const setImageInterval = useLiveMeetingStore((s) => s.setImageIntervalMin);
  const generating = useLiveMeetingStore((s) => s.infographicGenerating);
  const setGenerating = useLiveMeetingStore((s) => s.setInfographicGenerating);

  const prevCountRef = useRef(images.length);
  useEffect(() => {
    if (images.length > prevCountRef.current && generating) {
      setGenerating(false);
    }
    prevCountRef.current = images.length;
  }, [images.length, generating, setGenerating]);

  const [expanded, setExpanded] = useState(false);

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
      if (e.key === "Escape" && expanded) { setExpanded(false); return; }
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, expanded]);

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

  const loadingBar = generating && (
    <div className="ig-generating">
      <div className="ig-generating-inner">
        <span className="dot dot-pulse" style={{ background: "var(--gc-blue)" }} />
        <span className="dot dot-pulse" style={{ background: "var(--gc-blue)", animationDelay: "160ms" }} />
        <span className="dot dot-pulse" style={{ background: "var(--gc-blue)", animationDelay: "320ms" }} />
        <span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: 4 }}>Generating infographic…</span>
      </div>
    </div>
  );

  if (count === 0) {
    return (
      <div className="ig-empty">
        {generating ? (
          <>
            <div className="ig-generating-hero">
              <span className="dot dot-pulse" style={{ background: "var(--gc-blue)", width: 10, height: 10 }} />
              <span className="dot dot-pulse" style={{ background: "var(--gc-blue)", width: 10, height: 10, animationDelay: "160ms" }} />
              <span className="dot dot-pulse" style={{ background: "var(--gc-blue)", width: 10, height: 10, animationDelay: "320ms" }} />
            </div>
            <div className="ig-empty-title">Generating Infographic…</div>
            <div className="ig-empty-sub">
              AI is creating a visual summary based on the pinned hint
            </div>
          </>
        ) : (
          <>
            <Image size={28} color="var(--text-4)" />
            <div className="ig-empty-title">Infographic</div>
            <div className="ig-empty-sub">
              AI-generated visual summaries will appear at regular intervals
            </div>
          </>
        )}
        <div style={{ marginTop: 12 }}>{intervalSlider}</div>
      </div>
    );
  }

  return (
    <div className="infographic-panel">
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 12px 0" }}>
        {intervalSlider}
      </div>
      {loadingBar}

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

          <div className="ig-carousel-slide" style={{ display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
            <img
              src={imgSrc(current)}
              alt={current.prompt}
              style={{ maxWidth: "100%", maxHeight: 400, borderRadius: 8, objectFit: "contain", cursor: "pointer" }}
              onDoubleClick={() => setExpanded(true)}
            />
            <button
              type="button"
              className="ig-expand-btn"
              onClick={() => setExpanded(true)}
              title="Expand image"
            >
              <Expand size={14} />
            </button>
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

      {expanded && current && (
        <div className="ig-lightbox" onClick={() => setExpanded(false)}>
          <button type="button" className="ig-lightbox-close" onClick={() => setExpanded(false)} aria-label="Close">
            <Close size={20} />
          </button>
          <img
            src={imgSrc(current)}
            alt={current.prompt}
            className="ig-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
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
