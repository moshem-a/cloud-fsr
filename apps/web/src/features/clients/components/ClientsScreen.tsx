import type { HistoryItem, TaskView } from "@scoach/types";
import { Search, User as UserIcon } from "@scoach/ui/icons";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { dashboardApi } from "../../dashboard/api.ts";
import { DashHeader } from "../../dashboard/components/DashHeader.tsx";
import { tasksApi } from "../../tasks/api.ts";

interface ClientInfo {
  name: string;
  meetingCount: number;
  openTasks: number;
  lastMeeting: string;
  avatar: string;
}

export function ClientsScreen() {
  const nav = useNavigate();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardApi.fetchHistory({}),
      tasksApi.list(),
    ])
      .then(([hist, t]) => {
        setHistory(hist.items);
        setTasks(t.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const clients = useMemo(() => {
    const map = new Map<string, ClientInfo>();

    for (const m of history) {
      const existing = map.get(m.client);
      if (existing) {
        existing.meetingCount++;
        if (m.date > existing.lastMeeting) {
          existing.lastMeeting = m.date;
        }
      } else {
        map.set(m.client, {
          name: m.client,
          meetingCount: 1,
          openTasks: 0,
          lastMeeting: m.date,
          avatar: m.avatar ?? "#1A73E8",
        });
      }
    }

    for (const t of tasks) {
      if (!t.done) {
        const c = map.get(t.client);
        if (c) c.openTasks++;
      }
    }

    let result = Array.from(map.values());
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    return result.sort((a, b) => b.meetingCount - a.meetingCount);
  }, [history, tasks, search]);

  function formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="dash">
      <DashHeader onStartNew={() => {}} />
      <div className="clients-body">
        <div className="clients-header">
          <h2 className="clients-title">
            <UserIcon size={20} /> Clients
          </h2>
          <span className="clients-count">{clients.length} clients</span>
          <div className="clients-search">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="tasks-empty">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="tasks-empty">
            {search ? "No clients match your search." : "No clients yet. Start a meeting to see clients here."}
          </div>
        ) : (
          <div className="clients-grid">
            {clients.map((c) => (
              <button
                key={c.name}
                type="button"
                className="client-card"
                onClick={() => nav({ to: "/tasks", search: { client: c.name } })}
              >
                <div className="client-card-top">
                  <div className="client-card-avatar" style={{ background: c.avatar }}>
                    {c.name[0]?.toUpperCase()}
                  </div>
                  <div className="client-card-name">{c.name}</div>
                </div>
                <div className="client-card-stats">
                  <div className="client-stat">
                    <span className="client-stat-val">{c.meetingCount}</span>
                    <span className="client-stat-label">meetings</span>
                  </div>
                  <div className="client-stat">
                    <span className="client-stat-val">{c.openTasks}</span>
                    <span className="client-stat-label">open tasks</span>
                  </div>
                  <div className="client-stat">
                    <span className="client-stat-val client-stat-date">{formatDate(c.lastMeeting)}</span>
                    <span className="client-stat-label">last meeting</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
