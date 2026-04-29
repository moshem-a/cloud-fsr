import { VertexAI } from "@google-cloud/vertexai";
import type { Hint, HintCategory, HintColor, Sentiment, TranscriptLine } from "@scoach/types";
import { randomUUID } from "node:crypto";

/**
 * Vertex AI Gemini wrapper.
 *
 * Locked decisions (ADR 0004 — hybrid Gemini routing):
 *   - Live hints: Gemini 2.5 Pro, server-side, streaming.
 *   - Sentiment + entity extraction: Gemini 2.5 Flash, server-side.
 *   - Quiet Ask: browser-direct (NOT here — see apps/web/.../gemini/quietAsk.ts).
 *
 * Region: us-central1 (matches Cloud Run home).
 *
 * Gracefully no-ops when GCP_PROJECT_ID is unset; the canned-replay path
 * stays in charge for the dev experience.
 */

const PROJECT = process.env.GCP_PROJECT_ID;
const REGION = process.env.VERTEX_REGION || "us-central1";
const MODEL_PRO = "gemini-2.5-pro";
const MODEL_FLASH = "gemini-2.5-flash";

let _vertex: VertexAI | null = null;
function vertex(): VertexAI {
  if (_vertex) return _vertex;
  _vertex = new VertexAI({ project: PROJECT!, location: REGION });
  return _vertex;
}

export function isGeminiEnabled(): boolean {
  return Boolean(PROJECT);
}

// ---------- Entity extraction (Flash) ----------
const ENTITY_REGEX = /(\$[\d,]+(?:K|M|\s*(?:per\s*month|\/mo|\/month))?|p\d{1,2}\s+latency|AWS\s+\w+|Bedrock|GKE|BigQuery|Vertex\s+AI|Claude\s+\w+|Gemini\s+\w+|Llama\s+\w*|Mistral|Anthropic|us-east-?\d?|europe-west\d|me-west\d)/gi;

export function regexEntities(text: string): string[] {
  const matches = text.match(ENTITY_REGEX) ?? [];
  return Array.from(new Set(matches.map((m) => m.trim())));
}

export async function extractEntities(text: string): Promise<string[]> {
  const fast = regexEntities(text);
  if (!isGeminiEnabled()) return fast;
  // Sprint 4: Flash extraction is opportunistic. Regex catches the high-confidence cases;
  // Flash adds entities that don't pattern-match (e.g. internal acronyms).
  try {
    const model = vertex().getGenerativeModel({
      model: MODEL_FLASH,
      generationConfig: { temperature: 0, maxOutputTokens: 128 },
    });
    const resp = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Extract product names, money amounts, and metrics from this sales-call line. Return JSON array of strings, no prose.\n---\n${text}`,
            },
          ],
        },
      ],
    });
    const raw = resp.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const parsed: unknown = JSON.parse(raw.replace(/^```json|```$/g, "").trim() || "[]");
    const arr = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    return Array.from(new Set([...fast, ...arr]));
  } catch {
    return fast;
  }
}

// ---------- Sentiment (Flash, every 10s) ----------
export interface SentimentClassification {
  value: number; // 0..100
  kind: Sentiment;
  label?: string;
}

export async function classifySentiment(transcriptWindow: string): Promise<SentimentClassification> {
  if (!isGeminiEnabled() || !transcriptWindow.trim()) {
    return { value: 65, kind: "neutral" };
  }
  try {
    const model = vertex().getGenerativeModel({
      model: MODEL_FLASH,
      generationConfig: { temperature: 0.1, maxOutputTokens: 64 },
    });
    const prompt = `Classify the client engagement and sentiment in this 10s sales-call window.
Return JSON: { "value": <int 0-100>, "kind": "buying"|"concern"|"positive"|"neutral", "label": "<short>" }
---
${transcriptWindow}`;
    const resp = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const raw = resp.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const cleaned = raw.replace(/^```json|```$/g, "").trim();
    const parsed = JSON.parse(cleaned || "{}") as Partial<SentimentClassification>;
    return {
      value: Math.max(0, Math.min(100, Number(parsed.value ?? 65))),
      kind: (parsed.kind as Sentiment) ?? "neutral",
      label: parsed.label,
    };
  } catch {
    return { value: 65, kind: "neutral" };
  }
}

// ---------- Hint generation (Pro, streaming, on entity batch) ----------
export interface HintRequest {
  meetingGoal: string;
  contextSummary: string;
  rollingTranscript: TranscriptLine[];
  newEntities: string[];
}

const HINT_SYSTEM = `You are a real-time sales coach for Google Cloud sales reps in customer calls.
When new entities are detected mid-call, you may surface ONE hint to help the rep.
Categories:
- "Competitive" (color blue): client mentions an AWS/Azure/etc product → reframe with GCP equivalent
- "Problem→Solution" (red): client describes a technical pain → suggest a GCP solution
- "Commercial" (yellow): client mentions cost/budget → suggest CUDs or hybrid routing
- "Positive" (green): client shows buying signal → reinforce momentum

Return STRICT JSON:
{
  "title": "<short headline, max 60 chars>",
  "category": "Competitive|Problem→Solution|Commercial|Positive",
  "summary": "<1-2 sentence reframe>",
  "proofPoints": ["<bullet>", "<bullet>", "<bullet>"],
  "sources": ["<source label>", "<source label>"],
  "confidence": 0.85
}
If no hint is warranted, return: { "skip": true }`;

export async function generateHint(req: HintRequest): Promise<Hint | null> {
  if (!isGeminiEnabled()) return null;
  try {
    const model = vertex().getGenerativeModel({
      model: MODEL_PRO,
      generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
      systemInstruction: { role: "system", parts: [{ text: HINT_SYSTEM }] },
    });
    const transcript = req.rollingTranscript
      .slice(-12)
      .map((l) => `[${l.t}] ${l.name} (${l.lang}): ${l.text}`)
      .join("\n");
    const prompt = `Meeting goal: ${req.meetingGoal}
Pre-call context: ${req.contextSummary}
New entities just mentioned: ${req.newEntities.join(", ")}

Recent transcript:
${transcript}

Surface the ONE most useful hint right now, or skip.`;
    const resp = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const raw = resp.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const cleaned = raw.replace(/^```json|```$/g, "").trim();
    const parsed = JSON.parse(cleaned || "{}") as Partial<Hint> & { skip?: boolean };
    if (parsed.skip || !parsed.title) return null;

    const color: HintColor =
      parsed.category === "Competitive"
        ? "blue"
        : parsed.category === "Problem→Solution"
          ? "red"
          : parsed.category === "Commercial"
            ? "yellow"
            : "green";

    const lastTime = req.rollingTranscript[req.rollingTranscript.length - 1]?.t ?? "00:00";

    return {
      id: randomUUID(),
      title: parsed.title,
      category: (parsed.category as HintCategory) ?? "Problem→Solution",
      color,
      summary: parsed.summary ?? "",
      proofPoints: Array.isArray(parsed.proofPoints) ? parsed.proofPoints : [],
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.75,
      timestamp: lastTime,
    };
  } catch (err) {
    void err;
    return null;
  }
}
