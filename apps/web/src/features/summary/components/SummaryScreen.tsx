import type { MeetingSummary } from "@scoach/types";
import { useToast } from "@scoach/ui";
import { Brain, Check, Chev, Copy, Notebook, Send, Share } from "@scoach/ui/icons";
import { Link, useNavigate } from "@tanstack/react-router";
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
    let pollTimer: ReturnType<typeof setTimeout>;

    async function load() {
      try {
        const s = await summaryApi.fetchSummary(meetingId);
        if (!cancelled) setSummary(s);
      } catch {
        try {
          await summaryApi.triggerSummarize(meetingId);
        } catch {}
        const poll = () => {
          if (cancelled) return;
          pollTimer = setTimeout(async () => {
            try {
              const s = await summaryApi.fetchSummary(meetingId);
              if (!cancelled) setSummary(s);
            } catch {
              poll();
            }
          }, 3000);
        };
        poll();
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
    };
  }, [meetingId]);

  async function exportPdf() {
    try {
      const blob = await summaryApi.exportPdf(meetingId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const slug = (summary?.meeting.client ?? "meeting").replace(/\W+/g, "-").toLowerCase();
      a.download = `summary-${slug}-${meetingId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast.push({ tone: "error", message: (err as Error).message });
    }
  }

  if (!summary) {
    return <SummaryLoadingOverlay />;
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
          <Link to="/dashboard" className="brand brand-link">
            <img src="/supercloud-mark.svg" alt="Sally" width={28} height={28} />
            <div className="brand-text">
              <div className="brand-name">Meeting summary</div>
              <div className="brand-sub">
                {summary.meeting.client} · {new Date(summary.meeting.date).toLocaleDateString()} · {summary.meeting.duration}
              </div>
            </div>
          </Link>
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
        {tab === "internal" && <InternalSummary summary={summary} onSummaryChange={setSummary} />}
        {tab === "client" && <ClientEmail summary={summary} onSummaryChange={setSummary} />}
        {tab === "transcript" && <FullTranscript meetingId={meetingId} />}
      </div>

      {shareOpen && (
        <ShareModal summary={summary} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}

function SummaryLoadingOverlay() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const next = Math.min(90, 90 * (1 - Math.exp(-elapsed / 5)));
      setPct(Math.round(next));
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 400,
        gap: 24,
        padding: 32,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: "linear-gradient(135deg, #4285f4, #a855f7, #ec4899)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "summaryPulse 2s ease-in-out infinite",
        }}
      >
        <Brain size={32} style={{ color: "#fff" }} />
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-1)" }}>
          Generating Meeting Summary
        </div>
        <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>
          Analyzing meeting transcript...
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 320 }}>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: "var(--surface-2, #e5e7eb)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 4,
              background: "linear-gradient(90deg, #4285f4, #a855f7, #ec4899)",
              width: `${pct}%`,
              transition: "width 0.3s ease-out",
            }}
          />
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-2)",
            marginTop: 8,
          }}
        >
          {pct}%
        </div>
      </div>

      <style>{`
        @keyframes summaryPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
