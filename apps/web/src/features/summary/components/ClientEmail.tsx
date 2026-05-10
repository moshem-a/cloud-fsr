import type { ClientEmail as ClientEmailT, MeetingSummary } from "@scoach/types";
import { useToast } from "@scoach/ui";
import { Alert, Check, Copy, Spark } from "@scoach/ui/icons";
import { useEffect, useMemo, useState } from "react";

import { summaryApi } from "../api.ts";

export interface ClientEmailProps {
  summary: MeetingSummary;
  onSummaryChange: (s: MeetingSummary) => void;
}

function flatten(e: ClientEmailT): string {
  if (e.bodyText) return e.bodyText;
  return [e.greeting, ...(e.body ?? []), e.signoff].filter(Boolean).join("\n\n");
}

export function ClientEmail({ summary, onSummaryChange }: ClientEmailProps) {
  const e = summary.client;
  const initial = useMemo(() => flatten(e), [e]);
  const [tone, setTone] = useState<typeof e.tone>(e.tone ?? "warm");
  const [bodyText, setBodyText] = useState(initial);
  const [subject, setSubject] = useState(e.subject ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const toast = useToast();

  // Re-sync local state when the parent supplies a fresh summary (e.g. after
  // tone regeneration). Drops the dirty flag because the new server payload is
  // the new source of truth.
  useEffect(() => {
    setBodyText(initial);
    setSubject(e.subject ?? "");
    setTone(e.tone ?? "warm");
    setDirty(false);
  }, [initial, e.subject, e.tone]);

  function confirmDiscardEdits(): boolean {
    if (!dirty && !e.edited) return true;
    return window.confirm(
      "You've edited this email. Regenerating will discard your edits. Continue?",
    );
  }

  async function changeTone(next: typeof tone) {
    if (next === tone) return;
    if (!confirmDiscardEdits()) return;
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
    if (!confirmDiscardEdits()) return;
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

  async function save() {
    setSaving(true);
    try {
      const fresh = await summaryApi.updateEmail(summary.meetingId, { bodyText, subject });
      onSummaryChange({ ...summary, client: fresh });
      setDirty(false);
      toast.push({ tone: "success", message: "Email saved" });
    } catch (err) {
      toast.push({ tone: "error", message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function copySummary() {
    void navigator.clipboard.writeText(bodyText).then(() => {
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
          {e.edited && !dirty && (
            <span className="email-edited-pill" title={e.editedAt ? `Edited ${new Date(e.editedAt).toLocaleString()}` : undefined}>
              Manually edited
            </span>
          )}
        </div>
        <div className="email-controls-right">
          <button
            type="button"
            className="pill-btn primary"
            onClick={() => void save()}
            disabled={!dirty || saving}
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
          <button type="button" className={`pill-btn ${copied ? "sent" : ""}`} onClick={copySummary}>
            {copied ? (
              <>
                <Check size={14} /> Copied
              </>
            ) : (
              <>
                <Copy size={14} /> Copy
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
            <input
              className="email-subject"
              value={subject}
              onChange={(ev) => { setSubject(ev.target.value); setDirty(true); }}
            />
          </div>
        </div>

        <div className="email-body">
          <textarea
            className="email-textarea"
            value={bodyText}
            onChange={(ev) => { setBodyText(ev.target.value); setDirty(true); }}
            rows={Math.max(16, bodyText.split("\n").length + 2)}
            spellCheck
            aria-label="Email body"
          />
        </div>

        <div className="email-attach">
          <div className="email-attach-head">Attachments</div>
          <div className="email-attach-row">
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
