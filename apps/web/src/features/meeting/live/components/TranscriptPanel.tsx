import { MicOff, Search } from "@scoach/ui/icons";
import { useEffect, useMemo, useRef, useState } from "react";

import { useLiveMeetingStore } from "../store.ts";
import { QuietBar } from "./QuietBar.tsx";
import { TranscriptLine } from "./TranscriptLine.tsx";

export interface TranscriptPanelProps {
  meetingId: string;
}

type Filter = "all" | "client" | "rep";

export function TranscriptPanel({ meetingId }: TranscriptPanelProps) {
  const transcript = useLiveMeetingStore((s) => s.transcript);
  const lang = useLiveMeetingStore((s) => s.langMode);
  const muted = useLiveMeetingStore((s) => s.muted);
  const listening = useLiveMeetingStore((s) => s.listening);
  const sttError = useLiveMeetingStore((s) => s.sttError);
  const livePartial = useLiveMeetingStore((s) => s.livePartial);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript.length]);

  const visible = useMemo(
    () =>
      transcript.filter((l) => {
        if (filter === "client" && l.speaker !== "client") return false;
        if (filter === "rep" && l.speaker !== "rep") return false;
        if (search) {
          const q = search.toLowerCase();
          if (!`${l.text} ${l.trans ?? ""}`.toLowerCase().includes(q)) return false;
        }
        return true;
      }),
    [transcript, filter, search],
  );

  return (
    <section className="panel transcript-panel">
      <div className="panel-head">
        <div className="panel-title-row">
          <h2 className="panel-title">Live transcript</h2>
        </div>
        <div className="panel-actions">
          <div className="search-box">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search transcript…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="seg seg-sm">
            <button type="button" className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>
              All
            </button>
            <button type="button" className={filter === "client" ? "on" : ""} onClick={() => setFilter("client")}>
              Client
            </button>
            <button type="button" className={filter === "rep" ? "on" : ""} onClick={() => setFilter("rep")}>
              You
            </button>
          </div>
        </div>
      </div>

      {sttError && (
        <div
          style={{
            padding: "8px 12px",
            margin: "8px 12px 0",
            borderRadius: 6,
            background: "var(--gc-red-50, #fdecea)",
            color: "var(--gc-red, #b00020)",
            fontSize: 13,
            border: "1px solid var(--gc-red, #b00020)",
          }}
        >
          Transcription unavailable: {sttError}
        </div>
      )}

      <div className="transcript-scroll scroll" ref={scrollRef}>
        {visible.map((l) => (
          <TranscriptLine key={l.id} line={l} lang={lang} />
        ))}

        {livePartial && (
          <div
            style={{
              padding: "8px 14px",
              margin: "4px 12px 8px",
              borderLeft: "2px dashed var(--text-4)",
              color: "var(--text-3)",
              fontStyle: "italic",
              fontSize: 14,
              lineHeight: 1.45,
              opacity: 0.85,
            }}
            title="Live partial transcript — being revised in real time"
          >
            {livePartial}
            <span className="dot dot-pulse" style={{ marginLeft: 6, background: "var(--text-4)" }} />
          </div>
        )}

        {muted ? (
          <div className="t-muted-row">
            <MicOff size={14} /> Listening paused — hint generation suspended. Audio still captured locally.
          </div>
        ) : !listening ? (
          <div className="t-typing">
            <div className="t-typing-bubble">
              <span className="t-typing-label" style={{ color: "var(--text-3)" }}>
                Take notes here. Live transcription is optional — enable it from the left rail any time.
              </span>
            </div>
          </div>
        ) : transcript.length === 0 ? (
          <div className="t-typing">
            <div className="t-typing-bubble">
              <span className="dot dot-pulse" style={{ background: "var(--text-3)" }} />
              <span className="dot dot-pulse" style={{ background: "var(--text-3)", animationDelay: "150ms" }} />
              <span className="dot dot-pulse" style={{ background: "var(--text-3)", animationDelay: "300ms" }} />
              <span className="t-typing-label">Listening for speech…</span>
            </div>
          </div>
        ) : null}
      </div>

      <QuietBar meetingId={meetingId} />
    </section>
  );
}
