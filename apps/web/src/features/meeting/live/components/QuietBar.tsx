import type { RepNote } from "@scoach/types";
import { Bolt, Close, Notebook, Question, Send } from "@scoach/ui/icons";
import { useState } from "react";

import { api } from "../../../../lib/http.ts";
import { useAuthStore } from "../../../auth/store.ts";
import { quietAsk, urgentHelp } from "../gemini/quietAsk.ts";
import { useLiveMeetingStore } from "../store.ts";

export interface QuietBarProps {
  meetingId: string;
}

interface QuietAnswer {
  q: string;
  a: string;
  chips: string[];
}

export function QuietBar({ meetingId }: QuietBarProps) {
  const notes = useLiveMeetingStore((s) => s.notes);
  const transcript = useLiveMeetingStore((s) => s.transcript);
  const addNote = useLiveMeetingStore((s) => s.addNote);
  const startedAt = useLiveMeetingStore((s) => s.startedAt);

  const [mode, setMode] = useState<"ask" | "note">("ask");
  const [val, setVal] = useState("");
  const [answer, setAnswer] = useState<QuietAnswer | null>(null);
  const [thinking, setThinking] = useState(false);
  const [urgent, setUrgent] = useState(false);

  function elapsed(): string {
    if (!startedAt) return "00:00";
    const sec = Math.floor((Date.now() - startedAt) / 1000);
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  async function submit() {
    if (!val.trim()) return;
    if (mode === "note") {
      const note: RepNote = { t: elapsed(), text: val.trim() };
      addNote(note);
      void api(`/meetings/${meetingId}/notes`, { method: "POST", body: note }).catch(() => {});
      setVal("");
      return;
    }

    const question = val;
    setThinking(true);
    setAnswer(null);
    const hasKey = !!useAuthStore.getState().geminiKey;

    try {
      if (hasKey) {
        const a = await quietAsk(question);
        setAnswer(a);
      } else {
        // No personal Gemini key set — fall back to a canned demo answer so
        // the UX still works; surface a hint to set a key.
        await new Promise((r) => setTimeout(r, 600));
        setAnswer({
          q: question,
          a: "Set your personal Gemini API key in Settings → Gemini API to enable real Quiet Ask. (This canned answer is shown because no key is configured.)",
          chips: ["Settings", "Gemini API key"],
        });
      }
    } catch (err) {
      setAnswer({
        q: question,
        a: `Quiet Ask failed: ${(err as Error).message}`,
        chips: [],
      });
    } finally {
      setThinking(false);
      setVal("");
    }
  }

  async function urgentAnswer() {
    setUrgent(true);
    setAnswer(null);
    const hasKey = !!useAuthStore.getState().geminiKey;
    try {
      if (!hasKey) {
        setAnswer({
          q: "(no Gemini API key configured)",
          a: "Add a personal Gemini API key in Settings → Gemini API to use Urgent help.",
          chips: ["Settings"],
        });
        return;
      }
      const a = await urgentHelp(transcript);
      setAnswer(a);
    } catch (err) {
      setAnswer({
        q: "(urgent help)",
        a: `Urgent help failed: ${(err as Error).message}`,
        chips: [],
      });
    } finally {
      setUrgent(false);
    }
  }

  return (
    <div className="quiet-bar">
      <div className="seg seg-sm quiet-seg">
        <button
          type="button"
          className={mode === "ask" ? "on" : ""}
          onClick={() => {
            setMode("ask");
            setAnswer(null);
          }}
        >
          <Question size={14} /> Quiet ask
        </button>
        <button
          type="button"
          className={mode === "note" ? "on" : ""}
          onClick={() => {
            setMode("note");
            setAnswer(null);
          }}
        >
          <Notebook size={14} /> Private note
        </button>
      </div>

      <div className="quiet-input-row">
        <input
          placeholder={
            mode === "ask"
              ? "Ask Gemini privately — answer goes only to you"
              : "Note for yourself — added to context"
          }
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <span className="kbd">⌘</span>
        <span className="kbd">↵</span>
        <button type="button" className="pill-btn primary sm" onClick={submit}>
          <Send size={14} /> {mode === "ask" ? "Ask" : "Save"}
        </button>
        <button
          type="button"
          className="pill-btn urgent sm"
          onClick={() => void urgentAnswer()}
          disabled={urgent || transcript.length === 0}
          title="Generate a fast answer to the client's most recent question using the live transcript"
        >
          <Bolt size={14} /> {urgent ? "Thinking…" : "Urgent help"}
        </button>
      </div>

      {(thinking || urgent) && (
        <div className="quiet-answer thinking">
          <div className="shimmer-line shimmer" style={{ width: "75%" }} />
          <div className="shimmer-line shimmer" style={{ width: "55%" }} />
        </div>
      )}
      {answer && !thinking && !urgent && (
        <div className="quiet-answer">
          <div className="qa-q">
            <Question size={14} /> {answer.q}
          </div>
          <div className="qa-a">{answer.a}</div>
          <div className="qa-chips">
            {answer.chips.map((c) => (
              <span key={c} className="ent-pill">
                {c}
              </span>
            ))}
            <button type="button" className="qa-dismiss" onClick={() => setAnswer(null)} aria-label="Dismiss">
              <Close size={14} />
            </button>
          </div>
        </div>
      )}

      {mode === "note" && notes.length > 0 && (
        <ul className="quiet-notes">
          {notes.map((n, i) => (
            <li key={`${n.t}-${i}`}>
              <span className="mono qn-time">{n.t}</span>
              <span>{n.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
