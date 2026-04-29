import type {
  ClientEmail,
  CreateShareRequest,
  CreateShareResponse,
  MeetingSummary,
  RegenerateEmailRequest,
} from "@scoach/types";
import { api } from "../../lib/http.ts";

export const summaryApi = {
  fetchSummary: (id: string) => api<MeetingSummary>(`/meetings/${id}/summary`),

  triggerSummarize: (id: string) =>
    api<{ jobId: string; status: string }>(`/meetings/${id}/summarize`, { method: "POST", body: {} }),

  regenerateEmail: (id: string, body: RegenerateEmailRequest) =>
    api<ClientEmail>(`/meetings/${id}/email/regenerate`, { method: "POST", body }),

  share: (id: string, body: CreateShareRequest) =>
    api<CreateShareResponse>(`/meetings/${id}/share`, { method: "POST", body }),

  exportPdf: (id: string) => `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8080"}/meetings/${id}/summary.pdf`,
};
