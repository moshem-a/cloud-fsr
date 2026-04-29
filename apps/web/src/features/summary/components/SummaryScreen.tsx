import type { MeetingSummary } from "@scoach/types";
import { useToast } from "@scoach/ui";
import { Brain, Check, Chev, Copy, Notebook, Send, Share } from "@scoach/ui/icons";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { summaryApi } from "../api.ts";
import { ClientEmail } from "./ClientEmail.tsx";
import { FullTranscript } from "./FullTranscript.tsx";
import { InternalSummary } from "./InternalSummary.tsx";
import { ShareModal } from "./ShareModal.tsx";

type Tab = "internal" | "client" | "transcript";

export interface SummaryScreenProps {
  meetingId: string;
}

export function SummaryScreen({ meetingId }: SummaryScreenProps) {
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("internal");
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    summaryApi
      .fetchSummary(meetingId)
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch((err) => {
        if (!cancelled) toast.push({ tone: "error", message: (err as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [meetingId, toast]);

  function exportPdf() {
    window.open(summaryApi.exportPdf(meetingId), "_blank", "noopener");
  }

  if (!summary) {
    return (
      <div style={{ padding: 32, color: "var(--text-3)" }}>Generating summary…</div>
    );
  }

  return (
    <div className="summary">
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="icon-btn"
            onClick={() => nav({ to: "/dashboard" })}
            aria-label="Back"
          >
            <Chev size={18} style={{ transform: "rotate(180deg)" }} />
          </button>
          <div className="brand">
            <img src="/supercloud-mark.svg" alt="" width={28} height={28} />
            <div className="brand-text">
              <div className="brand-name">Meeting summary</div>
              <div className="brand-sub">
                {summary.meeting.client} · {new Date(summary.meeting.date).toLocaleDateString()} · {summary.meeting.duration}
              </div>
            </div>
          </div>
        </div>
        <div className="topbar-center">
          <div className="seg seg-tabs">
            <button type="button" className={tab === "internal" ? "on" : ""} onClick={() => setTab("internal")}>
              <Brain size={14} /> Internal summary
            </button>
            <button type="button" className={tab === "client" ? "on" : ""} onClick={() => setTab("client")}>
              <Send size={14} /> Client email
            </button>
            <button type="button" className={tab === "transcript" ? "on" : ""} onClick={() => setTab("transcript")}>
              <Notebook size={14} /> Full transcript
            </button>
          </div>
        </div>
        <div className="topbar-right">
          <button type="button" className="ghost-btn" onClick={exportPdf}>
            <Copy size={14} /> Export PDF
          </button>
          <button type="button" className="pill-btn" onClick={() => setShareOpen(true)}>
            <Share size={14} /> Share
          </button>
          <div className="avatar-me">NL</div>
        </div>
      </header>

      <div className="sum-end-banner">
        <div className="sum-end-icon">
          <Check size={18} />
        </div>
        <div>
          <div className="sum-end-title">
            Meeting ended · summaries generated in {(summary.generationLatencyMs / 1000).toFixed(1)}s
          </div>
          <div className="sum-end-sub">
            Audio discarded per privacy policy. Transcript and summary stored in your workspace.
          </div>
        </div>
        <div className="sum-end-actions">
          <button type="button" className="ghost-btn">Undo end</button>
        </div>
      </div>

      <div className="sum-body">
        {tab === "internal" && <InternalSummary summary={summary} />}
        {tab === "client" && <ClientEmail summary={summary} onSummaryChange={setSummary} />}
        {tab === "transcript" && <FullTranscript />}
      </div>

      {shareOpen && (
        <ShareModal summary={summary} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
