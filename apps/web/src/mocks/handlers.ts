import type {
  CalendarEvent,
  CreateShareResponse,
  ListCalendarEventsResponse,
  ListHintsResponse,
  ListFollowupsResponse,
  ListHistoryResponse,
  ListMeetingsResponse,
  ListTasksResponse,
  ListTeamMembersResponse,
  Meeting,
  RegenerateEmailResponse,
  SignInResponse,
  TaskView,
  UpdateTaskRequest,
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

// Per-meeting analysis results so "Build knowledge base" returns meeting-specific data
const analysisStore = new Map<string, Record<string, unknown>>();

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

    const dynamicItems: typeof HISTORY = meetings
      .filter((m) => m.id !== LIVE_MEETING.id)
      .map((m) => ({
        id: m.id,
        client: m.account?.name || "Unnamed",
        title: m.title || "Untitled",
        date: m.createdAt,
        duration: "—",
        rep: "Noa Levi",
        stage: m.stage ?? "Discovery",
        status: m.status,
        scheduledAt: m.scheduledAt,
        score: 0,
        sentiment: "neutral" as const,
        tags: [],
        hintCount: 0,
        actedOn: 0,
        avatar: "#4285F4",
      }));

    let items = [...dynamicItems, ...HISTORY];
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
  http.post(u("/meetings/:id/context"), async ({ request }) => {
    const formData = await request.formData();
    const files: Array<{
      id: string;
      name: string;
      size: number;
      sha256: string;
      contentType: string;
      uploadedAt: string;
      indexed: boolean;
    }> = [];
    for (const entry of formData.getAll("files")) {
      if (entry instanceof File) {
        files.push({
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: entry.name,
          size: entry.size,
          sha256: "mock-sha256",
          contentType: entry.type || "application/octet-stream",
          uploadedAt: new Date().toISOString(),
          indexed: true,
        });
      }
    }
    return HttpResponse.json({ files });
  }),
  http.post(u("/meetings/:id/context/analyze"), ({ params }) => {
    const mid = params.id as string;
    const m = meetings.find((x) => x.id === mid);
    const clientName = m?.account?.name || "Client";
    analysisStore.set(mid, {
      status: "pending",
    });
    setTimeout(() => {
      analysisStore.set(mid, {
        status: "done",
        summary: `Context analysis for ${clientName}. Identified key entities, pain points, and relevant tags from uploaded documents.`,
        insights: {
          entities: m?.contextFiles?.length
            ? [...new Set(["Vertex AI", clientName, m.title || "Meeting Topic"].filter(Boolean))]
            : ["Vertex AI"],
          painPoints: m?.goal
            ? [`Addressed in meeting goal: ${m.goal.slice(0, 60)}`]
            : ["No specific pain points identified — upload more context documents"],
          tags: [m?.stage || "Discovery", m?.account?.industry || "Technology"].filter(Boolean),
        },
      });
    }, 1200);
    return HttpResponse.json({ jobId: `job-${Date.now()}` }, { status: 202 });
  }),
  http.get(u("/meetings/:id/context/analysis"), ({ params }) => {
    const mid = params.id as string;
    const result = analysisStore.get(mid);
    if (!result) {
      return HttpResponse.json({ status: "pending" });
    }
    return HttpResponse.json(result);
  }),

  // Meeting tips
  http.get(u("/meetings/:id/tips"), ({ params }) => {
    const mid = params.id as string;
    const m = meetings.find((x) => x.id === mid);
    const tips: string[] = [];
    const stage = (m?.stage ?? "Discovery").toLowerCase();

    if (stage === "intro" || stage === "discovery") {
      tips.push(`Start with open-ended questions about ${m?.account?.name ?? "the client"}'s current cloud strategy — let them talk 70% of the time.`);
      tips.push("Focus on understanding their pain points before presenting any solutions.");
    } else if (stage === "qualification") {
      tips.push(`Confirm ${m?.account?.name ?? "the client"}'s budget range and decision timeline early.`);
      tips.push("Identify the technical champion and economic buyer — they may not be the same person.");
    } else if (stage === "negotiation") {
      tips.push("Lead with value delivered, not pricing. Frame costs as investment against their stated pain points.");
    }

    if (m?.goal) {
      tips.push(`Your goal: "${m.goal.slice(0, 100)}${m.goal.length > 100 ? "…" : ""}" — keep steering back to this.`);
    }
    if (m?.account?.website) {
      tips.push(`Review ${m.account.website} before the call — note their tech stack and recent announcements.`);
    }

    const analysis = analysisStore.get(mid) as Record<string, any> | undefined;
    if (analysis?.insights?.painPoints?.length) {
      tips.push(`Key pain points: ${analysis.insights.painPoints.slice(0, 2).join("; ")}. Reference these to show preparation.`);
    }
    if (analysis?.insights?.entities?.length) {
      const competitors = (analysis.insights.entities as string[]).filter((e: string) =>
        /bedrock|sagemaker|snowflake|databricks|azure|aws|openai/i.test(e),
      );
      if (competitors.length > 0) {
        tips.push(`Competitors in play: ${competitors.join(", ")}. Prepare differentiators.`);
      }
    }

    const nFiles = m?.contextFiles?.length ?? 0;
    if (nFiles > 0) {
      tips.push(`${nFiles} context doc${nFiles > 1 ? "s" : ""} loaded — the coach will use these for targeted hints.`);
    } else {
      tips.push("Upload battlecards or prior call notes in the Context step to improve hint quality.");
    }

    tips.push("Use the Notes panel during the call — notes persist and appear in the post-meeting summary.");

    return HttpResponse.json({ tips });
  }),

  // Hints + followups + summary
  http.get(u("/meetings/:id/hints"), () =>
    HttpResponse.json<ListHintsResponse>({ items: HINTS }),
  ),
  http.get(u("/meetings/:id/followups"), () =>
    HttpResponse.json<ListFollowupsResponse>({ items: FOLLOWUPS }),
  ),
  http.get(u("/meetings/:id/summary"), () => HttpResponse.json(SUMMARY)),
  http.get(u("/meetings/:id/summary-data"), () => HttpResponse.json(SUMMARY)),
  http.post(u("/meetings/:id/summarize"), () =>
    HttpResponse.json({ jobId: `sum-${Date.now()}`, status: "done" }),
  ),
  http.patch(u("/meetings/:id/action-items"), async ({ request }) => {
    const body = (await request.json()) as { actionItems: unknown[] };
    return HttpResponse.json(body.actionItems);
  }),
  http.patch(u("/meetings/:id/email"), async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...SUMMARY.client, ...body, edited: true, editedAt: new Date().toISOString() });
  }),
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

  // Tasks
  http.get(u("/tasks"), ({ request }) => {
    const url = new URL(request.url);
    const clientFilter = url.searchParams.get("client") ?? "";
    const statusFilter = url.searchParams.get("status") ?? "";

    const allTasks: TaskView[] = [
      { taskId: "m-aviv-3::ai-1", meetingId: "m-aviv-3", client: "Aviv Capital", meetingTitle: "Vertex AI Migration · Technical deep-dive", meetingDate: "2026-04-24T14:00:00Z", who: "Noa", what: "Send latency benchmark for europe-west4 vs us-east-1", due: "2026-04-28", done: false },
      { taskId: "m-aviv-3::ai-2", meetingId: "m-aviv-3", client: "Aviv Capital", meetingTitle: "Vertex AI Migration · Technical deep-dive", meetingDate: "2026-04-24T14:00:00Z", who: "Noa", what: "Loop in Lior on architecture review", due: "2026-04-30", done: false },
      { taskId: "m-aviv-3::ai-3", meetingId: "m-aviv-3", client: "Aviv Capital", meetingTitle: "Vertex AI Migration · Technical deep-dive", meetingDate: "2026-04-24T14:00:00Z", who: "Maya", what: "Prepare Model Garden + Anthropic-on-Vertex pricing comparison", due: "2026-05-02", done: false },
      { taskId: "m-rapyd::ai-1", meetingId: "m-rapyd", client: "Rapyd Labs", meetingTitle: "API Gateway migration review", meetingDate: "2026-04-22T10:00:00Z", who: "Noa", what: "Share Apigee hybrid architecture doc", due: "2026-04-25", done: true },
      { taskId: "m-rapyd::ai-2", meetingId: "m-rapyd", client: "Rapyd Labs", meetingTitle: "API Gateway migration review", meetingDate: "2026-04-22T10:00:00Z", who: "Noa", what: "Schedule follow-up with payments team", due: "2026-05-01", done: false },
      { taskId: "m-monday::ai-1", meetingId: "m-monday", client: "Monday.com", meetingTitle: "BigQuery cost optimization", meetingDate: "2026-04-20T09:00:00Z", who: "Noa", what: "Send slot reservation calculator", due: "2026-04-23", done: true },
      { taskId: "m-wix::ai-1", meetingId: "m-wix", client: "Wix", meetingTitle: "Cloud Run scaling discussion", meetingDate: "2026-04-18T11:00:00Z", who: "Noa", what: "Prepare Cloud Run vs GKE comparison deck", due: "2026-04-22", done: false },
      { taskId: "m-pagaya::ai-1", meetingId: "m-pagaya", client: "Pagaya", meetingTitle: "ML Ops pipeline review", meetingDate: "2026-04-15T13:00:00Z", who: "Noa", what: "Set up Vertex Pipelines sandbox", due: "2026-04-20", done: true },
    ];

    let filtered = allTasks;
    if (clientFilter) filtered = filtered.filter((t) => t.client === clientFilter);
    if (statusFilter === "open") filtered = filtered.filter((t) => !t.done);
    if (statusFilter === "done") filtered = filtered.filter((t) => t.done);

    filtered.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.due.localeCompare(b.due);
    });

    return HttpResponse.json<ListTasksResponse>({ items: filtered });
  }),
  http.patch(u("/tasks/:taskId"), async ({ params, request }) => {
    const body = (await request.json()) as UpdateTaskRequest;
    const taskId = decodeURIComponent(params.taskId as string);
    const parts = taskId.split("::");
    return HttpResponse.json<TaskView>({
      taskId,
      meetingId: parts[0] ?? "",
      client: "Aviv Capital",
      meetingTitle: "Meeting",
      meetingDate: new Date().toISOString(),
      who: "Noa",
      what: "Task",
      due: "2026-05-01",
      done: body.done,
    });
  }),

  // Telemetry sink — ack only
  http.post(u("/logs"), () => new HttpResponse(null, { status: 204 })),

  // Calendar — mock upcoming events
  http.get(u("/calendar/events"), () => {
    const now = Date.now();
    const min = (n: number) => n * 60_000;
    const hr = (n: number) => n * 3_600_000;
    const day = (n: number) => n * 86_400_000;

    const mockEvents: CalendarEvent[] = [
      {
        id: "gcal-1",
        summary: "Vertex AI Discussion — Aviv Capital",
        start: new Date(now + min(18)).toISOString(),
        end: new Date(now + min(78)).toISOString(),
        timeZone: "Asia/Jerusalem",
        attendees: [
          { email: "yael@avivcapital.com", displayName: "Yael Ben-David", responseStatus: "accepted" },
          { email: "ran@avivcapital.com", displayName: "Ran Shamir", responseStatus: "tentative" },
          { email: "noalevi@google.com", displayName: "Noa Levi", responseStatus: "accepted", self: true },
        ],
        organizer: { email: "noalevi@google.com", displayName: "Noa Levi" },
        status: "confirmed",
        htmlLink: "https://calendar.google.com/event/gcal-1",
        meetLink: "https://meet.google.com/abc-defg-hij",
      },
      {
        id: "gcal-2",
        summary: "Q3 Pipeline Review",
        start: new Date(now + hr(3)).toISOString(),
        end: new Date(now + hr(4)).toISOString(),
        timeZone: "Asia/Jerusalem",
        attendees: [
          { email: "dana@google.com", displayName: "Dana Cohen", responseStatus: "accepted" },
          { email: "noalevi@google.com", displayName: "Noa Levi", responseStatus: "accepted", self: true },
        ],
        organizer: { email: "dana@google.com", displayName: "Dana Cohen" },
        status: "confirmed",
        htmlLink: "https://calendar.google.com/event/gcal-2",
        meetLink: "https://meet.google.com/xyz-uvwx-rst",
      },
      {
        id: "gcal-3",
        summary: "Model Garden Demo — Leumi Bank",
        start: new Date(now + day(1) + hr(2)).toISOString(),
        end: new Date(now + day(1) + hr(3)).toISOString(),
        timeZone: "Asia/Jerusalem",
        attendees: [
          { email: "shira@leumi.co.il", displayName: "Shira Katz", responseStatus: "accepted" },
          { email: "avi@leumi.co.il", displayName: "Avi Rosen", responseStatus: "needsAction" },
          { email: "noalevi@google.com", displayName: "Noa Levi", responseStatus: "accepted", self: true },
        ],
        organizer: { email: "noalevi@google.com", displayName: "Noa Levi" },
        status: "confirmed",
        htmlLink: "https://calendar.google.com/event/gcal-3",
        meetLink: "https://meet.google.com/lmn-opqr-stu",
      },
      {
        id: "gcal-4",
        summary: "BigQuery Migration Kickoff — Wix",
        start: new Date(now + day(2) + hr(1)).toISOString(),
        end: new Date(now + day(2) + hr(2)).toISOString(),
        timeZone: "Asia/Jerusalem",
        attendees: [
          { email: "tom@wix.com", displayName: "Tom Hadar", responseStatus: "accepted" },
          { email: "noalevi@google.com", displayName: "Noa Levi", responseStatus: "accepted", self: true },
        ],
        organizer: { email: "tom@wix.com", displayName: "Tom Hadar" },
        status: "confirmed",
        htmlLink: "https://calendar.google.com/event/gcal-4",
      },
      {
        id: "gcal-5",
        summary: "Security Posture Review — Check Point",
        start: new Date(now + day(3)).toISOString(),
        end: new Date(now + day(3) + min(45)).toISOString(),
        timeZone: "Asia/Jerusalem",
        attendees: [
          { email: "maya@checkpoint.com", displayName: "Maya Stern", responseStatus: "accepted" },
          { email: "erez@checkpoint.com", displayName: "Erez Navon", responseStatus: "accepted" },
          { email: "noalevi@google.com", displayName: "Noa Levi", responseStatus: "accepted", self: true },
        ],
        organizer: { email: "maya@checkpoint.com", displayName: "Maya Stern" },
        status: "confirmed",
        htmlLink: "https://calendar.google.com/event/gcal-5",
        meetLink: "https://meet.google.com/vwx-yzab-cde",
      },
    ];

    return HttpResponse.json({ events: mockEvents } satisfies ListCalendarEventsResponse);
  }),
];
