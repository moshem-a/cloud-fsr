import type { AdminMeetingView, AdminUser } from "@scoach/types";
import { api } from "../../lib/http.ts";

export const adminApi = {
  fetchUsers: () => api<{ users: AdminUser[] }>("/admin/users").then((r) => r.users ?? []),

  fetchUserMeetings: (uid: string) =>
    api<{ meetings: AdminMeetingView[] }>(`/admin/users/${uid}/meetings`).then((r) => r.meetings),
};
