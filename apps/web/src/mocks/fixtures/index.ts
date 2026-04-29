export * from "./team.ts";
export * from "./history.ts";
export * from "./summary.ts";
export * from "./live-meeting.ts";

import type { User } from "@scoach/types";
import { ME } from "./team.ts";

export const ME_USER: User = {
  uid: ME.uid,
  email: ME.email,
  name: ME.name,
  role: "Sr. Cloud SE",
  team: "EMEA Cloud Sales",
  timezone: "Asia/Jerusalem",
  initials: ME.initials,
  color: ME.color,
  settings: {
    language: "en",
    hintPace: "balanced",
    autoSummary: true,
    quietByDefault: false,
  },
  geminiKeyVerified: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-04-24T14:00:00Z",
};
