import type {
  ActionItem,
  ClientEmail,
  CreateShareRequest,
  CreateShareResponse,
  MeetingSummary,
  RegenerateEmailRequest,
  UpdateEmailRequest,
} from "@scoach/types";
import { getIdToken } from "../../lib/firebase.ts";
import { api } from "../../lib/http.ts";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL === undefined
    ? "http://localhost:8080"
    : import.meta.env.VITE_API_BASE_URL;

export const summaryApi = {
  fetchSummary: (id: string) => api<MeetingSummary>(`/meetings/${id}/summary-data`),

  triggerSummarize: (id: string) =>
    api<{ jobId: string; status: string }>(`/meetings/${id}/summarize`, { method: "POST", body: {} }),

  regenerateEmail: (id: string, body: RegenerateEmailRequest) =>
    api<ClientEmail>(`/meetings/${id}/email/regenerate`, { method: "POST", body }),

  updateEmail: (id: string, body: UpdateEmailRequest) =>
    api<ClientEmail>(`/meetings/${id}/email`, { method: "PATCH", body }),

  updateActionItems: (id: string, actionItems: ActionItem[]) =>
    api<ActionItem[]>(`/meetings/${id}/action-items`, { method: "PATCH", body: { actionItems } }),

  share: (id: string, body: CreateShareRequest) =>
    api<CreateShareResponse>(`/meetings/${id}/share`, { method: "POST", body }),

  /**
   * Fetches the PDF as a Blob with the user's auth token. We don't use
   * `window.open` because that opens a new tab without the Authorization
   * header → Cloud Run 401s.
   */
  exportPdf: async (id: string): Promise<Blob> => {
    const token = await getIdToken().catch(() => null);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (import.meta.env.DEV) headers.Authorization = "Bearer dev-token";
    const res = await fetch(`${API_BASE}/meetings/${id}/summary.pdf`, { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`PDF export failed: HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ""}`);
    }
    return res.blob();
  },
};
