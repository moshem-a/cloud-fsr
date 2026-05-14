import { VertexAI } from "@google-cloud/vertexai";
import type {
  ClientEmail,
  InternalSummary,
  Meeting,
  MeetingSummary,
  Participant,
  TranscriptLine,
} from "@scoach/types";
import { randomUUID } from "node:crypto";

import type { MeetingType } from "@scoach/types";
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
}

CRITICAL RULES:
1. Use ONLY information that was ACTUALLY said in the transcript. Do NOT invent, guess, or fabricate details.
2. If information for a field was not discussed, use an empty array [] or write "לא נדון" — do NOT fill with plausible guesses.
3. Do NOT make up company names, product names, numbers, dates, or quotes not present in the transcript.
4. The transcript may be in Hebrew. Some words may be unclear due to speech recognition — note uncertainty rather than guessing.
5. For "topMoments", only include quotes that appear verbatim or near-verbatim in the transcript.
6. An honest incomplete summary is far better than a fabricated complete one.`;

const EMAIL_SYSTEM = `You are a Google Cloud sales rep writing a professional follow-up email after a customer meeting.

ALWAYS WRITE THE EMAIL IN ENGLISH, regardless of the language of the meeting transcript. Use idiomatic professional English suitable for a customer-facing recap.

The email must be something the rep can immediately send to the client. Include:
1. A warm opening thanking them for their time.
2. A concise summary of the key topics discussed (2-4 paragraphs).
3. A clear "Action Items / Next Steps" section — bulleted list with owner + deadline where possible.
4. A "Relevant Resources" section — include 3-6 relevant Google Cloud documentation links based on the GCP products/services actually discussed in the meeting. Use real cloud.google.com URLs. Format each as: "- **Title**: URL".
5. A professional sign-off.

Tone is one of: formal | warm | brief.
- formal: professional language, full sentences, structured headers.
- warm: friendly but professional, conversational, still structured.
- brief: short paragraphs, bullets over prose, minimal filler.

Strict JSON output:
{
  "subject": "<email subject line>",
  "greeting": "<opening line>",
  "body": ["<paragraph or section — use **bold** for headers>", "..."],
  "signoff": "<closing line + name placeholder>",
  "references": [{"title":"...","href":"https://cloud.google.com/...","source":"cloud.google.com"}, ...]
}

IMPORTANT:
- The email MUST contain NO internal scoring, competitive analysis, or proprietary numbers.
- Action items must come from the actual conversation, not invented.
- Reference links must be real cloud.google.com URLs relevant to the discussion topics.
- Never include placeholder text like "[insert here]" — write complete content.`;

function transcriptToText(transcript: TranscriptLine[]): string {
  return transcript
    .map((l) => `[${l.t}] ${l.name} (${l.lang}): ${l.text}`)
    .join("\n");
}

async function callPro<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  const model = vertex().getGenerativeModel({
    model: MODEL,
    generationConfig: { temperature: 0.2, maxOutputTokens: 65536, responseMimeType: "application/json" },
    systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
  });
  const resp = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
  });
  const candidate = resp.response.candidates?.[0];
  const raw = candidate?.content?.parts?.[0]?.text ?? "{}";
  if (!raw || raw.trim().length === 0) {
    console.warn(`[summary] Gemini returned empty response (finishReason: ${candidate?.finishReason})`);
    throw new Error("Gemini returned empty response");
  }
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
  if (!isGeminiEnabled() || transcript.length === 0) {
    return { ...defaultClient(meeting), tone };
  }
  try {
    const participants = formatParticipants(meeting.participants).join(", ");
    const prompt = `Meeting: ${meeting.title} with ${meeting.account.name} (${meeting.stage}).
