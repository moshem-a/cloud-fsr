import type { HistoryItem, TeamMember, UserStatsResponse } from "@scoach/types";
import { Chev, Inbox, Search, Spark, User as UserIcon } from "@scoach/ui/icons";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { dashboardApi } from "../api.ts";
import { DashHeader } from "./DashHeader.tsx";
import { HistShareBtn } from "./HistShareBtn.tsx";
import { StatTile } from "./StatTile.tsx";

type Scope = "mine" | "shared";
type StageFilter = "all" | "discovery" | "qualification" | "negotiation";

function formatHistoryDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return { date, time };
}

export function Dashboard() {
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StageFilter>("all");
  const [scope, setScope] = useState<Scope>("mine");

  const [allHistory, setAllHistory] = useState<HistoryItem[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([
      dashboardApi.fetchHistory({}),
      dashboardApi.fetchTeam(),
      dashboardApi.fetchStats(),
    ])
      .then(([hist, t, s]) => {
        // fetch returns scope-filtered already; but since we want both
        // mine + shared in client to recompute counts, fetch both:
        return Promise.all([
          dashboardApi.fetchHistory({ scope: "mine" }),
          dashboardApi.fetchHistory({ scope: "shared" }),
          Promise.resolve(t),
          Promise.resolve(s),
          Promise.resolve(hist),
        ]);
      })
      .then(([mine, shared, t, s]) => {
        setAllHistory([...mine.items, ...shared.items]);
        setTeam(t.items);
        setStats(s);
      })
      .catch(() => {
        /* keep loading state */
      });
  }, []);

  const filtered = useMemo(() => {
    const items = allHistory.filter((m) => {
      const isShared = !!m.sharedBy;
      if (scope === "mine" && isShared) return false;
      if (scope === "shared" && !isShared) return false;
      if (filter !== "all" && m.stage.toLowerCase() !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${m.client} ${m.title} ${m.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    items.sort((a, b) => {
      const aScheduled = a.scheduledAt && new Date(a.scheduledAt) > new Date() ? 1 : 0;
      const bScheduled = b.scheduledAt && new Date(b.scheduledAt) > new Date() ? 1 : 0;
      const aLive = a.status === "live" ? 1 : 0;
      const bLive = b.status === "live" ? 1 : 0;
      const aDraft = a.status === "draft" ? 1 : 0;
      const bDraft = b.status === "draft" ? 1 : 0;
      const aPriority = aLive * 3 + aScheduled * 2 + aDraft;
      const bPriority = bLive * 3 + bScheduled * 2 + bDraft;
      if (bPriority !== aPriority) return bPriority - aPriority;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    return items;
  }, [allHistory, scope, filter, search]);

  const myCount = useMemo(() => allHistory.filter((m) => !m.sharedBy).length, [allHistory]);
  const sharedCount = useMemo(() => allHistory.filter((m) => !!m.sharedBy).length, [allHistory]);

  const byClient = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of allHistory) counts[h.client] = (counts[h.client] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allHistory]);

  async function startNew() {
    setCreating(true);
    try {
      const m = await dashboardApi.createMeeting({
        account: { name: "" },
        title: "Untitled meeting",
        stage: "Discovery",
      });
      nav({ to: "/meetings/$id/setup", params: { id: m.id } });
    } finally {
      setCreating(false);
    }
  }

  // Dev shortcut: skip the setup wizard and jump straight to the live page
  // with a default-shaped meeting. Same Firestore record as the normal flow,
  // so history/summary work the same — just no pre-meeting wizard friction.
  async function quickLive() {
    setCreating(true);
    try {
      const m = await dashboardApi.createMeeting({
        account: { name: "Test meeting" },
        title: "Quick test",
        stage: "Discovery",
      });
      nav({ to: "/meetings/$id/live", params: { id: m.id } });
    } finally {
      setCreating(false);
    }
  }

  function openMeeting(id: string, status?: string) {
    // Resume in-progress meetings on the live page; route ended/summarized
    // meetings to the summary view. Drafts (never started) go to setup so
    // the user can finish configuring them.
    if (status === "draft") {
      nav({ to: "/meetings/$id/setup", params: { id } });
    } else if (status === "live") {
      nav({ to: "/meetings/$id/live", params: { id } });
    } else {
      nav({ to: "/meetings/$id/summary", params: { id } });
    }
  }

  return (
    <div className="dash">
      <DashHeader onStartNew={startNew} />

      <div className="dash-grid">
        {/* Hero / quick start */}
        <section className="dash-hero">
          <div className="dash-hero-text">
            <div className="kicker">Welcome back, {(stats ? "Noa" : "")}</div>
            <h1 className="dash-title">3 meetings on the calendar today.</h1>
            <p className="dash-sub">
              Your next call is with <b>Aviv Capital</b> in 18 minutes — board pressure was flagged last call.
              I've pre-loaded their context.
            </p>
            <div className="dash-cta-row">
              <button type="button" className="pill-btn primary lg" onClick={startNew} disabled={creating}>
                ▶ Start new meeting
              </button>
              <button
                type="button"
                className="pill-btn lg"
                onClick={quickLive}
                disabled={creating}
                title="Skip the setup wizard — go straight to the live page with a default test meeting"
              >
                ⚡ Quick live (skip setup)
              </button>
            </div>
          </div>
          <div className="dash-hero-stats">
            <StatTile label="Meetings this week" value={stats?.thisWeek.meetings ?? 12} trend={stats?.trend.meetings != null ? `+${stats.trend.meetings}` : "+3"} color="blue" />
            <StatTile label="Avg. confidence" value={stats?.thisWeek.avgConfidence != null ? `${Math.round(stats.thisWeek.avgConfidence * 100)}%` : "82%"} trend="+6%" color="green" />
            <StatTile label="Hints used" value={68} trend={`${stats?.thisWeek.hintsActedPct ?? 74}% rate`} color="yellow" />
            <StatTile label="Buying signals" value={stats?.thisWeek.buyingSignals ?? 9} trend="↑ Aviv, Monday" color="red" />
          </div>
        </section>

        {/* History */}
        <section className="dash-history">
          <div className="dash-history-head">
            <h2 className="dash-h2">Meeting history</h2>
            <div className="dash-history-actions">
              <div className="seg seg-tabs">
                <button type="button" className={scope === "mine" ? "on" : ""} onClick={() => setScope("mine")}>
                  <UserIcon size={12} /> My meetings <span className="seg-count">{myCount}</span>
                </button>
                <button type="button" className={scope === "shared" ? "on" : ""} onClick={() => setScope("shared")}>
                  <Inbox size={12} /> Shared with me <span className="seg-count">{sharedCount}</span>
                </button>
              </div>
              <div className="search-box">
                <Search size={14} />
                <input
                  type="search"
                  placeholder="Search by client, topic, tag…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="seg seg-sm">
                <button type="button" className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All</button>
                <button type="button" className={filter === "discovery" ? "on" : ""} onClick={() => setFilter("discovery")}>Discovery</button>
                <button type="button" className={filter === "qualification" ? "on" : ""} onClick={() => setFilter("qualification")}>Qualification</button>
                <button type="button" className={filter === "negotiation" ? "on" : ""} onClick={() => setFilter("negotiation")}>Negotiation</button>
              </div>
            </div>
          </div>

          <div className="hist-table">
            <div className="hist-row hist-head-row">
              <div>Date</div>
              <div>Client</div>
              <div>Meeting</div>
              <div>Stage</div>
              <div>Tags</div>
              <div>Hints</div>
              <div></div>
            </div>
            {filtered.map((m) => {
              const { date, time } = formatHistoryDate(m.date);
              return (
                <button
                  type="button"
                  key={m.id}
                  className="hist-row"
                  onClick={() => openMeeting(m.id, m.status)}
                >
                  <div className="hist-date-col">
                    <div className="hist-date mono">{date}</div>
                    <div className="hist-time mono">{time} · {m.duration}</div>
                  </div>
                  <div className="hist-client">
                    <div className="hist-avatar" style={{ background: m.avatar }}>
                      {m.client[0]}
                    </div>
                    <div>
                      <div className="hist-client-name">
                        {m.client}
                        {m.sharedBy && (
                          <span className="shared-badge" title={`Shared by ${m.sharedBy.name}, ${m.sharedAt ?? ""}`}>
                            ↗ {m.sharedBy.initials}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="hist-title">
                    {m.title}
                    {m.status === "live" && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          background: "var(--gc-green-50, #e6f4ea)",
                          color: "var(--gc-green, #1e8e3e)",
                        }}
                      >
                        ● Live · resume
                      </span>
                    )}
                    {m.scheduledAt && new Date(m.scheduledAt) > new Date() && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          background: "var(--gc-blue-50, #e8f0fe)",
                          color: "var(--gc-blue, #1a73e8)",
                        }}
                      >
                        Scheduled · {new Date(m.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} {new Date(m.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                      </span>
                    )}
                    {m.status === "draft" && !(m.scheduledAt && new Date(m.scheduledAt) > new Date()) && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          background: "var(--gc-yellow-50, #fff7e0)",
                          color: "var(--gc-yellow, #b06000)",
                        }}
                      >
                        Draft
                      </span>
                    )}
                    {m.nextStep && (
                      <div className="hist-next">
                        <Chev size={12} /> {m.nextStep}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className={`stage-pill stage-${m.stage.toLowerCase()}`}>{m.stage}</span>
                  </div>
                  <div className="hist-tags">
                    {m.tags.slice(0, 2).map((t) => (
                      <span key={t} className="tag tag-blue">{t}</span>
                    ))}
                    {m.tags.length > 2 && <span className="tag-more">+{m.tags.length - 2}</span>}
                  </div>
                  <div className="hist-hints mono">
                    <span style={{ color: "var(--text-1)", fontWeight: 600 }}>{m.actedOn}</span>
                    <span style={{ color: "var(--text-4)" }}>/{m.hintCount}</span>
                  </div>
                  <div className="hist-cta" onClick={(e) => e.stopPropagation()}>
                    <HistShareBtn meeting={m} team={team} />
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="hist-empty">
                <Inbox size={28} />
                <div className="hist-empty-title">
                  {scope === "shared" ? "Nothing shared with you yet" : "No meetings match those filters"}
                </div>
                <div className="hist-empty-sub">
                  {scope === "shared"
                    ? "When teammates share a meeting with you, it'll show up here."
                    : "Try clearing the search or stage filter."}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="dash-aside">
          <section className="card">
            <div className="card-head">
              <div className="card-title">
                <UserIcon size={16} /> Top clients
              </div>
            </div>
            <ul className="client-list">
              {byClient.slice(0, 5).map(([name, count]) => (
                <li key={name}>
                  <div className="client-bar-row">
                    <span className="client-name">{name}</span>
                    <span className="mono client-count">{count}</span>
                  </div>
                  <div className="client-bar">
                    <span style={{ width: `${(count / 5) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-title">
                <Spark size={16} /> Coach insights
              </div>
            </div>
            <ul className="insight-list">
              <li>
                <div className="ins-icon" style={{ background: "var(--gc-green-50)", color: "var(--gc-green)" }}>↑</div>
                <div>
                  <b>Your follow-up rate is up 18%</b> this week. Hint-acted-upon ratio is best in your team.
                </div>
              </li>
              <li>
                <div className="ins-icon" style={{ background: "var(--gc-yellow-50)", color: "#B86E00" }}>!</div>
                <div>
                  <b>3 meetings missed buying-signal flags.</b> Tap into sentiment events earlier.
                </div>
              </li>
              <li>
                <div className="ins-icon" style={{ background: "var(--gc-blue-50)", color: "var(--gc-blue)" }}>i</div>
                <div>
                  <b>Bedrock came up in 7 calls</b> this month. Consider scheduling a deep-dive on Model Garden positioning.
                </div>
              </li>
            </ul>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-title">
                <UserIcon size={16} /> Team activity
              </div>
            </div>
            <ul className="people">
              {team.slice(0, 4).map((p) => (
                <li key={p.uid}>
                  <div className="ppl-avatar" style={{ background: p.color }}>{p.initials}</div>
                  <div className="ppl-info">
                    <div className="ppl-name">
                      {p.name}
                      {p.uid === "u-noa" && <span className="you-badge">YOU</span>}
                    </div>
                    <div className="ppl-role">{p.role}</div>
                  </div>
                  <span className="dot" style={{ background: "var(--gc-green)" }} />
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

