import type { ListTasksResponse, TaskView, UpdateTaskRequest } from "@scoach/types";
import { api } from "../../lib/http.ts";

export const tasksApi = {
  list: (filters?: { client?: string; status?: string }) =>
    api<ListTasksResponse>("/tasks", { query: filters as Record<string, string> }),

  updateTask: (taskId: string, body: UpdateTaskRequest) =>
    api<TaskView>(`/tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", body }),
};
