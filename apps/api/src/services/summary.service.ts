import { VertexAI } from "@google-cloud/vertexai";
import type {
  ClientEmail,
  InternalSummary,
  Meeting,
  MeetingSummary,
  TranscriptLine,
} from "@scoach/types";
import { randomUUID } from "node:crypto";

import { isGeminiEnabled } from "./gemini.service.ts";

const PROJECT = process.env.GCP_PROJECT_ID;
const REGION = process.env.VERTEX_REGION || "us-central1";
const MODEL = "gemini-2.5-pro";

let _vertex: VertexAI | null = null;
function vertex(): VertexAI {
  if (_vertex) return _vertex;
  _vertex = new VertexAI({ project: PROJECT!, location: REGION });
  return _vertex;
}

const INTERNAL_SYSTEM = `You are a senior sales-enablement analyst. Read a sales call transcript and produce a JSON internal summary.
Strict JSON output:
{
  "confidence": <0-1>,
  "health": "hot"|"warm"|"cool"|"cold",
  "score": <0-100>,
  "wentWell": ["..."],
  "couldImprove": ["..."],
  "upsell": [{"name":"...","reason":"...","estimatedMonthlyArr":<int|null>}],
  "risks": ["..."],
  "needs": { "stated": ["..."], "actual": ["..."] },
  "actionItems": [{"who":"...","what":"...","due":"YYYY-MM-DD"}],
  "topMoments": [{"t":"MM:SS","type":"...","quote":"..."}]
}`;

const EMAIL_SYSTEM = `You are a client-facing sales rep. Write a follow-up email recapping a sales call.
Tone is one of: formal | warm | brief.
Strict JSON output:
{ "subject":"...", "greeting":"...", "body":["...","..."], "signoff":"..." }
The email MUST contain no internal scoring, no competitive analysis, and no proprietary numbers.`;

function transcriptToText(transcript: TranscriptLine[]): string {
  return transcript
    .map((l) => `[${l.t}] ${l.name} (${l.lang}): ${l.text}`)
    .join("\n");
}

async function callPro<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  const model = vertex().getGenerativeModel({
    model: MODEL,
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
  });
  const resp = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
  });
  const raw = resp.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  return JSON.parse(cleaned || "{}") as T;
}

export async function generateInternalSummary(
  meeting: Meeting,
  transcript: TranscriptLine[],
): Promise<InternalSummary> {
  const prompt = `Meeting: ${meeting.title} with ${meeting.account.name} (${meeting.stage}).
Goal: ${meeting.goal ?? "(none stated)"}
Transcript:
${transcriptToText(transcript)}`;
  const raw = await callPro<Partial<InternalSummary>>(INTERNAL_SYSTEM, prompt);
  return {
    confidence: raw.confidence ?? 0.6,
    health: raw.health ?? "warm",
    score: raw.score ?? 70,
    wentWell: raw.wentWell ?? [],
    couldImprove: raw.couldImprove ?? [],
    upsell: raw.upsell ?? [],
    risks: raw.risks ?? [],
    needs: raw.needs ?? { stated: [], actual: [] },
    actionItems: (raw.actionItems ?? []).map((a) => ({
      id: randomUUID(),
      who: a.who,
      what: a.what,
      due: a.due,
      done: false,
    })),
    topMoments: raw.topMoments ?? [],
  };
}

export async function generateClientEmail(
  meeting: Meeting,
  transcript: TranscriptLine[],
  tone: ClientEmail["tone"],
): Promise<ClientEmail> {
  if (!isGeminiEnabled()) {
    return { ...defaultClient(meeting), tone };
  }
  try {
    const prompt = `Meeting: ${meeting.title} with ${meeting.account.name}.
Tone: ${tone}.
Transcript:
${transcriptToText(transcript)}`;
    const raw = await callPro<Partial<ClientEmail>>(EMAIL_SYSTEM, prompt);
    return {
      subject: raw.subject ?? `Recap — ${meeting.title}`,
      greeting: raw.greeting ?? `Hi ${meeting.account.contact ?? "team"},`,
      body: raw.body ?? [],
      signoff: raw.signoff ?? "Best,",
      tone,
    };
  } catch {
    return { ...defaultClient(meeting), tone };
  }
}

export async function generateMeetingSummary(
  meeting: Meeting,
  transcript: TranscriptLine[],
): Promise<MeetingSummary> {
  const startedAt = Date.now();
  const fallback = !isGeminiEnabled();

  const internal: InternalSummary = fallback
    ? defaultInternal()
    : await generateInternalSummary(meeting, transcript).catch(() => defaultInternal());

  const client: ClientEmail = fallback
    ? defaultClient(meeting)
    : await generateClientEmail(meeting, transcript, "warm").catch(() => defaultClient(meeting));

  return {
    meetingId: meeting.id,
    meeting: {
      client: meeting.account.name,
      title: meeting.title,
      date: meeting.startedAt ?? meeting.createdAt,
      duration: meeting.endedAt && meeting.startedAt
        ? `${Math.round((Date.parse(meeting.endedAt) - Date.parse(meeting.startedAt)) / 60_000)} minutes`
        : "—",
      participants: meeting.participants.map((p) => `${p.name} (${p.role})`),
    },
    internal,
    client,
    references: defaultReferences(),
    generatedAt: new Date().toISOString(),
    generationLatencyMs: Date.now() - startedAt,
  };
}

function defaultInternal(): InternalSummary {
  return {
    confidence: 0.6,
    health: "warm",
    score: 75,
    wentWell: ["Stub: real summary generated server-side when GCP_PROJECT_ID is set."],
    couldImprove: [],
    upsell: [],
    risks: [],
    needs: { stated: [], actual: [] },
    actionItems: [],
    topMoments: [],
  };
}

function defaultClient(meeting: Meeting): ClientEmail {
  return {
    subject: `Recap — ${meeting.title}`,
    greeting: `Hi ${meeting.account.contact ?? "team"},`,
    body: [
      "Thank you for the conversation today. Quick recap and next steps follow.",
      "(Full client email is generated server-side when GCP_PROJECT_ID is set.)",
    ],
    signoff: "Best,",
    tone: "warm",
  };
}

function defaultReferences() {
  return [
    { title: "Vertex AI Model Garden — overview", href: "https://cloud.google.com/model-garden", source: "cloud.google.com" },
    { title: "Anthropic Claude on Vertex AI", href: "https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude", source: "cloud.google.com" },
    { title: "Regional endpoints for Vertex AI", href: "https://cloud.google.com/vertex-ai/docs/general/locations", source: "cloud.google.com" },
    { title: "Vertex AI pricing & CUDs", href: "https://cloud.google.com/vertex-ai/pricing", source: "cloud.google.com" },
  ];
}
