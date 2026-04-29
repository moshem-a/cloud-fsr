import type {
  CreateShareResponse,
  ListHintsResponse,
  ListFollowupsResponse,
  ListHistoryResponse,
  ListMeetingsResponse,
  ListTeamMembersResponse,
  Meeting,
  RegenerateEmailResponse,
  SignInResponse,
  UserStatsResponse,
  VerifyGeminiKeyResponse,
} from "@scoach/types";
import { HttpResponse, http } from "msw";

import {
  FOLLOWUPS,
  HINTS,
  HISTORY,
  LIVE_MEETING,
  ME_USER,
  SUMMARY,
  TEAM,
} from "./fixtures/index.ts";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const u = (path: string) => `${API}${path}`;

// In-memory store for created meetings during the session
const meetings: Meeting[] = [LIVE_MEETING];

export const handlers = [
  // Health
  http.get(u("/healthz"), () => HttpResponse.json({ ok: true, ts: Date.now() })),

  // Auth
  http.post(u("/auth/signin"), () =>
    HttpResponse.json<SignInResponse>({
      user: ME_USER,
      sessionExpiresAt: Date.now() + 60 * 60 * 1000,
    }),
  ),
  http.post(u("/auth/verify-gemini-key"), async ({ request }) => {
    const body = (await request.json()) as { key: string };
    const valid = /^AIza[\w-]{20,}$/.test(body.key ?? "");
    return HttpResponse.json<VerifyGeminiKeyResponse>(
      valid
        ? { valid: true, quotaTier: "paid", modelAvailable: "gemini-2.5-pro" }
        : { valid: false, error: "Key format invalid (expected AIza…)" },
    );
  }),
  http.post(u("/auth/signout"), () => new HttpResponse(null, { status: 204 })),

  // Users
  http.get(u("/users/me"), () => HttpResponse.json(ME_USER)),
  http.put(u("/user/profile"), async ({ request }) => {
    const patch = (await request.json()) as Partial<typeof ME_USER>;
    return HttpResponse.json({ ...ME_USER, ...patch });
  }),
  http.put(u("/user/settings"), async ({ request }) => {
    const patch = (await request.json()) as Partial<typeof ME_USER.settings>;
    return HttpResponse.json({ ...ME_USER, settings: { ...ME_USER.settings, ...patch } });
  }),
  http.get(u("/users/me/stats"), () =>
    HttpResponse.json<UserStatsResponse>({
      thisWeek: { meetings: 7, minutes: 312, hintsActedPct: 64, avgConfidence: 0.78, buyingSignals: 4 },
      trend: { meetings: 2, minutes: 44, hintsActedPct: 8 },
    }),
  ),

  // Meetings list
  http.get(u("/meetings"), () =>
    HttpResponse.json<ListMeetingsResponse>({ items: meetings }),
  ),
  http.get(u("/meetings/history"), ({ request }) => {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") ?? "mine";
    const stage = url.searchParams.get("stage");
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";

    let items = HISTORY;
    if (scope === "shared") items = items.filter((h) => h.sharedBy);
    else items = items.filter((h) => !h.sharedBy);
    if (stage && stage !== "all") items = items.filter((h) => h.stage === stage);
    if (search) {
      items = items.filter(
        (h) =>
          h.client.toLowerCase().includes(search) ||
          h.title.toLowerCase().includes(search) ||
          h.tags.some((t) => t.toLowerCase().includes(search)),
      );
    }
    return HttpResponse.json<ListHistoryResponse>({ items });
  }),
  http.get(u("/meetings/:id"), ({ params }) => {
    const m = meetings.find((x) => x.id === params.id);
    return m ? HttpResponse.json(m) : new HttpResponse(null, { status: 404 });
  }),
  http.post(u("/meetings"), async ({ request }) => {
    const body = (await request.json()) as { account: { name: string; website?: string }; title: string; stage: Meeting["stage"] };
    const id = `m-${Date.now().toString(36)}`;
    const m: Meeting = {
      id,
      ownerUid: ME_USER.uid,
      account: { name: body.account.name, website: body.account.website },
      title: body.title,
      stage: body.stage,
      language: "auto",
      participants: [],
      contextFiles: [],
      contextItems: [],
      notes: [],
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    meetings.push(m);
    return HttpResponse.json(m, { status: 201 });
  }),
  http.patch(u("/meetings/:id"), async ({ params, request }) => {
    const idx = meetings.findIndex((x) => x.id === params.id);
    if (idx < 0) return new HttpResponse(null, { status: 404 });
    const patch = (await request.json()) as Partial<Meeting>;
    meetings[idx] = { ...meetings[idx]!, ...patch, updatedAt: new Date().toISOString() };
    return HttpResponse.json(meetings[idx]);
  }),

  // Pre-meeting context (stubs — Sprint 2 BE wires real GCS + Gemini)
  http.post(u("/meetings/:id/context"), () =>
    HttpResponse.json({
      files: [],
    }),
  ),
  http.post(u("/meetings/:id/context/analyze"), () =>
    HttpResponse.json({ jobId: `job-${Date.now()}` }, { status: 202 }),
  ),
  http.get(u("/meetings/:id/context/analysis"), () =>
    HttpResponse.json({
      status: "done",
      summary: "Series B fintech, algo trading desk. EU latency-sensitive workloads. VPC-SC + CMEK requirements.",
      insights: {
        entities: ["Algorithmic trading", "Vertex AI", "Bedrock", "CMEK", "VPC-SC"],
        painPoints: ["EU latency >1s", "Inference cost climbing", "No model versioning"],
        tags: ["Fintech", "EMEA", "Cost-sensitive", "Latency-critical", "Compliance"],
      },
    }),
  ),

  // Hints + followups + summary
  http.get(u("/meetings/:id/hints"), () =>
    HttpResponse.json<ListHintsResponse>({ items: HINTS }),
  ),
  http.get(u("/meetings/:id/followups"), () =>
    HttpResponse.json<ListFollowupsResponse>({ items: FOLLOWUPS }),
  ),
  http.get(u("/meetings/:id/summary"), () => HttpResponse.json(SUMMARY)),
  http.post(u("/meetings/:id/email/regenerate"), async ({ request }) => {
    const body = (await request.json()) as { tone: "formal" | "warm" | "brief" };
    return HttpResponse.json<RegenerateEmailResponse>({ ...SUMMARY.client, tone: body.tone });
  }),

  // Sharing
  http.post(u("/meetings/:id/share"), () =>
    HttpResponse.json<CreateShareResponse>({ shares: [] }),
  ),

  // Team
  http.get(u("/team/members"), ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    const items = q
      ? TEAM.filter((t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q))
      : TEAM;
    return HttpResponse.json<ListTeamMembersResponse>({ items });
  }),

  // Telemetry sink — ack only
  http.post(u("/logs"), () => new HttpResponse(null, { status: 204 })),
];