Goal: ${meeting.goal ?? "(none stated)"}
Participants: ${participants}
Tone: ${tone}.
Transcript:
${transcriptToText(transcript)}`;
    const raw = await callPro<Partial<ClientEmail> & { references?: Array<{ title?: string; href?: string; source?: string }> }>(EMAIL_SYSTEM, prompt);
    const refs = Array.isArray(raw.references)
      ? raw.references
          .filter((r) => r.title && r.href)
          .map((r) => ({ title: r.title!, href: r.href!, source: r.source ?? "cloud.google.com" }))
      : [];
    return {
      subject: raw.subject ?? `Recap — ${meeting.title}`,
      greeting: raw.greeting ?? `Hi ${meeting.account.contact ?? "team"},`,
      body: raw.body ?? [],
      signoff: raw.signoff ?? "Best,",
      tone,
      references: refs.length > 0 ? refs : undefined,
    };
  } catch (err) {
    console.warn(`[summary] generateClientEmail failed: ${(err as Error).message}`);
    return { ...defaultClient(meeting), tone };
  }
}

const GENERIC_SPEAKERS = new Set(["client", "you", "speaker 1", "speaker 2", "unknown"]);

function formatParticipants(participants: Participant[]): string[] {
  const named = participants.filter((p) => !GENERIC_SPEAKERS.has(p.name.toLowerCase()));
  const list = named.length > 0 ? named : participants;
  return list.map((p) => p.role ? `${p.name} (${p.role})` : p.name);
}

export interface SummaryExtras {
  hintStats?: { total: number; acted: number };
  sentimentData?: { values: number[]; lastKind: string };
}

export async function generateMeetingSummary(
  meeting: Meeting,
  transcript: TranscriptLine[],
  extras?: SummaryExtras,
): Promise<MeetingSummary> {
  const startedAt = Date.now();
  const fallback = !isGeminiEnabled() || transcript.length === 0;

  const [internal, client] = fallback
    ? [defaultInternal(), defaultClient(meeting)]
    : await Promise.all([
        generateInternalSummary(meeting, transcript).catch(() => defaultInternal()),
        generateClientEmail(meeting, transcript, "warm").catch(() => defaultClient(meeting)),
      ]);

  if (extras?.hintStats) {
    internal.hintsSurfaced = extras.hintStats.total;
    internal.hintsActed = extras.hintStats.acted;
  }
  if (extras?.sentimentData && extras.sentimentData.values.length > 0) {
    const vals = extras.sentimentData.values;
    const first = vals[0] ?? 50;
    const last = vals[vals.length - 1] ?? 50;
    internal.sentimentDelta = last - first;
    internal.sentimentAvg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  return {
    meetingId: meeting.id,
    meeting: {
      client: meeting.account.name,
      title: meeting.title,
      date: meeting.startedAt ?? meeting.createdAt,
      duration: meeting.endedAt && meeting.startedAt
        ? `${Math.round((Date.parse(meeting.endedAt) - Date.parse(meeting.startedAt)) / 60_000)} minutes`
        : "—",
      participants: formatParticipants(meeting.participants),
    },
    internal,
    client,
    references: client.references && client.references.length > 0 ? client.references : defaultReferences(),
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

export function defaultClient(meeting: Meeting): ClientEmail {
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

export function classifyMeetingType(internal: InternalSummary, meeting: Meeting): MeetingType {
  const text = [
    ...internal.wentWell,
    ...internal.couldImprove,
    ...internal.topMoments.map((m) => m.quote),
    meeting.title,
    meeting.goal ?? "",
  ].join(" ").toLowerCase();

  if (internal.upsell.length > 0 || /upsell|expand|additional|upgrade/i.test(text)) return "upsell";
  if (/onboard|kickoff|kick-off|implementation|getting started/i.test(text)) return "onboarding";
  if (/review|qbr|quarterly|check.?in|status update/i.test(text)) return "review";
  if (/architect|technical|deep.?dive|migration|integration|poc|proof of concept|benchmark/i.test(text)) return "technical";
  if (/discovery|qualification|pricing|proposal|negotiat|deal|pipeline|sales|opportunity/i.test(text)) return "sales";
  return "other";
}

function defaultReferences(): import("@scoach/types").ReferenceLink[] {
  return [];
}
