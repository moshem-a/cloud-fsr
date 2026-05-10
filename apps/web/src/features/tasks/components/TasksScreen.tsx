import type { TaskView } from "@scoach/types";
import { Notebook } from "@scoach/ui/icons";
import { Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { DashHeader } from "../../dashboard/components/DashHeader.tsx";
import { tasksApi } from "../api.ts";

type StatusFilter = "all" | "open" | "done";

export function TasksScreen() {
  const { client: initialClient } = useSearch({ from: "/_app/tasks" });
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [clientFilter, setClientFilter] = useState<string>(initialClient ?? "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const query: Record<string, string> = {};
    if (statusFilter !== "all") query.status = statusFilter;
    if (clientFilter) query.client = clientFilter;
    tasksApi
      .list(query)
      .then((res) => setTasks(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter, clientFilter]);

  const clients = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) set.add(t.client);
    return Array.from(set).sort();
  }, [tasks]);

  function toggleDone(task: TaskView) {
    const next = !task.done;
    setTasks((prev) =>
      prev.map((t) => (t.taskId === task.taskId ? { ...t, done: next } : t)),
    );
    void tasksApi.updateTask(task.taskId, { done: next }).catch(() => {
      setTasks((prev) =>
        prev.map((t) => (t.taskId === task.taskId ? { ...t, done: !next } : t)),
      );
    });
  }

  function isOverdue(due: string): boolean {
    if (!due) return false;
    return new Date(due) < new Date() && due !== new Date().toISOString().slice(0, 10);
  }

  return (
    <div className="dash">
      <DashHeader onStartNew={() => {}} />
      <div className="tasks-body">
        <div className="tasks-header">
          <h2 className="tasks-title">
            <Notebook size={20} /> Tasks
          </h2>
          <span className="tasks-count">{tasks.filter((t) => !t.done).length} open</span>
        </div>

        <div className="tasks-filters">
          <div className="seg">
            <button
              type="button"
              className={statusFilter === "all" ? "on" : ""}
              onClick={() => setStatusFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={statusFilter === "open" ? "on" : ""}
              onClick={() => setStatusFilter("open")}
            >
              Open
            </button>
            <button
              type="button"
              className={statusFilter === "done" ? "on" : ""}
              onClick={() => setStatusFilter("done")}
            >
              Done
            </button>
          </div>

          <select
            className="tasks-client-filter"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="tasks-empty">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="tasks-empty">
            No tasks found. Action items from meeting summaries will appear here.
          </div>
        ) : (
          <div className="tasks-table">
            <div className="tasks-table-head">
              <span />
              <span>Client</span>
              <span>Meeting</span>
              <span>Owner</span>
              <span>Task</span>
              <span>Due</span>
            </div>
            {tasks.map((t) => (
              <div key={t.taskId} className={`tasks-row ${t.done ? "done" : ""}`}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleDone(t)}
                />
                <span className="task-client">{t.client}</span>
                <Link
                  to="/meetings/$id/summary"
                  params={{ id: t.meetingId }}
                  className="task-meeting"
                >
                  {t.meetingTitle}
                </Link>
                <span className="task-who">{t.who}</span>
                <span className="task-what">{t.what}</span>
                <span className={`task-due mono ${isOverdue(t.due) && !t.done ? "overdue" : ""}`}>
                  {t.due}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
