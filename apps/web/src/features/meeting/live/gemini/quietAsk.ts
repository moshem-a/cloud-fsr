/**
 * Quiet Ask — browser-direct call to Gemini with the user's personal API key.
 *
 * This is the ONLY browser-direct LLM path in the app per ADR 0004.
 * Live hints, sentiment, and summary all go through Cloud Run + Vertex AI.
 *
 * The key lives in localStorage (apps/web/src/features/auth/store.ts).
 * Network requests go directly to generativelanguage.googleapis.com.
 */

import type { Infographic, InfographicKind, TranscriptLine } from "@scoach/types";

import { useAuthStore } from "../../../auth/store.ts";

export interface QuietAskAnswer {
  q: string;
  a: string;
  chips: string[];
}

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM = `You are Sally, a private, on-call assistant for a Google Cloud sales rep mid-customer-call.
The question may be in Hebrew or English — answer in the SAME language as the question.
Answer the rep's question concisely (≤180 words). Surface 2-4 short, relevant tags.
Reply STRICTLY as JSON, no markdown fences, no prose:
{ "answer": "<plain text answer>", "chips": ["<tag>", "<tag>"] }`;

const URGENT_SYSTEM = `You are Sally, a real-time Google Cloud sales coach. The rep is mid-call and just hit "Urgent help" — they need an answer to the customer's last question NOW.

The transcript lines may be in Hebrew or English. Detect the dominant language of the recent conversation and answer in THE SAME LANGUAGE so the rep can read it mid-call (Hebrew transcript → Hebrew answer; English transcript → English answer).

Find the most recent question (or implied question) the CLIENT asked. Use the surrounding 5–10 lines of conversation as context. Produce a SHORT, sharp answer the rep can deliver in 10–15 seconds. Prefer concrete GCP facts (product names, region availability, pricing model) over generic statements. If the client mentioned a competitor, weave the GCP equivalent into the answer.

Reply STRICTLY as JSON (no markdown fences, no prose):
{ "answer": "<2-4 sentence answer in transcript language>", "chips": ["<2-4 short tags in English>"] }`;

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
}

export async function quietAsk(question: string): Promise<QuietAskAnswer> {
  const key = useAuthStore.getState().geminiKey;
  if (!key) {
    throw new Error("No Gemini API key set. Add one in Settings.");
  }

  const body = {
    systemInstruction: { role: "system", parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: question }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Gemini ${res.status}`);
  }
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  let parsed: { answer?: string; chips?: string[] };
  try {
    parsed = JSON.parse(cleaned || "{}");
  } catch {
    // Salvage: pull "answer":"..." out of broken/truncated JSON before falling
    // through to the raw string. Handles the case where Gemini truncates the
    // chips array but the answer is intact.
    const m = cleaned.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    parsed = m ? { answer: JSON.parse(`"${m[1]}"`), chips: [] } : { answer: raw, chips: [] };
  }
  return {
    q: question,
    a: parsed.answer ?? raw ?? "",
    chips: Array.isArray(parsed.chips) ? parsed.chips.slice(0, 4) : [],
  };
}

/**
 * Urgent help — uses the rolling transcript context (especially the client's
 * most recent question) to generate a fast answer the rep can use mid-call.
 * No typing required — one click pulls everything from what's already on the
 * transcript.
 */
export async function urgentHelp(transcript: TranscriptLine[]): Promise<QuietAskAnswer> {
  const key = useAuthStore.getState().geminiKey;
  if (!key) {
    throw new Error("No Gemini API key set. Add one in Settings.");
  }
  if (transcript.length === 0) {
    throw new Error("No conversation yet — start the meeting first.");
  }

  // Take the last 12 lines as context. The model finds the most recent
  // question on its own; we don't try to regex it client-side because Hebrew
  // questions don't always end with "?".
  const recent = transcript.slice(-12);
  const context = recent
    .map((l) => `[${l.t}] ${l.name} (${l.lang}): ${l.text}`)
    .join("\n");

  // Find the last client line for the displayed "q" — fallback to the
  // overall last line if the client hasn't spoken in this window.
  const lastClient = [...recent].reverse().find((l) => l.speaker === "client");
  const displayedQ = (lastClient ?? recent[recent.length - 1])?.text ?? "";

  const body = {
    systemInstruction: { role: "system", parts: [{ text: URGENT_SYSTEM }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Recent transcript:\n${context}\n\nProduce the answer to the client's most recent question (or the most pressing topic they raised) right now.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Gemini ${res.status}`);
  }
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  let parsed: { answer?: string; chips?: string[] };
  try {
    parsed = JSON.parse(cleaned || "{}");
  } catch {
    const m = cleaned.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    parsed = m ? { answer: JSON.parse(`"${m[1]}"`), chips: [] } : { answer: raw, chips: [] };
  }
  return {
    q: displayedQ,
    a: parsed.answer ?? raw ?? "",
    chips: Array.isArray(parsed.chips) ? parsed.chips.slice(0, 4) : [],
  };
}

const INFOGRAPHIC_SYSTEM = `You are a real-time Mermaid chart generator for a live sales call. ALWAYS produce a chart — never skip.

Pick the best Mermaid diagram type:
- flowchart TD: architecture, processes, decision trees (use most often)
- graph LR: horizontal flows, pipelines, migration paths
- pie: cost breakdowns, usage distribution
- sequenceDiagram: interactions between systems

Return STRICT JSON:
{ "kind": "flow", "title": "<short title>", "mermaid": "<valid mermaid syntax>" }

Keep charts simple: 4-8 nodes, short labels (max 20 chars). Match conversation language.`;

export async function generateClientInfographic(transcript: TranscriptLine[]): Promise<Infographic | null> {
  const key = useAuthStore.getState().geminiKey;
  if (!key || transcript.length < 3) return null;

  const recent = transcript.slice(-15);
  const context = recent.map((l) => `[${l.t}] ${l.name}: ${l.text}`).join("\n");

  const body = {
    systemInstruction: { role: "system", parts: [{ text: INFOGRAPHIC_SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: `Recent transcript:\n${context}\n\nGenerate a Mermaid chart for this conversation.` }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024, responseMimeType: "application/json" },
  };

  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as GeminiResponse;
    if (!res.ok) return null;
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned || "{}") as { kind?: string; title?: string; mermaid?: string };
    if (!parsed.title || !parsed.mermaid) return null;
    return {
      id: crypto.randomUUID(),
      kind: (parsed.kind as InfographicKind) || "flow",
      title: parsed.title,
      data: { nodes: [], edges: [] },
      mermaid: parsed.mermaid,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
