import type { CoachInsight, HistoryItem, TaskView, TeamMember, UserStatsResponse } from "@scoach/types";
import { Chev, Inbox, Search, Spark, Trash, User as UserIcon } from "@scoach/ui/icons";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { useAuthStore } from "../../auth/store.ts";
import { tasksApi } from "../../tasks/api.ts";
import { dashboardApi } from "../api.ts";
import { DashHeader } from "./DashHeader.tsx";
import { HistShareBtn } from "./HistShareBtn.tsx";
import { StatTile } from "./StatTile.tsx";

type Scope = "mine" | "shared" | "drafts";
type StageFilter = "all" | "discovery" | "qualification" | "negotiation";

function formatHistoryDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return { date, time };
}

export function Dashboard() {
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const displayName = useAuthStore((s) => s.displayName);
  const storeEmail = useAuthStore((s) => s.email);
  const firstName = (user?.name ?? displayName ?? storeEmail?.split("@")[0] ?? "").split(" ")[0];

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StageFilter>("all");
  const [scope, setScope] = useState<Scope>("mine");

  const [allHistory, setAllHistory] = useState<HistoryItem[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [allTasks, setAllTasks] = useState<TaskView[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [insights, setInsights] = useState<CoachInsight[]>([]);

  useEffect(() => {
    Promise.all([
      dashboardApi.fetchHistory({}),
      dashboardApi.fetchTeam(),
      dashboardApi.fetchStats(),
    ])
      .then(([hist, t, s]) => {
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
      .catch(() => {});

    tasksApi.list().then((res) => setAllTasks(res.items)).catch(() => {});
    dashboardApi.fetchInsights().then((items) => setInsights(items)).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const items = allHistory.filter((m) => {
      const isShared = !!m.sharedBy;
      const isDraft = m.status === "draft";
      if (scope === "mine" && (isShared || isDraft)) return false;
      if (scope === "shared" && !isShared) return false;
      if (scope === "drafts" && !isDraft) return false;
      if (filter !== "all" && m.stage.toLowerCase() !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${m.client} ${m.title}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    items.sort((a, b) => {
      const aScheduled = a.scheduledAt && new Date(a.scheduledAt) > new Date() ? 1 : 0;
      const bScheduled = b.scheduledAt && new Date(b.scheduledAt) > new Date() ? 1 : 0;
      const aLive = a.status === "live" ? 1 : 0;
      const bLive = b.status === "live" ? 1 : 0;
      const aPriority = aLive * 3 + aScheduled * 2;
      const bPriority = bLive * 3 + bScheduled * 2;
      if (bPriority !== aPriority) return bPriority - aPriority;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    return items;
  }, [allHistory, scope, filter, search]);

  const myCount = useMemo(() => allHistory.filter((m) => !m.sharedBy && m.status !== "draft").length, [allHistory]);
  const sharedCount = useMemo(() => allHistory.filter((m) => !!m.sharedBy).length, [allHistory]);
  const draftCount = useMemo(() => allHistory.filter((m) => m.status === "draft").length, [allHistory]);
  const openTaskCount = useMemo(() => allTasks.filter((t) => !t.done).length, [allTasks]);

  const byClient = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of allHistory) counts[h.client] = (counts[h.client] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allHistory]);

  const tasksByMeeting = useMemo(() => {
    const map = new Map<string, TaskView[]>();
    for (const t of allTasks) {
      const arr = map.get(t.meetingId) ?? [];
      arr.push(t);
      map.set(t.meetingId, arr);
    }
    return map;
  }, [allTasks]);

  function toggleTaskDone(task: TaskView) {
    const next = !task.done;
    setAllTasks((prev) =>
      prev.map((t) => (t.taskId === task.taskId ? { ...t, done: next } : t)),
    );
    void tasksApi.updateTask(task.taskId, { done: next }).catch(() => {
      setAllTasks((prev) =>
        prev.map((t) => (t.taskId === task.taskId ? { ...t, done: !next } : t)),
      );
    });
  }

  function defaultTitle(): string {
    const d = new Date();
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `Meeting — ${date}, ${time}`;
  }

  async function startNew() {
    setCreating(true);
    try {
      const m = await dashboardApi.createMeeting({
        account: { name: "" },
        title: defaultTitle(),
        stage: "Intro",
      });
      nav({ to: "/meetings/$id/setup", params: { id: m.id } });
    } finally {
      setCreating(false);
    }
  }

  async function quickLive() {
    setCreating(true);
    try {
      const m = await dashboardApi.createMeeting({
        account: { name: "" },
        title: defaultTitle(),
        stage: "Intro",
      });
      nav({ to: "/meetings/$id/live", params: { id: m.id } });
    } finally {
      setCreating(false);
    }
  }

  function openMeeting(id: string, status?: string) {
    if (status === "draft") {
      nav({ to: "/meetings/$id/setup", params: { id } });
    } else if (status === "live") {
      nav({ to: "/meetings/$id/live", params: { id } });
    } else {
      nav({ to: "/meetings/$id/summary", params: { id } });
    }
  }

  function deleteMeeting(id: string, client: string) {
    if (!confirm(`Delete meeting with ${client || "this client"}? This cannot be undone.`)) return;
    setAllHistory((prev) => prev.filter((m) => m.id !== id));
    void dashboardApi.deleteMeeting(id).catch(() => {
      dashboardApi.fetchHistory({}).then((r) => setAllHistory(r.items)).catch(() => {});
    });
  }

  return (
    <div className="dash">
      <DashHeader onStartNew={startNew} />

      <div className="dash-grid">
        {/* Hero / quick start */}
        <section className="dash-hero">
          <div className="dash-hero-text">
            <div className="kicker">Welcome back{firstName ? `, ${firstName}` : ""}</div>
            <h1 className="dash-title">{stats?.thisWeek.meetings ?? allHistory.length} meetings this week.</h1>
            <p className="dash-sub">
              {openTaskCount > 0
                ? `You have ${openTaskCount} open action item${openTaskCount === 1 ? "" : "s"} across your meetings.`
                : "All caught up — no open action items."}
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
            <StatTile label="Meetings this week" value={stats?.thisWeek.meetings ?? 0} trend={stats?.trend.meetings ? `+${stats.trend.meetings}` : "—"} color="blue" />
            <StatTile label="Avg. confidence" value={stats?.thisWeek.avgConfidence != null ? `${Math.round(stats.thisWeek.avgConfidence * 100)}%` : "—"} trend="—" color="green" />
            <StatTile label="Open tasks" value={stats?.thisWeek.openTasks ?? openTaskCount} trend={openTaskCount > 0 ? `${openTaskCount} pending` : "all done"} color="yellow" />
            <StatTile label="Acted on hints" value={`${stats?.thisWeek.hintsActedPct ?? 0}%`} trend="—" color="red" />
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
                <button type="button" className={scope === "drafts" ? "on" : ""} onClick={() => setScope("drafts")}>
                  Drafts <span className="seg-count">{draftCount}</span>
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
              <div>Actions</div>
              <div>Hints</div>
              <div></div>
            </div>
            {filtered.map((m) => {
              const { date, time } = formatHistoryDate(m.date);
              const meetingTasks = tasksByMeeting.get(m.id) ?? [];
              const actionCount = m.actionItemCount ?? meetingTasks.length;
              const isExpanded = expandedId === m.id;
              return (
                <div key={m.id} className="hist-row-group">
                  <button
                    type="button"
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
                        {m.participants && m.participants.length > 0 && (
                          <div className="hist-participants mono">
                            {m.participants.slice(0, 2).join(", ")}
                            {m.participants.length > 2 && ` +${m.participants.length - 2}`}
                          </div>
                        )}
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
                      <span className={`stage-pill stage-${m.stage.toLowerCase()}`}>{m.meetingType ? `${m.meetingType[0]!.toUpperCase()}${m.meetingType.slice(1)}` : m.stage}</span>
                    </div>
                    <div
                      className="hist-actions"
                      onClick={(e) => {
                        if (actionCount > 0) {
                          e.stopPropagation();
                          e.preventDefault();
                          setExpandedId(isExpanded ? null : m.id);
                        }
                      }}
                    >
                      {actionCount > 0 ? (
                        <span className="action-badge">
                          {actionCount}
                        </span>
                      ) : (
                        <span className="action-badge empty">—</span>
                      )}
                    </div>
                    <div className="hist-hints mono">
                      <span style={{ color: "var(--text-1)", fontWeight: 600 }}>{m.actedOn}</span>
                      <span style={{ color: "var(--text-4)" }}>/{m.hintCount}</span>
                    </div>
                    <div className="hist-cta" onClick={(e) => e.stopPropagation()}>
                      <HistShareBtn meeting={m} team={team} />
                      <button
                        type="button"
                        className="hist-delete-btn"
                        title="Delete meeting"
                        onClick={() => deleteMeeting(m.id, m.client)}
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  </button>
                  {isExpanded && meetingTasks.length > 0 && (
                    <div className="hist-expand-panel">
                      <div className="expand-header">Action items — {m.client}</div>
                      {meetingTasks.map((task) => (
                        <label key={task.taskId} className={`expand-task${task.done ? " done" : ""}`}>
                          <input
                            type="checkbox"
                            checked={task.done}
                            onChange={() => toggleTaskDone(task)}
                          />
                          <span className="expand-who">{task.who}</span>
                          <span className="expand-what">{task.what}</span>
                          <span className="expand-due mono">{task.due}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="hist-empty">
                <Inbox size={28} />
                <div className="hist-empty-title">
                  {scope === "shared" ? "Nothing shared with you yet" : scope === "drafts" ? "No draft meetings" : "No meetings match those filters"}
                </div>
                <div className="hist-empty-sub">
                  {scope === "shared"
                    ? "When teammates share a meeting with you, it'll show up here."
                    : scope === "drafts"
                      ? "Meetings you start but haven't begun will appear here."
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
              {insights.length > 0 ? insights.map((ins, i) => {
                const iconStyle = ins.icon === "up"
                  ? { background: "var(--gc-green-50)", color: "var(--gc-green)" }
                  : ins.icon === "warn"
                    ? { background: "var(--gc-yellow-50)", color: "#B86E00" }
                    : { background: "var(--gc-blue-50)", color: "var(--gc-blue)" };
                const iconChar = ins.icon === "up" ? "↑" : ins.icon === "warn" ? "!" : "i";
                return (
                  <li key={i}>
                    <div className="ins-icon" style={iconStyle}>{iconChar}</div>
                    <div>
                      <b>{ins.title}</b> {ins.detail}
                    </div>
                  </li>
                );
              }) : (
                <li>
                  <div className="ins-icon" style={{ background: "var(--gc-blue-50)", color: "var(--gc-blue)" }}>i</div>
                  <div>Complete a few meetings to see personalized insights here.</div>
                </li>
              )}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

