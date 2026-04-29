/**
 * Quiet Ask — browser-direct call to Gemini with the user's personal API key.
 *
 * This is the ONLY browser-direct LLM path in the app per ADR 0004.
 * Live hints, sentiment, and summary all go through Cloud Run + Vertex AI.
 *
 * The key lives in localStorage (apps/web/src/features/auth/store.ts).
 * Network requests go directly to generativelanguage.googleapis.com.
 */

import { useAuthStore } from "../../../auth/store.ts";

export interface QuietAskAnswer {
  q: string;
  a: string;
  chips: string[];
}

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM = `You are a private, on-call assistant for a Google Cloud sales rep mid-customer-call.
Answer the rep's question concisely (≤120 words). Surface 2-4 short, relevant tags as JSON.
Reply STRICTLY as JSON:
{ "answer": "<plain text>", "chips": ["<tag>", "<tag>"] }`;

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
    generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
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
    parsed = { answer: raw, chips: [] };
  }
  return {
    q: question,
    a: parsed.answer ?? raw ?? "",
    chips: Array.isArray(parsed.chips) ? parsed.chips.slice(0, 4) : [],
  };
}
