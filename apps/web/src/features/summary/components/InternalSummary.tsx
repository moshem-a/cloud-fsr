import type { ActionItem, MeetingSummary } from "@scoach/types";
import { Alert, Check, Chev, Close, Trend } from "@scoach/ui/icons";
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
  const [wellOpen, setWellOpen] = useState(false);
  const [improveOpen, setImproveOpen] = useState(false);

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
              <div className="glance-label">Key topics</div>
              <div className="glance-val" style={{ fontSize: 16 }}>
                {s.topMoments.length > 0
                  ? [...new Set(s.topMoments.map((m) => m.type))].slice(0, 3).join(", ")
                  : "—"}
              </div>
              {s.topMoments.length > 0 && (
                <div className="glance-foot">{s.topMoments.length} key moment{s.topMoments.length !== 1 ? "s" : ""}</div>
              )}
            </div>
            <div className="glance-tile">
              <div className="glance-label">Open tasks</div>
              <div className="glance-val" style={{ color: items.filter((a) => !a.done).length > 0 ? "var(--gc-yellow)" : "var(--gc-green)" }}>
                {items.filter((a) => !a.done).length}
                <span>/{items.length}</span>
              </div>
              <div className="glance-foot">
                {items.filter((a) => a.done).length} completed
              </div>
            </div>
          </div>
        </section>

        <section className="sum-card">
          <div className="sum-card-head" style={{ cursor: "pointer" }} onClick={() => setWellOpen(!wellOpen)}>
            <h3 className="sum-h3">
              <span className="dot" style={{ background: "var(--gc-green)" }} /> What went well
              <span className="sum-meta" style={{ marginLeft: 8, fontWeight: 400 }}>{s.wentWell.length}</span>
            </h3>
            <Chev size={14} style={{ transform: wellOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
          </div>
          {s.wentWell.length > 0 && (
            <div style={{ padding: "0 16px 12px", fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>
              {s.wentWell[0]}
            </div>
          )}
          {wellOpen && s.wentWell.length > 1 && (
            <ul className="sum-list">
              {s.wentWell.slice(1).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="sum-card">
          <div className="sum-card-head" style={{ cursor: "pointer" }} onClick={() => setImproveOpen(!improveOpen)}>
            <h3 className="sum-h3">
              <span className="dot" style={{ background: "var(--gc-yellow)" }} /> Where to push deeper
              <span className="sum-meta" style={{ marginLeft: 8, fontWeight: 400 }}>{s.couldImprove.length}</span>
            </h3>
            <Chev size={14} style={{ transform: improveOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
          </div>
          {s.couldImprove.length > 0 && (
            <div style={{ padding: "0 16px 12px", fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>
              {s.couldImprove[0]}
            </div>
          )}
          {improveOpen && s.couldImprove.length > 1 && (
            <ul className="sum-list">
              {s.couldImprove.slice(1).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
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
            <span className="sum-meta">{s.topMoments.length} detected</span>
          </div>
          {s.topMoments.length === 0 ? (
            <div style={{ padding: "12px 16px", color: "var(--text-4)", fontSize: 13 }}>No key moments detected in this call.</div>
          ) : (
            <div className="moment-timeline">
              {s.topMoments.map((m, i) => {
                const typeColor = m.type.toLowerCase().includes("objection") || m.type.toLowerCase().includes("risk")
                  ? "var(--gc-red)"
                  : m.type.toLowerCase().includes("positive") || m.type.toLowerCase().includes("agreement")
                    ? "var(--gc-green)"
                    : m.type.toLowerCase().includes("question")
                      ? "var(--gc-yellow)"
                      : "var(--gc-blue)";
                return (
                  <div key={i} className="moment-item">
                    <div className="moment-rail">
                      <div className="moment-dot" style={{ background: typeColor }} />
                      {i < s.topMoments.length - 1 && <div className="moment-line" />}
                    </div>
                    <div className="moment-content">
                      <div className="moment-head">
                        <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{m.t}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: typeColor, marginLeft: 8 }}>{m.type}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>"{m.quote}"</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {s.questionsAsked && s.questionsAsked.length > 0 && (
          <section className="sum-card">
            <div className="sum-card-head">
              <h3 className="sum-h3">Questions asked</h3>
              <span className="sum-meta">{s.questionsAsked.length} Q&A</span>
            </div>
            <ul className="sum-list">
              {s.questionsAsked.map((qa, i) => (
                <li key={i} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>
                    {qa.urgent && <span style={{ color: "var(--gc-red)", marginRight: 6, fontSize: 11, fontWeight: 700 }}>URGENT</span>}
                    Q: {qa.q}
                  </div>
                  <div style={{ color: "var(--text-2)", fontSize: 13 }}>{qa.a}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {s.actedHints && s.actedHints.length > 0 && (
          <section className="sum-card">
            <div className="sum-card-head">
              <h3 className="sum-h3">Hints you used</h3>
              <span className="sum-meta">{s.actedHints.length} acted on</span>
            </div>
            <ul className="sum-list">
              {s.actedHints.map((h, i) => (
                <li key={i}>
                  <b>{h.title}</b> — {h.summary}
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
