import type {
  SignInResponse,
  UserStatsResponse,
  VerifyGeminiKeyResponse,
} from "@scoach/types";
import { api } from "../../lib/http.ts";

export const authApi = {
  fetchMe: () => api<SignInResponse["user"]>("/users/me"),

  fetchStats: () => api<UserStatsResponse>("/users/me/stats"),

  verifyGeminiKey: (key: string) =>
    api<VerifyGeminiKeyResponse>("/auth/verify-gemini-key", {
      method: "POST",
      body: { key },
    }),

  signOut: () => api<void>("/auth/signout", { method: "POST" }),
};
