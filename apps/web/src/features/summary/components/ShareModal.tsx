import type { MeetingSummary, SharePermission, TeamMember } from "@scoach/types";
import { useToast } from "@scoach/ui";
import { Close, Copy, Globe, Plus, Send } from "@scoach/ui/icons";
import { useEffect, useMemo, useRef, useState } from "react";

import { dashboardApi } from "../../dashboard/api.ts";
import { summaryApi } from "../api.ts";

export interface ShareModalProps {
  summary: MeetingSummary;
  onClose: () => void;
}

interface PickedRecipient extends Omit<TeamMember, "uid"> {
  uid?: string;
  external?: boolean;
}

const ALLOWED_DOMAIN = "google.com";

export function ShareModal({ summary, onClose }: ShareModalProps) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [picked, setPicked] = useState<PickedRecipient[]>([]);
  const [query, setQuery] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [permission, setPermission] = useState<SharePermission>("view");
  const [link, setLink] = useState(false);
  const [include, setInclude] = useState({
    internal: true,
    email: true,
    transcript: true,
    audio: false,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    dashboardApi
      .fetchTeam()
      .then((r) => {
        setTeam(r.items);
        const tomer = r.items.find((t) => t.name === "Tomer Avraham");
        if (tomer) setPicked([tomer]);
      })
      .catch(() => {
        /* dev mode */
      });
  }, []);

  const matches = useMemo<PickedRecipient[]>(() => {
    const q = query.trim().toLowerCase();
    const taken = new Set(picked.map((p) => p.email));
    const teamMatches = team
      .filter((t) => t.uid !== "u-noa" && !taken.has(t.email))
      .filter((t) => !q || `${t.name} ${t.email} ${t.role}`.toLowerCase().includes(q))
      .slice(0, 5);

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q);
    const emailDirect: PickedRecipient[] =
      isEmail && !taken.has(q)
        ? [
            {
              name: q,
              email: q,
              role: q.endsWith(`@${ALLOWED_DOMAIN}`) ? "Google.com" : "External",
              initials: q.slice(0, 2).toUpperCase(),
              color: q.endsWith(`@${ALLOWED_DOMAIN}`) ? "#1A73E8" : "#5F6368",
              external: !q.endsWith(`@${ALLOWED_DOMAIN}`),
            },
          ]
        : [];
    return [...teamMatches, ...emailDirect].slice(0, 6);
  }, [team, query, picked]);

  const SUGGESTED = useMemo(
    () =>
      team
        .filter((t) => t.uid !== "u-noa" && !picked.find((p) => p.email === t.email))
        .slice(0, 4),
    [team, picked],
  );

  function addPerson(person: PickedRecipient) {
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

  async function send() {
    if (picked.length === 0) return;
    try {
      await summaryApi.share(summary.meetingId, {
        recipients: picked.map((p) => ({ email: p.email, permission })),
      });
      toast.push({ tone: "success", message: `Shared with ${picked.length}` });
      onClose();
    } catch (err) {
      toast.push({ tone: "error", message: (err as Error).message });
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal share-modal-v2" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="share-modal-meeting">
            <div className="share-pop-avatar" style={{ background: "#1A73E8" }}>
              {summary.meeting.client.slice(0, 1)}
            </div>
            <div>
              <h3 className="modal-title">Share meeting</h3>
              <p className="modal-sub">
                {summary.meeting.client} · {new Date(summary.meeting.date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <Close size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="share-modal-section">
            <div className="share-field-label">Add people by name or email</div>
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
                    {p.external && (
                      <span className="ac-chip-ext" title="External email">
                        EXT
                      </span>
                    )}
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
                  placeholder={
                    picked.length
                      ? "Add another…"
                      : "Type a name, or paste email — e.g. lior@google.com"
                  }
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
                      <div className="ppl-avatar" style={{ background: m.color }}>
                        {m.initials}
                      </div>
                      <div className="ppl-info">
                        <div className="ppl-name">
                          {m.name}
                          {m.external && <span className="ppl-ext-tag">External</span>}
                        </div>
                        <div className="ppl-sub mono">{m.email}</div>
                      </div>
                      <span className="ppl-role-tag">{m.role}</span>
                    </li>
                  ))}
                </ul>
              )}
              {showSuggest && query && matches.length === 0 && (
                <div className="ac-empty">
                  <Send size={12} /> Press <kbd>Enter</kbd> to invite "
                  <span className="mono">{query}</span>"
                </div>
              )}
            </div>

            {SUGGESTED.length > 0 && !query && (
              <div className="share-suggested">
                <div className="share-suggested-head">
                  <span className="share-field-label sub">Frequent collaborators</span>
                  <span className="share-suggested-hint">Tap to add</span>
                </div>
                <div className="share-suggested-grid">
                  {SUGGESTED.map((p) => (
                    <button
                      type="button"
                      key={p.email}
                      className="share-suggested-card"
                      onClick={() => addPerson(p)}
                    >
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
          </div>

          <div className="share-people-head">
            <span>People with access</span>
            <span className="mono">{picked.length + 1}</span>
          </div>
          <ul className="share-people">
            <li>
              <div className="ppl-avatar" style={{ background: "#1A73E8" }}>NL</div>
              <div className="ppl-info">
                <div className="ppl-name">
                  Noa Levi <span className="you-badge">YOU</span>
                </div>
                <div className="ppl-role">Owner · full access</div>
              </div>
              <span className="share-perm mono">Owner</span>
            </li>
            {picked.map((p) => (
              <li key={p.email} className="on">
                <div className="ppl-avatar" style={{ background: p.color }}>
                  {p.initials}
                </div>
                <div className="ppl-info">
                  <div className="ppl-name">
                    {p.name}
                    {p.external && <span className="ppl-ext-tag">External</span>}
                  </div>
                  <div className="ppl-role">{p.email}</div>
                </div>
                <button
                  type="button"
                  className="ppl-remove"
                  onClick={() => removePerson(p.email)}
                  title="Remove"
                >
                  <Close size={14} />
                </button>
              </li>
            ))}
          </ul>

          <div className="share-row">
            <div className="share-row-label">Permission</div>
            <div className="seg seg-sm">
              <button type="button" className={permission === "view" ? "on" : ""} onClick={() => setPermission("view")}>Can view</button>
              <button type="button" className={permission === "comment" ? "on" : ""} onClick={() => setPermission("comment")}>Can comment</button>
              <button type="button" className={permission === "edit" ? "on" : ""} onClick={() => setPermission("edit")}>Can edit</button>
            </div>
          </div>

          <div className="share-row">
            <div className="share-row-label">Include</div>
            <div className="share-incl">
              <label>
                <input
                  type="checkbox"
                  checked={include.internal}
                  onChange={(e) => setInclude((s) => ({ ...s, internal: e.target.checked }))}
                />{" "}
                Internal summary
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={include.email}
                  onChange={(e) => setInclude((s) => ({ ...s, email: e.target.checked }))}
                />{" "}
                Client email draft
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={include.transcript}
                  onChange={(e) => setInclude((s) => ({ ...s, transcript: e.target.checked }))}
                />{" "}
                Full transcript
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={include.audio}
                  onChange={(e) => setInclude((s) => ({ ...s, audio: e.target.checked }))}
                />{" "}
                Audio recording
              </label>
            </div>
          </div>

          <div className="share-link-row">
            <button
              type="button"
              className={`link-toggle ${link ? "on" : ""}`}
              onClick={() => setLink((l) => !l)}
            >
              <span className={`toggle-dot ${link ? "on" : ""}`} />
              <span>Anyone in the workspace with the link</span>
            </button>
            {link && (
              <div className="share-link-box">
                <Globe size={14} />
                <span className="mono">supercloud.coach/m/{summary.meetingId.slice(0, 8)}</span>
                <button type="button" className="ghost-btn" aria-label="Copy link">
                  <Copy size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="pill-btn primary"
            onClick={send}
            disabled={picked.length === 0}
          >
            <Send size={14} /> Share with {picked.length} {picked.length === 1 ? "person" : "people"}
          </button>
        </div>
      </div>
    </div>
  );
}
