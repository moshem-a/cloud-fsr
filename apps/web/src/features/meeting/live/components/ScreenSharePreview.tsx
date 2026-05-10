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
  /** Stop the active screen share (mic stays running). */
  onStopShare?: () => void;
  /** True when the rep's mic is being captured (separate from the tab stream). */
  micCapturing?: boolean;
  /** Error from mic capture (e.g. permission denied). */
  micError?: string | null;
}

/**
 * Screen-share is OPTIONAL — when there's no stream, render a small
 * unobtrusive panel with a single button. No prominent CTA on meeting start.
 * When `stream` is set: live <video> + audio dB readout.
 */
export function ScreenSharePreview({
  stream,
  rmsDb,
  error,
  onPickSource,
  onStopShare,
  micCapturing,
  micError,
}: ScreenSharePreviewProps) {
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
            <span>{micCapturing ? "Mic only" : "No capture"}</span>
          </div>
          <button
            type="button"
            className="pill-btn"
            onClick={onPickSource}
            style={{ fontSize: 12, background: "var(--gc-red, #d93025)", borderColor: "var(--gc-red, #d93025)", color: "#fff" }}
          >
            {micCapturing ? "Add screen share" : "Share screen"}
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-4)" }}>
          Optional — adds the customer audio from a shared Chrome tab. Your mic
          works without it.
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
        <span className="share-status" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="dot" style={{ background: "var(--gc-green)" }} /> Tab
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Mic size={11} />
            <span
              className="dot"
              style={{
                background: micCapturing
                  ? "var(--gc-green)"
                  : micError
                    ? "var(--gc-red, #b00020)"
                    : "var(--text-4)",
              }}
              title={
                micCapturing
                  ? "Your mic is being transcribed"
                  : micError
                    ? `Mic disabled: ${micError}`
                    : "Mic not active"
              }
            />
            Mic
          </span>
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
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="ghost-btn" onClick={onPickSource}>
            Switch
          </button>
          {onStopShare && (
            <button type="button" className="ghost-btn" onClick={onStopShare}>
              Stop
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
