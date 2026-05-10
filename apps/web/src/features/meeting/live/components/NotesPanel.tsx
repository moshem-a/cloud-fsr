import type { RepNote } from "@scoach/types";
import { Check, Close, Notebook } from "@scoach/ui/icons";
import { useState } from "react";

import { api } from "../../../../lib/http.ts";
import { useLiveMeetingStore } from "../store.ts";

export interface NotesPanelProps {
  meetingId: string;
}

function elapsed(startedAt: number | null): string {
  if (!startedAt) return "00:00";
  const sec = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Always-visible private notes panel for the left rail.
 * - "+ Add" inline composer at the bottom.
 * - Each note has Edit / Delete inline.
 * - All mutations are optimistic in the store, then PUT-replaced server-side.
 *
 * Notes persist to the meeting doc and re-hydrate on page reload.
 */
export function NotesPanel({ meetingId }: NotesPanelProps) {
  const notes = useLiveMeetingStore((s) => s.notes);
  const startedAt = useLiveMeetingStore((s) => s.startedAt);
  const addNote = useLiveMeetingStore((s) => s.addNote);
  const updateNote = useLiveMeetingStore((s) => s.updateNote);
  const deleteNote = useLiveMeetingStore((s) => s.deleteNote);

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  function persist(next: RepNote[]) {
    void api(`/meetings/${meetingId}/notes`, { method: "PUT", body: { notes: next } }).catch(() => {});
  }

  function commitAdd() {
    const text = draft.trim();
    if (!text) {
      setComposing(false);
      setDraft("");
      return;
    }
    const note: RepNote = { t: elapsed(startedAt), text };
    addNote(note);
    persist([...notes, note]);
    setDraft("");
    setComposing(false);
  }

  function startEdit(idx: number, current: string) {
    setEditingIndex(idx);
    setEditDraft(current);
  }

  function commitEdit() {
    if (editingIndex == null) return;
    const text = editDraft.trim();
    if (!text) {
      cancelEdit();
      return;
    }
    updateNote(editingIndex, text);
    const next = [...notes];
    const existing = next[editingIndex];
    if (existing) {
      next[editingIndex] = { t: existing.t, text };
      persist(next);
    }
    cancelEdit();
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditDraft("");
  }

  function remove(idx: number) {
    const next = notes.filter((_, i) => i !== idx);
    deleteNote(idx);
    persist(next);
  }

  return (
    <section className="card notes-card">
      <div className="card-head">
        <div className="card-title">
          <Notebook size={16} /> My notes
        </div>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            setComposing(true);
            setDraft("");
          }}
        >
          + Add
        </button>
      </div>

      {notes.length === 0 && !composing ? (
        <div className="notes-empty">
          Click <strong>+ Add</strong> to capture an objection, a name, or anything you want to
          remember mid-call. Notes are private to you and persist if you refresh.
        </div>
      ) : (
        <ul className="notes-list">
          {notes.map((n, i) => (
            <li key={`${n.t}-${i}`} className={`notes-item ${n.source === "auto" ? "notes-item-auto" : ""}`}>
              <span className="mono notes-time">{n.t}</span>
              {n.source === "auto" && (
                <span className="notes-auto-badge">Auto</span>
              )}
              {editingIndex === i && n.source !== "auto" ? (
                <div className="notes-edit">
                  <textarea
                    className="notes-edit-textarea"
                    value={editDraft}
                    autoFocus
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        commitEdit();
                      } else if (e.key === "Escape") {
                        cancelEdit();
                      }
                    }}
                    rows={2}
                  />
                  <div className="notes-edit-actions">
                    <button type="button" className="icon-btn xs" onClick={commitEdit} title="Save (⌘↵)">
                      <Check size={14} />
                    </button>
                    <button type="button" className="icon-btn xs" onClick={cancelEdit} title="Cancel (Esc)">
                      <Close size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="notes-text">{n.text}</span>
                  <div className="notes-row-actions">
                    {n.source !== "auto" && (
                      <button
                        type="button"
                        className="ghost-btn xs"
                        onClick={() => startEdit(i, n.text)}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      className="ghost-btn xs danger"
                      onClick={() => remove(i)}
                    >
                      {n.source === "auto" ? "Dismiss" : "Delete"}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {composing && (
        <div className="notes-compose">
          <textarea
            className="notes-edit-textarea"
            placeholder="Type a note…"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                commitAdd();
              } else if (e.key === "Escape") {
                setComposing(false);
                setDraft("");
              }
            }}
            rows={2}
          />
          <div className="notes-edit-actions">
            <button type="button" className="pill-btn primary sm" onClick={commitAdd}>
              <Check size={14} /> Save
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setComposing(false);
                setDraft("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
