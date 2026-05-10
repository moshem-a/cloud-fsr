import type {
  ContextAnalysisResult,
  Meeting,
  MeetingSetup,
  PriorMeetingsResponse,
  UploadContextResponse,
} from "@scoach/types";
import { api } from "../../lib/http.ts";

export const preMeetingApi = {
  fetchMeeting: (id: string) => api<Meeting>(`/meetings/${id}`),

  patchMeeting: (id: string, patch: Partial<Meeting>) =>
    api<Meeting>(`/meetings/${id}`, { method: "PATCH", body: patch }),

  setup: (id: string, body: MeetingSetup) =>
    api<Meeting>(`/meetings/${id}/setup`, { method: "POST", body }),

  uploadContext: (id: string, files: File[]) => {
    const fd = new FormData();
    for (const f of files) fd.append("files", f, f.name);
    return api<UploadContextResponse>(`/meetings/${id}/context`, { method: "POST", body: fd });
  },

  startAnalyze: (id: string) =>
    api<{ jobId: string }>(`/meetings/${id}/context/analyze`, { method: "POST", body: {} }),

  pollAnalyze: (id: string) => api<ContextAnalysisResult>(`/meetings/${id}/context/analysis`),

  fetchTips: (id: string) => api<{ tips: string[] }>(`/meetings/${id}/tips`),

  scheduleMeeting: (id: string, scheduledAt: string) =>
    api<Meeting>(`/meetings/${id}`, { method: "PATCH", body: { scheduledAt } }),

  fetchPriorMeetings: (accountName: string) =>
    api<PriorMeetingsResponse>(`/accounts/${encodeURIComponent(accountName)}/prior-meetings`),
};
