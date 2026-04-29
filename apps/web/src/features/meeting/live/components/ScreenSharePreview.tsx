import { Close, Mic, Monitor } from "@scoach/ui/icons";
import { useEffect, useRef } from "react";

export interface ScreenSharePreviewProps {
  /** The MediaStream from getDisplayMedia. Null until audio capture starts. */
  stream: MediaStream | null;
  /** RMS dB for the live capture. */
  rmsDb: number;
  /** True when capture failed or hasn't been started yet. */
  error: string | null;
  /** Click handler for the Pick source / Switch button. */
  onPickSource: () => void;
}

/**
 * Screen-share is OPTIONAL — when there's no stream, render a small
 * unobtrusive panel with a single button. No prominent CTA on meeting start.
 * When `stream` is set: live <video> + audio dB readout.
 */
export function ScreenSharePreview({ stream, rmsDb, error, onPickSource }: ScreenSharePreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  // Compact passive state — no big CTA, no nag.
  if (!stream) {
    return (
      <section className="share-card" style={{ padding: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-3)", fontSize: 13 }}>
            <Monitor size={14} />
            <span>Live transcription off</span>
          </div>
          <button
            type="button"
            className="ghost-btn"
            onClick={onPickSource}
            style={{ fontSize: 12 }}
          >
            Share tab audio
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--gc-red, #b00020)" }}>
            {error}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="share-card">
      <div className="share-head">
        <div className="share-title">
          <Monitor size={14} /> Shared meeting window
        </div>
        <span className="share-status">
          <span className="dot" style={{ background: "var(--gc-green)" }} /> Capturing audio
        </span>
      </div>

      <div className="share-frame">
        <video ref={videoRef} autoPlay muted playsInline className="share-video" />
        <div className="share-toolbar">
          <span className="share-tool-pill">
            <Mic size={12} />
          </span>
          <span className="share-tool-pill">
            <Monitor size={12} />
          </span>
          <span className="share-tool-pill end">
            <Close size={12} />
          </span>
          <span className="share-tool-time">{Math.round(rmsDb)} dB</span>
        </div>
      </div>

      <div className="share-foot">
        <span className="share-source">
          Source: <span className="mono">Captured stream · 16 kHz mono PCM</span>
        </span>
        <button type="button" className="ghost-btn" onClick={onPickSource}>
          Switch
        </button>
      </div>
    </section>
  );
}
