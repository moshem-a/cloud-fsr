import type { MeetingSummary } from "@scoach/types";
import { useToast } from "@scoach/ui";
import { Alert, Check, Copy, Doc, Globe, Spark } from "@scoach/ui/icons";
import { useState } from "react";

import { summaryApi } from "../api.ts";
import { ReferenceLinks } from "./ReferenceLinks.tsx";

export interface ClientEmailProps {
  summary: MeetingSummary;
  onSummaryChange: (s: MeetingSummary) => void;
}

function formatBodyParagraph(html: string): string {
  return html
    .replace(/^\*\*(.*?)\*\*/m, "<strong>$1</strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

export function ClientEmail({ summary, onSummaryChange }: ClientEmailProps) {
  const e = summary.client;
  const [tone, setTone] = useState<typeof e.tone>(e.tone ?? "warm");
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const toast = useToast();

  async function changeTone(next: typeof tone) {
    if (next === tone) return;
    setTone(next);
    setRegenerating(true);
    try {
      const fresh = await summaryApi.regenerateEmail(summary.meetingId, { tone: next });
      onSummaryChange({ ...summary, client: fresh });
    } catch (err) {
      toast.push({ tone: "error", message: (err as Error).message });
    } finally {
      setRegenerating(false);
    }
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      const fresh = await summaryApi.regenerateEmail(summary.meetingId, { tone });
      onSummaryChange({ ...summary, client: fresh });
      toast.push({ tone: "success", message: "Email regenerated" });
    } catch (err) {
      toast.push({ tone: "error", message: (err as Error).message });
    } finally {
      setRegenerating(false);
    }
  }

  function copySummary() {
    const text = [e.greeting, ...e.body, e.signoff].join("\n\n");
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="email-wrap">
      <div className="email-controls">
        <div className="email-controls-left">
          <span className="email-kicker">TONE</span>
          <div className="seg seg-sm">
            <button type="button" className={tone === "formal" ? "on" : ""} onClick={() => void changeTone("formal")}>Formal</button>
            <button type="button" className={tone === "warm" ? "on" : ""} onClick={() => void changeTone("warm")}>Warm</button>
            <button type="button" className={tone === "brief" ? "on" : ""} onClick={() => void changeTone("brief")}>Brief</button>
          </div>
          <button type="button" className="ghost-btn" onClick={regenerate} disabled={regenerating}>
            <Spark size={14} /> {regenerating ? "Regenerating…" : "Regenerate"}
          </button>
        </div>
        <div className="email-controls-right">
          <button type="button" className={`pill-btn primary ${copied ? "sent" : ""}`} onClick={copySummary}>
            {copied ? (
              <>
                <Check size={14} /> Copied to clipboard
              </>
            ) : (
              <>
                <Copy size={14} /> Copy summary
              </>
            )}
          </button>
        </div>
      </div>

      <div className="email-card">
        <div className="email-head">
          <div className="email-row">
            <span className="email-lbl">To</span>
            <div className="email-chips">
              <input
                className="email-subject"
                placeholder="client@example.com, …"
                style={{ flex: 1, minWidth: 0 }}
                aria-label="Recipient emails"
              />
            </div>
          </div>
          <div className="email-row">
            <span className="email-lbl">Cc</span>
            <div className="email-chips">
              <button type="button" className="ghost-btn">+ Add</button>
            </div>
          </div>
          <div className="email-row">
            <span className="email-lbl">Subject</span>
            <input className="email-subject" defaultValue={e.subject} />
          </div>
        </div>

        <div className="email-body">
          <p>{e.greeting}</p>
          {e.body.map((p, i) => (
            <p key={i} dangerouslySetInnerHTML={{ __html: formatBodyParagraph(p) }} />
          ))}
          <p style={{ whiteSpace: "pre-line" }}>{e.signoff}</p>
        </div>

        <div className="email-refs">
          <div className="email-refs-head">
            <Globe size={14} /> Reference links from cloud.google.com
            <span className="email-refs-meta">Auto-suggested · click to toggle inclusion</span>
          </div>
          <ReferenceLinks refs={summary.references} />
        </div>

        <div className="email-attach">
          <div className="email-attach-head">Attachments (auto-suggested)</div>
          <div className="email-attach-row">
            <div className="email-attach-card">
              <Doc size={14} /> Latency benchmark — europe-west4 vs us-east-1.pdf
            </div>
            <div className="email-attach-card">
              <Doc size={14} /> Model Garden one-pager.pdf
            </div>
            <button type="button" className="dashed-btn dashed-sm">+ Add attachment</button>
          </div>
        </div>
      </div>

      <div className="email-foot-note">
        <Alert size={14} /> This email contains no internal notes, scoring, or competitive analysis. Internal summary stays private.
      </div>
    </div>
  );
}
