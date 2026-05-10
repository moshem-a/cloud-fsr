import type { ActionItem, MeetingSummary } from "@scoach/types";
import { Alert, Check, Close, Trend } from "@scoach/ui/icons";
import { useState } from "react";

import { summaryApi } from "../api.ts";

export function InternalSummary({
  summary,
  onSummaryChange,
}: {
  summary: MeetingSummary;
  onSummaryChange: (s: MeetingSummary) => void;
}) {
  const s = summary.internal;
  const [items, setItems] = useState<ActionItem[]>(s.actionItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newWho, setNewWho] = useState("");
  const [newWhat, setNewWhat] = useState("");
  const [newDue, setNewDue] = useState("");

  function persist(next: ActionItem[]) {
    setItems(next);
    onSummaryChange({ ...summary, internal: { ...summary.internal, actionItems: next } });
    void summaryApi.updateActionItems(summary.meetingId, next).catch(() => {});
  }

  function toggleDone(id: string) {
    persist(items.map((a) => (a.id === id ? { ...a, done: !a.done } : a)));
  }

  function startEdit(a: ActionItem) {
    setEditingId(a.id);
    setEditDraft(a.what);
  }

  function commitEdit() {
    if (!editingId) return;
    const text = editDraft.trim();
    if (!text) {
      setEditingId(null);
      return;
    }
    persist(items.map((a) => (a.id === editingId ? { ...a, what: text } : a)));
    setEditingId(null);
    setEditDraft("");
  }

  function removeItem(id: string) {
    persist(items.filter((a) => a.id !== id));
  }

  function commitAdd() {
    const what = newWhat.trim();
    if (!what) {
      setAddingNew(false);
      return;
    }
    const item: ActionItem = {
      id: crypto.randomUUID(),
      who: newWho.trim() || "Rep",
      what,
      due: newDue || new Date().toISOString().slice(0, 10),
      done: false,
    };
    persist([...items, item]);
    setNewWho("");
    setNewWhat("");
    setNewDue("");
    setAddingNew(false);
  }

  return (
    <div className="sum-grid">
      <main className="sum-main">
        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">At a glance</h3>
            <span className="sum-meta mono">Confidence {Math.round(s.confidence * 100)}%</span>
          </div>
          <div className="glance-row">
            <div className="glance-tile">
              <div className="glance-label">Score</div>
              <div className="glance-val" style={{ color: s.score >= 70 ? "var(--gc-green)" : s.score >= 40 ? "var(--gc-yellow)" : "var(--gc-red, #b00020)" }}>
                {s.score}
                <span>/100</span>
              </div>
            </div>
            <div className="glance-tile">
              <div className="glance-label">Deal health</div>
              <div className="glance-val" style={{ color: s.health === "hot" ? "var(--gc-green)" : s.health === "warm" ? "var(--gc-yellow)" : "var(--gc-red, #b00020)" }}>
                {s.health[0]?.toUpperCase()}{s.health.slice(1)}
              </div>
              {s.topMoments[0] && (
                <div className="glance-foot">
                  {s.topMoments[0].type} at {s.topMoments[0].t}
                </div>
              )}
            </div>
            <div className="glance-tile">
              <div className="glance-label">Hints surfaced</div>
              <div className="glance-val">
                {s.hintsSurfaced ?? 0}
                {(s.hintsActed ?? 0) > 0 && <span> · {s.hintsActed} used</span>}
              </div>
              {(s.hintsSurfaced ?? 0) > 0 && (
                <div className="glance-foot">
                  {Math.round(((s.hintsActed ?? 0) / (s.hintsSurfaced ?? 1)) * 100)}% acted-on rate
                </div>
              )}
            </div>
            <div className="glance-tile">
              <div className="glance-label">Sentiment arc</div>
              <div className="glance-val">
                <Trend size={20} /> {s.sentimentDelta != null ? (s.sentimentDelta >= 0 ? `+${s.sentimentDelta}` : String(s.sentimentDelta)) : "—"}
              </div>
              {s.sentimentAvg != null && (
                <div className="glance-foot">Avg engagement: {s.sentimentAvg}/100</div>
              )}
            </div>
          </div>
        </section>

        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">
              <span className="dot" style={{ background: "var(--gc-green)" }} /> What went well
            </h3>
          </div>
          <ul className="sum-list">
            {s.wentWell.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>

        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">
              <span className="dot" style={{ background: "var(--gc-yellow)" }} /> Where to push deeper
            </h3>
          </div>
          <ul className="sum-list">
            {s.couldImprove.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>

        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">Stated vs. actual needs</h3>
          </div>
          <div className="needs-row">
            <div className="needs-col">
              <div className="needs-kicker">CLIENT STATED</div>
              {s.needs.stated.map((n, i) => (
                <div key={i} className="needs-item needs-stated">
                  {n}
                </div>
              ))}
            </div>
            <div className="needs-arrow">›</div>
            <div className="needs-col">
              <div className="needs-kicker" style={{ color: "var(--gc-blue)" }}>COACH INFERRED</div>
              {s.needs.actual.map((n, i) => (
                <div key={i} className="needs-item needs-actual">
                  {n}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">Action items</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="sum-meta">{items.filter((a) => !a.done).length} open</span>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setAddingNew(true);
                  setNewWho("");
                  setNewWhat("");
                  setNewDue("");
                }}
              >
                + Add
              </button>
            </div>
          </div>
          <ul className="action-list">
            {items.map((a) => (
              <li key={a.id} className={a.done ? "done" : ""}>
                <input
                  type="checkbox"
                  checked={a.done}
                  onChange={() => toggleDone(a.id)}
                />
                <div className="action-who">{a.who}</div>
                {editingId === a.id ? (
                  <div className="action-edit-wrap">
                    <input
                      type="text"
                      className="action-edit-input"
                      value={editDraft}
                      autoFocus
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={commitEdit}
                    />
                  </div>
                ) : (
                  <div className="action-what" onClick={() => startEdit(a)} style={{ cursor: "pointer" }}>
                    {a.what}
                  </div>
                )}
                <div className="action-due mono">{a.due}</div>
                <div className="action-row-actions">
                  <button type="button" className="ghost-btn xs danger" onClick={() => removeItem(a.id)} title="Remove">
                    <Close size={12} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {addingNew && (
            <div className="action-add-form">
              <input
                type="text"
                className="action-edit-input"
                placeholder="Who"
                value={newWho}
                onChange={(e) => setNewWho(e.target.value)}
                style={{ width: 70 }}
              />
              <input
                type="text"
                className="action-edit-input"
                placeholder="What needs to be done"
                value={newWhat}
                autoFocus
                onChange={(e) => setNewWhat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitAdd();
                  if (e.key === "Escape") setAddingNew(false);
                }}
              />
              <input
                type="date"
                className="action-edit-input"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
                style={{ width: 130 }}
              />
              <div style={{ display: "flex", gap: 4 }}>
                <button type="button" className="icon-btn xs" onClick={commitAdd} title="Save">
                  <Check size={14} />
                </button>
                <button type="button" className="icon-btn xs" onClick={() => setAddingNew(false)} title="Cancel">
                  <Close size={14} />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      <aside className="sum-aside">
        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">
              <Trend size={14} /> Upsell opportunities
            </h3>
          </div>
          {s.upsell.map((u, i) => (
            <div key={i} className="upsell-item">
              <div className="upsell-name">{u.name}</div>
              <div className="upsell-reason">{u.reason}</div>
            </div>
          ))}
        </section>

        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">
              <Alert size={14} /> Risks
            </h3>
          </div>
          <ul className="risk-list">
            {s.risks.map((r, i) => (
              <li key={i}>
                <span className="risk-dot" />
                {r}
              </li>
            ))}
          </ul>
        </section>

        <section className="sum-card">
          <div className="sum-card-head">
            <h3 className="sum-h3">Top moments</h3>
          </div>
          <ol className="moment-list">
            {s.topMoments.length === 0 && (
              <li style={{ color: "var(--text-4)" }}>No key moments detected in this call.</li>
            )}
            {s.topMoments.map((m, i) => (
              <li key={i}>
                <span className="mono">{m.t}</span>
                <div>
                  <b>{m.type}</b> — {m.quote}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
