import type { HistoryItem, TeamMember } from "@scoach/types";
import { useToast } from "@scoach/ui";
import { Check, Close, Link as LinkIcon, Lock, Plus, Send, Share, User as UserIcon } from "@scoach/ui/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { dashboardApi } from "../api.ts";

export interface HistShareBtnProps {
  meeting: HistoryItem;
  team: TeamMember[];
}

type Permission = "view" | "comment";

export function HistShareBtn({ meeting, team }: HistShareBtnProps) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<TeamMember[]>([]);
  const [query, setQuery] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [perm, setPerm] = useState<Permission>("view");
  const [sent, setSent] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const SUGGESTED = useMemo(() => team.filter((t) => t.uid !== "u-noa").slice(0, 4), [team]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const taken = new Set(picked.map((p) => p.email));
    return team
      .filter((t) => t.uid !== "u-noa" && !taken.has(t.email))
      .filter((t) => !q || `${t.name} ${t.email} ${t.role}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [team, query, picked]);

  function addPerson(person: TeamMember) {
    setPicked((p) => (p.find((x) => x.email === person.email) ? p : [...p, person]));
    setQuery("");
    setShowSuggest(false);
    setHighlight(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  function removePerson(email: string) {
    setPicked((p) => p.filter((x) => x.email !== email));
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = matches[highlight];
      if (m) addPerson(m);
    } else if (e.key === "Backspace" && !query && picked.length) {
      removePerson(picked[picked.length - 1]!.email);
    } else if (e.key === "Escape") {
      setShowSuggest(false);
    }
  }

  async function doShare() {
    if (picked.length === 0) return;
    setSent(true);
    try {
      await dashboardApi.shareMeeting(
        meeting.id,
        picked.map((p) => ({ email: p.email, permission: perm })),
      );
    } catch (err) {
      toast.push({ tone: "error", message: (err as Error).message });
    }
    setTimeout(() => {
      setOpen(false);
      setSent(false);
      setPicked([]);
      setQuery("");
    }, 1400);
  }

  return (
    <div className="hist-share-wrap">
      <button
        ref={btnRef}
        type="button"
        className="hist-share-btn"
        title="Share with team"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <Share size={14} />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="modal-back" onMouseDown={() => setOpen(false)} onClick={() => setOpen(false)}>
            <div
              ref={popRef}
              className="share-pop share-pop-modal"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="share-pop-head">
                <div className="share-pop-meeting">
                  <div className="share-pop-avatar" style={{ background: meeting.avatar }}>
                    {meeting.client.slice(0, 1)}
                  </div>
                  <div className="share-pop-meta">
                    <div className="share-pop-title">Share meeting</div>
                    <div className="share-pop-sub">{meeting.title}</div>
                    <div className="share-pop-date">{meeting.client} · {meeting.date}</div>
                  </div>
                </div>
                <button type="button" className="share-pop-close" onClick={() => setOpen(false)} aria-label="Close">
                  <Close size={14} />
                </button>
              </div>

              <div className="share-pop-body">
                <div className="share-field-label">Add people</div>
                <div className="ac-wrap">
                  <div
                    className="ac-field"
                    onClick={() => {
                      inputRef.current?.focus();
                      setShowSuggest(true);
                    }}
                  >
                    {picked.map((p) => (
                      <span key={p.email} className="ac-chip">
                        <span className="ac-chip-dot" style={{ background: p.color }}>
                          {p.initials}
                        </span>
                        <span className="ac-chip-name">{p.name}</span>
                        <button
                          type="button"
                          className="ac-chip-x"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePerson(p.email);
                          }}
                          aria-label="Remove"
                        >
                          <Close size={10} />
                        </button>
                      </span>
                    ))}
                    <input
                      ref={inputRef}
                      className="ac-input"
                      value={query}
                      placeholder={picked.length ? "Add another…" : "Search teammates by name or email"}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setShowSuggest(true);
                        setHighlight(0);
                      }}
                      onFocus={() => setShowSuggest(true)}
                      onKeyDown={onKey}
                    />
                  </div>

                  {showSuggest && matches.length > 0 && (
                    <ul className="ac-suggest">
                      {matches.map((m, i) => (
                        <li
                          key={m.email}
                          className={i === highlight ? "on" : ""}
                          onMouseEnter={() => setHighlight(i)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addPerson(m);
                          }}
                        >
                          <div className="ppl-avatar" style={{ background: m.color }}>{m.initials}</div>
                          <div className="ppl-info">
                            <div className="ppl-name">{m.name}</div>
                            <div className="ppl-sub mono">{m.email}</div>
                          </div>
                          <span className="ppl-role-tag">{m.role}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {showSuggest && query && matches.length === 0 && (
                    <div className="ac-empty">No teammates match "{query}"</div>
                  )}
                </div>

                {picked.length === 0 && !query && (
                  <div className="share-suggested">
                    <div className="share-suggested-head">
                      <span className="share-field-label sub">Frequent collaborators</span>
                      <span className="share-suggested-hint">Tap to add</span>
                    </div>
                    <div className="share-suggested-grid">
                      {SUGGESTED.map((p) => (
                        <button key={p.email} type="button" className="share-suggested-card" onClick={() => addPerson(p)}>
                          <span className="share-suggested-avatar" style={{ background: p.color }}>
                            {p.initials}
                          </span>
                          <span className="share-suggested-name">{p.name.split(" ")[0]}</span>
                          <span className="share-suggested-role">{p.role.split(" ")[0]}</span>
                          <span className="share-suggested-plus">
                            <Plus size={11} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {picked.length > 0 && (
                  <div className="share-picked-pane">
                    <div className="share-picked-head">
                      <span className="share-field-label sub">
                        {picked.length} {picked.length === 1 ? "person" : "people"} will receive this
                      </span>
                      <button type="button" className="share-picked-clear" onClick={() => setPicked([])}>
                        Clear all
                      </button>
                    </div>
                    <ul className="share-picked-list">
                      {picked.map((p) => (
                        <li key={p.email}>
                          <div className="ppl-avatar sm" style={{ background: p.color }}>{p.initials}</div>
                          <div className="ppl-info">
                            <div className="ppl-name">{p.name}</div>
                            <div className="ppl-sub">{p.role}</div>
                          </div>
                          <button type="button" className="ac-chip-x" onClick={() => removePerson(p.email)}>
                            <Close size={11} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="share-perm-row">
                  <div className="share-perm-info">
                    <Lock size={13} />
                    <div>
                      <div className="share-perm-label">Permission</div>
                      <div className="share-perm-hint">
                        {perm === "view" ? "Recipients can read transcript & summary" : "Recipients can comment and tag people"}
                      </div>
                    </div>
                  </div>
                  <div className="seg seg-sm">
                    <button type="button" className={perm === "view" ? "on" : ""} onClick={() => setPerm("view")}>View</button>
                    <button type="button" className={perm === "comment" ? "on" : ""} onClick={() => setPerm("comment")}>Comment</button>
                  </div>
                </div>
              </div>

              <div className="share-pop-foot">
                <button type="button" className="share-link-btn" title="Copy shareable link">
                  <LinkIcon size={13} /> Copy link
                </button>
                <div className="share-foot-actions">
                  <button type="button" className="ghost-btn" onClick={() => setOpen(false)}>Cancel</button>
                  <button
                    type="button"
                    className={`pill-btn primary sm ${sent ? "sent" : ""}`}
                    disabled={picked.length === 0 && !sent}
                    onClick={doShare}
                  >
                    {sent ? (
                      <>
                        <Check size={12} /> Shared with {picked.length}
                      </>
                    ) : (
                      <>
                        <Send size={12} /> Share{picked.length ? ` with ${picked.length}` : ""}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// suppress unused-import warning until we reach a Sprint where we wire UserIcon here
void UserIcon;
