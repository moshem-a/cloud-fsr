import type { TaskView } from "@scoach/types";
import { Notebook } from "@scoach/ui/icons";
import { Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { DashHeader } from "../../dashboard/components/DashHeader.tsx";
import { tasksApi } from "../api.ts";

type StatusFilter = "all" | "open" | "done";
type EditableField = "who" | "what" | "due";

export function TasksScreen() {
  const { client: initialClient } = useSearch({ from: "/_app/tasks" });
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [clientFilter, setClientFilter] = useState<string>(initialClient ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editField, setEditField] = useState<EditableField | null>(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    setLoading(true);
    const query: Record<string, string> = {};
    if (statusFilter !== "all") query.status = statusFilter;
    if (clientFilter) query.client = clientFilter;
    setError(null);
    tasksApi
      .list(query)
      .then((res) => setTasks(res.items))
      .catch((err) => {
        console.error("[tasks] fetch failed", err);
        setError(err instanceof Error ? err.message : "Failed to load tasks");
      })
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

  function startEdit(task: TaskView, field: EditableField) {
    setEditingTaskId(task.taskId);
    setEditField(field);
    setEditDraft(task[field]);
  }

  function commitEdit() {
    if (!editingTaskId || !editField) return;
    const taskId = editingTaskId;
    const field = editField;
    const value = editDraft.trim();

    const old = tasks.find((t) => t.taskId === taskId)?.[field] ?? "";
    if (value === old) {
      setEditingTaskId(null);
      setEditField(null);
      return;
    }

    setTasks((prev) =>
      prev.map((t) => (t.taskId === taskId ? { ...t, [field]: value } : t)),
    );
    setEditingTaskId(null);
    setEditField(null);

    void tasksApi.updateTask(taskId, { [field]: value }).catch(() => {
      setTasks((prev) =>
        prev.map((t) => (t.taskId === taskId ? { ...t, [field]: old } : t)),
      );
    });
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setEditField(null);
  }

  function isOverdue(due: string): boolean {
    if (!due) return false;
    return new Date(due) < new Date() && due !== new Date().toISOString().slice(0, 10);
  }

  function isEditing(taskId: string, field: EditableField) {
    return editingTaskId === taskId && editField === field;
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

        {error && (
          <div className="tasks-empty" style={{ color: "var(--gc-red, #b00020)" }}>
            {error}
          </div>
        )}
        {loading ? (
          <div className="tasks-empty">Loading tasks...</div>
        ) : !error && tasks.length === 0 ? (
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

                {isEditing(t.taskId, "who") ? (
                  <input
                    type="text"
                    className="task-edit-input"
                    value={editDraft}
                    autoFocus
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    onBlur={commitEdit}
                  />
                ) : (
                  <span className="task-who task-editable" onClick={() => startEdit(t, "who")}>
                    {t.who || " "}
                  </span>
                )}

                {isEditing(t.taskId, "what") ? (
                  <input
                    type="text"
                    className="task-edit-input"
                    value={editDraft}
                    autoFocus
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    onBlur={commitEdit}
                  />
                ) : (
                  <span className="task-what task-editable" onClick={() => startEdit(t, "what")}>
                    {t.what || " "}
                  </span>
                )}

                {isEditing(t.taskId, "due") ? (
                  <input
                    type="date"
                    className="task-edit-input"
                    value={editDraft}
                    autoFocus
                    onChange={(e) => {
                      setEditDraft(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    onBlur={commitEdit}
                  />
                ) : (
                  <span
                    className={`task-due mono task-editable ${isOverdue(t.due) && !t.done ? "overdue" : ""}`}
                    onClick={() => startEdit(t, "due")}
                  >
                    {t.due || " "}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
