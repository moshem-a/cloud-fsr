import type {
  CreateMeetingRequest,
  ListHistoryQuery,
  ListHistoryResponse,
  ListTeamMembersResponse,
  Meeting,
  UserStatsResponse,
} from "@scoach/types";
import { api } from "../../lib/http.ts";

export const dashboardApi = {
  fetchHistory: (q: ListHistoryQuery) =>
    api<ListHistoryResponse>("/meetings/history", { query: q as Record<string, string> }),

  fetchStats: () => api<UserStatsResponse>("/users/me/stats"),

  fetchTeam: (q?: string) =>
    api<ListTeamMembersResponse>("/team/members", { query: q ? { q } : undefined }),

  createMeeting: (body: CreateMeetingRequest) =>
    api<Meeting>("/meetings", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": `mk-${Date.now()}-${Math.random().toString(36).slice(2)}` },
    }),

  shareMeeting: (id: string, recipients: { email: string; permission: "view" | "comment" | "edit" }[]) =>
    api(`/meetings/${id}/share`, { method: "POST", body: { recipients } }),
};
