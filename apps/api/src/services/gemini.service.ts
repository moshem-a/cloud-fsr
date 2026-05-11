import { type Content, type GenerativeModel, VertexAI } from "@google-cloud/vertexai";
import type { ComparisonTable, Hint, HintCategory, HintColor, Infographic, InfographicKind, Sentiment, TranscriptLine } from "@scoach/types";
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
const MODEL_PRO = "gemini-2.5-flash";
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

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const braceStart = raw.indexOf("{");
  const bracketStart = raw.indexOf("[");
  if (braceStart === -1 && bracketStart === -1) return raw.trim();
  const start = braceStart === -1 ? bracketStart : bracketStart === -1 ? braceStart : Math.min(braceStart, bracketStart);
  const opener = raw[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === opener) depth++;
    else if (raw[i] === closer) depth--;
    if (depth === 0) return raw.slice(start, i + 1);
  }
  return raw.slice(start);
}

async function streamToText(model: GenerativeModel, contents: Content[]): Promise<string> {
  const result = await model.generateContentStream({ contents });
  let text = "";
  for await (const chunk of result.stream) {
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (parts) for (const p of parts) text += p.text ?? "";
  }
  return text || "{}";
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
  try {
    const model = vertex().getGenerativeModel({
      model: MODEL_FLASH,
      generationConfig: { temperature: 0, maxOutputTokens: 2048 },
    });
    const raw = await streamToText(model, [
      { role: "user", parts: [{ text: `Transcripts may be in Hebrew or English (Hebrew is common in this product).
Extract product names, technologies, money amounts, and metrics from this sales-call line.
Return entity names in their ORIGINAL language (don't translate).
Return ONLY a JSON array of strings, no prose, no markdown.

Line:
${text}` }] },
    ]);
    const cleaned = extractJson(raw);
    const parsed: unknown = JSON.parse(cleaned || "[]");
    const arr = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    return Array.from(new Set([...fast, ...arr]));
  } catch (err) {
    console.warn(`[gemini] extractEntities failed: ${(err as Error).message}`);
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
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    });
    const prompt = `Classify client engagement and sentiment in this sales-call window.
Transcripts may be in Hebrew or English.
Return STRICT JSON only (no prose, no markdown):
{ "value": <int 0-100>, "kind": "buying"|"concern"|"positive"|"neutral", "label": "<short label in English>" }

Window:
${transcriptWindow}`;
    const raw = await streamToText(model, [{ role: "user", parts: [{ text: prompt }] }]);
    const cleaned = extractJson(raw);
    const parsed = JSON.parse(cleaned || "{}") as Partial<SentimentClassification>;
    return {
      value: Math.max(0, Math.min(100, Number(parsed.value ?? 65))),
      kind: (parsed.kind as Sentiment) ?? "neutral",
      label: parsed.label,
    };
  } catch (err) {
    console.warn(`[gemini] classifySentiment failed: ${(err as Error).message}`);
    return { value: 65, kind: "neutral" };
  }
}

// ---------- Hint generation (Pro, streaming, on entity batch) ----------
export interface HintRequest {
  meetingGoal: string;
  contextSummary: string;
  rollingTranscript: TranscriptLine[];
  /** Optional — entities just mentioned. Empty/missing is fine; the model decides on its own. */
  newEntities?: string[];
  /** Dominant language of the meeting — hints will be in this language. */
  lang?: "he" | "en";
  /** When set, the resulting Hint is tagged with this priority for UI styling. */
  priority?: "normal" | "high";
  /** Recent hint titles — the model must NOT generate a hint with the same or very similar title. */
  recentHintTitles?: string[];
}

export function detectLang(transcript: TranscriptLine[]): "he" | "en" {
  let he = 0;
  let en = 0;
  for (const l of transcript.slice(-20)) {
    if (l.lang === "he") he++;
    else en++;
  }
  return he >= en ? "he" : "en";
}

const HINT_SYSTEM_HE = `You are a real-time sales coach for Google Cloud sales reps during customer calls.

IMPORTANT: Write ALL hint text (title, summary, proofPoints) in HEBREW (עברית). Technical product names (GKE, BigQuery, Vertex AI, etc.) stay in English but all surrounding text must be in Hebrew.

You see a rolling transcript window. Decide whether ONE hint would meaningfully help the rep right now. Be generous — surface a hint whenever the recent talk involves a GCP product, a technical topic, a competitor mention, a budget concern, or a buying signal. Only skip if the transcript is trivial small talk with no substance.`;

const HINT_SYSTEM_EN = `You are a real-time sales coach for Google Cloud sales reps during customer calls.

Write ALL hint text (title, summary, proofPoints) in ENGLISH.

You see a rolling transcript window. Decide whether ONE hint would meaningfully help the rep right now. Be generous — surface a hint whenever the recent talk involves a GCP product, a technical topic, a competitor mention, a budget concern, or a buying signal. Only skip if the transcript is trivial small talk with no substance.`;

const HINT_CATEGORIES = `

Categories:
- "Competitive" (color blue): client mentions an AWS/Azure/Snowflake/etc product → reframe with GCP equivalent
- "Problem→Solution" (red): client describes a technical pain → suggest a GCP solution
- "Commercial" (yellow): client mentions cost/budget/pricing → suggest CUDs, hybrid routing, etc.
- "Positive" (green): client shows buying signal / momentum → reinforce
- "Objection" (red): client raises a concern, complaint, or pushback → suggest a specific handling technique. In proofPoints provide: (1) a direct reframe ("Instead of X, position it as Y"), (2) a bridge phrase the rep can say VERBATIM ("I understand that concern. What we've seen with similar customers is..."), (3) a deflection or topic-change technique if appropriate
- "Redirect" (yellow): conversation is stalling, going off-topic, or the client is losing interest → suggest a topic change, a bridge phrase, or a provocative question to re-engage

When the client mentions a competitor (Bedrock, SageMaker, Snowflake, Databricks, OpenAI direct, Azure OpenAI, AWS, AKS, EKS, RDS, DynamoDB, Athena, Redshift) OR asks a comparison question ("how does X compare", "what's the difference between", "vs", "versus", "compared to"), ALWAYS include a comparisonTable comparing the competitor (or the technology in question) to the closest GCP equivalent. Highlight what GCP/Vertex AI Model Garden has that the competitor doesn't (more model options, broader region coverage, BYO data integration, integrated grounding, unified billing, etc.).

When the client expresses frustration, concern, or an objection, ALWAYS generate an "Objection" hint with actionable handling techniques in proofPoints. The rep needs ready-to-use phrases they can say immediately.

Return STRICT JSON only (no prose, no markdown fences):
{
  "title": "<short headline, max 60 chars>",
  "category": "Competitive|Problem→Solution|Commercial|Positive|Objection|Redirect",
  "summary": "<1-2 sentence reframe>",
  "proofPoints": ["<bullet>", "<bullet>", "<bullet>"],
  "sources": ["<source label>"],
  "confidence": 0.85,
  "comparisonTable": {
    "topic": "<X vs GCP equivalent — short headline>",
    "left":  { "name": "<competitor product>", "points": ["<3-5 short bullets>"], "verdict": "weak"|"neutral" },
    "right": { "name": "<GCP product>",        "points": ["<3-5 short bullets>"], "verdict": "strong"|"neutral" },
    "recommendation": "<one-liner takeaway the rep can say>"
  }
}
The comparisonTable field is OPTIONAL — include it ONLY when category is "Competitive" or the conversation is clearly comparing products. Otherwise omit the field entirely.
If no hint is warranted right now, return: { "skip": true }`;

const HINT_CATEGORIES_SHORT = `

Categories:
- "Competitive" (blue): client mentions AWS/Azure/Snowflake/etc → reframe with GCP equivalent
- "Problem→Solution" (red): client describes a pain → suggest GCP solution
- "Commercial" (yellow): cost/budget/pricing → suggest CUDs, hybrid routing
- "Positive" (green): buying signal → reinforce
- "Objection" (red): concern/pushback → reframe + bridge phrase the rep can say verbatim
- "Redirect" (yellow): stalling/off-topic → suggest topic change or provocative question

Return STRICT JSON only:
{ "title": "<max 60 chars>", "category": "Competitive|Problem→Solution|Commercial|Positive|Objection|Redirect", "summary": "<1-2 sentences>", "proofPoints": ["<bullet>","<bullet>","<bullet>"], "sources": ["<label>"], "confidence": 0.85 }
If no hint warranted: { "skip": true }`;

export async function generateHint(req: HintRequest): Promise<Hint | null> {
  if (!isGeminiEnabled()) return null;
  try {
    const lang = req.lang ?? detectLang(req.rollingTranscript);
    const isHighPriority = req.priority === "high";
    const categories = isHighPriority ? HINT_CATEGORIES : HINT_CATEGORIES_SHORT;
    const systemPrompt = (lang === "he" ? HINT_SYSTEM_HE : HINT_SYSTEM_EN) + categories;
    const windowSize = isHighPriority ? 12 : 8;
    const model = vertex().getGenerativeModel({
      model: MODEL_PRO,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
    });
    const transcript = req.rollingTranscript
      .slice(-windowSize)
      .map((l) => `[${l.t}] ${l.name} (${l.lang}): ${l.text}`)
      .join("\n");
    const entitiesLine = req.newEntities && req.newEntities.length > 0
      ? `\nEntities just mentioned: ${req.newEntities.join(", ")}\n`
      : "";
    const alreadyGiven = req.recentHintTitles && req.recentHintTitles.length > 0
      ? `\nHints already given (DO NOT repeat or rephrase these): ${req.recentHintTitles.join(" | ")}\n`
      : "";
    const prompt = `Meeting goal: ${req.meetingGoal || "(not specified)"}
Pre-call context: ${req.contextSummary || "(none)"}${entitiesLine}${alreadyGiven}
Recent transcript:
${transcript}

Surface the ONE most useful NEW hint right now. It must be DIFFERENT from any hint already given. If nothing new to say, return { "skip": true }.`;
    const raw = await streamToText(model, [{ role: "user", parts: [{ text: prompt }] }]);
    const cleaned = extractJson(raw);
    const parsed = JSON.parse(cleaned || "{}") as Partial<Hint> & { skip?: boolean };
    if (parsed.skip || !parsed.title) return null;

    const color: HintColor =
      parsed.category === "Competitive"
        ? "blue"
        : parsed.category === "Problem→Solution" || parsed.category === "Objection"
          ? "red"
          : parsed.category === "Commercial" || parsed.category === "Redirect"
            ? "yellow"
            : "green";

    const lastTime = req.rollingTranscript[req.rollingTranscript.length - 1]?.t ?? "00:00";
    const comparisonTable = isValidComparison(parsed.comparisonTable);

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
      ...(comparisonTable ? { comparisonTable } : {}),
      ...(req.priority ? { priority: req.priority } : {}),
    };
  } catch (err) {
    console.warn(`[gemini] generateHint failed: ${(err as Error).message} | raw=${(err as { _raw?: string })._raw ?? "n/a"}`);
    return null;
  }
}

function isValidComparison(c: unknown): ComparisonTable | undefined {
  if (!c || typeof c !== "object") return undefined;
  const o = c as Partial<ComparisonTable>;
  if (typeof o.topic !== "string") return undefined;
  if (!o.left || !o.right) return undefined;
  if (typeof o.left.name !== "string" || typeof o.right.name !== "string") return undefined;
  const leftPoints = Array.isArray(o.left.points) ? o.left.points.filter((p): p is string => typeof p === "string") : [];
  const rightPoints = Array.isArray(o.right.points) ? o.right.points.filter((p): p is string => typeof p === "string") : [];
  if (leftPoints.length === 0 || rightPoints.length === 0) return undefined;
  return {
    topic: o.topic,
    left: { name: o.left.name, points: leftPoints, ...(o.left.verdict ? { verdict: o.left.verdict } : {}) },
    right: { name: o.right.name, points: rightPoints, ...(o.right.verdict ? { verdict: o.right.verdict } : {}) },
    ...(typeof o.recommendation === "string" ? { recommendation: o.recommendation } : {}),
  };
}

// ---------- Infographic generation ----------
const INFOGRAPHIC_SYSTEM = `You are a real-time Mermaid chart generator for a live sales/technical call. Generate a Mermaid diagram that visualizes what's being discussed RIGHT NOW.

ALWAYS produce a chart. Never skip. Pick the best Mermaid diagram type:
- flowchart TD: for architecture, processes, data flows, decision trees (use most often)
- graph LR: for horizontal flows, pipelines, migration paths
- sequenceDiagram: for interactions between systems or people
- pie: for market share, cost breakdowns, usage distribution
- gantt: for project timelines with dates

Return STRICT JSON:
{ "kind": "flow", "title": "<short title max 40 chars>", "mermaid": "<valid mermaid syntax>" }

Use "flow" for kind for all Mermaid types (flowchart, graph, sequence, pie, gantt).

Example mermaid values:
- "flowchart TD\\n  A[Client App] --> B[Cloud Run]\\n  B --> C[Firestore]\\n  B --> D[Vertex AI]"
- "graph LR\\n  A[Current: AWS] --> B[Migration] --> C[GCP]\\n  B --> D[Data Transfer]"
- "pie title Cost Breakdown\\n  \\"Compute\\" : 40\\n  \\"Storage\\" : 25\\n  \\"Network\\" : 20\\n  \\"Other\\" : 15"

Rules:
- Keep charts simple: 4-8 nodes max. Rep glances at it in 3 seconds.
- Use short labels (max 20 chars per node)
- Match the language of the conversation (Hebrew transcript → Hebrew labels)
- Focus on what helps the rep RIGHT NOW: architecture being discussed, comparison with competitor, next steps, pricing breakdown
- Use proper Mermaid syntax — no markdown fences, just the raw diagram code
- Escape special characters in labels using quotes when needed`;

export interface InfographicRequest {
  rollingTranscript: TranscriptLine[];
  meetingGoal: string;
  meetingTitle: string;
}

export async function generateInfographic(req: InfographicRequest): Promise<Infographic | null> {
  if (!isGeminiEnabled() || req.rollingTranscript.length < 2) return null;
  try {
    const model = vertex().getGenerativeModel({
      model: MODEL_FLASH,
      generationConfig: { temperature: 0.5, maxOutputTokens: 1024, responseMimeType: "application/json" },
      systemInstruction: { role: "system", parts: [{ text: INFOGRAPHIC_SYSTEM }] },
    });
    const transcript = req.rollingTranscript
      .slice(-12)
      .map((l) => `[${l.t}] ${l.name}: ${l.text}`)
      .join("\n");
    const prompt = `Goal: ${req.meetingGoal || "(general discussion)"}

Recent transcript:
${transcript}

Generate a Mermaid chart for what's being discussed right now.`;
    const raw = await streamToText(model, [{ role: "user", parts: [{ text: prompt }] }]);
    const cleaned = extractJson(raw);
    const parsed = JSON.parse(cleaned || "{}") as { kind?: string; title?: string; mermaid?: string; data?: unknown };
    if (!parsed.title || !parsed.mermaid) return null;
    const kind = (parsed.kind as InfographicKind) || "flow";
    return {
      id: randomUUID(),
      kind,
      title: parsed.title,
      data: { nodes: [], edges: [] },
      mermaid: parsed.mermaid,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`[gemini] generateInfographic failed: ${(err as Error).message}`);
    return null;
  }
}

// ---------- Auto meeting name ----------

export async function generateMeetingName(transcript: TranscriptLine[]): Promise<string | null> {
  if (!isGeminiEnabled() || transcript.length < 3) return null;
  try {
    const model = vertex().getGenerativeModel({
      model: MODEL_FLASH,
      generationConfig: { temperature: 0.3, maxOutputTokens: 100, responseMimeType: "application/json" },
      systemInstruction: {
        role: "system",
        parts: [
          {
            text: `Generate a short meeting title (max 6 words) from the transcript. The title should capture the main topic discussed. Reply as JSON: { "title": "<meeting title>" }. Use the same language as the conversation.`,
          },
        ],
      },
    });
    const context = transcript
      .slice(0, 15)
      .map((l) => `${l.name}: ${l.text}`)
      .join("\n");
    const raw = await streamToText(model, [{ role: "user", parts: [{ text: context }] }]);
    const parsed = JSON.parse(extractJson(raw) || "{}") as { title?: string };
    return parsed.title || null;
  } catch (err) {
    console.warn(`[gemini] generateMeetingName failed: ${(err as Error).message}`);
    return null;
  }
}

// ---------- Live tips (periodic coaching advice for the rep) ----------
const LIVE_TIP_SYSTEM = `You are a senior sales manager silently observing a live customer call. Whisper ONE short, actionable tip to your sales rep right now.

Rules:
- ONE tip only, under 100 characters
- Present tense, direct, actionable ("Ask about...", "Slow down...", "Good moment to...")
- Based on what's happening in the conversation right now
- Don't repeat tips you've already given (the existing tips list is provided)
- If there's nothing useful to say, return { "skip": true }`;

export async function generateLiveTip(req: {
  rollingTranscript: TranscriptLine[];
  meetingGoal: string;
  lang: "he" | "en";
  existingTips: string[];
}): Promise<string | null> {
  if (!isGeminiEnabled() || req.rollingTranscript.length < 4) return null;
  try {
    const model = vertex().getGenerativeModel({
      model: MODEL_FLASH,
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      systemInstruction: { role: "system", parts: [{ text: LIVE_TIP_SYSTEM }] },
    });
    const transcript = req.rollingTranscript
      .slice(-12)
      .map((l) => `[${l.t}] ${l.name}: ${l.text}`)
      .join("\n");
    const langNote = req.lang === "he" ? "Write the tip in Hebrew." : "Write the tip in English.";
    const prompt = `${langNote}
Meeting goal: ${req.meetingGoal || "(not specified)"}
Already given tips: ${req.existingTips.length > 0 ? req.existingTips.join(" | ") : "(none yet)"}

Recent transcript:
${transcript}

Return STRICT JSON: { "tip": "<your tip>" } or { "skip": true }`;
    const raw = await streamToText(model, [{ role: "user", parts: [{ text: prompt }] }]);
    const cleaned = extractJson(raw);
    const parsed = JSON.parse(cleaned || "{}") as { skip?: boolean; tip?: string };
    if (parsed.skip || !parsed.tip) return null;
    return parsed.tip;
  } catch (err) {
    console.warn(`[gemini] generateLiveTip failed: ${(err as Error).message}`);
    return null;
  }
}

// ---------- Quick answer (instant response to client questions) ----------
const QUICK_ANSWER_SYSTEM = `You are Sally, a real-time sales assistant for Google Cloud. The client just asked a question during a live call. Give the rep a SHORT, concrete answer they can deliver in 10-15 seconds.

Rules:
- 2-4 sentences max, under 60 words
- Prefer concrete GCP facts: product names, region availability, pricing models
- If a competitor is mentioned, include the GCP alternative
- If you can't answer the question, say so briefly and suggest what to say
- Detect the language of the question and answer in THE SAME LANGUAGE`;

export async function generateQuickAnswer(req: {
  question: string;
  rollingTranscript: TranscriptLine[];
  meetingGoal: string;
  lang: "he" | "en";
}): Promise<Hint | null> {
  if (!isGeminiEnabled()) return null;
  try {
    const model = vertex().getGenerativeModel({
      model: MODEL_FLASH,
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      systemInstruction: { role: "system", parts: [{ text: QUICK_ANSWER_SYSTEM }] },
    });
    const context = req.rollingTranscript
      .slice(-6)
      .map((l) => `[${l.t}] ${l.name}: ${l.text}`)
      .join("\n");
    const prompt = `Meeting goal: ${req.meetingGoal || "(not specified)"}

Recent transcript:
${context}

Client's question: "${req.question}"

Return STRICT JSON: { "title": "<max 50 chars>", "summary": "<2-4 sentence answer>", "proofPoints": ["<key fact>"], "sources": [], "confidence": 0.9 }
If you cannot produce a useful answer, return: { "skip": true }`;
    const raw = await streamToText(model, [{ role: "user", parts: [{ text: prompt }] }]);
    const cleaned = extractJson(raw);
    const parsed = JSON.parse(cleaned || "{}") as Partial<Hint> & { skip?: boolean };
    if (parsed.skip || !parsed.title) return null;

    return {
      id: randomUUID(),
      title: parsed.title,
      category: "Problem→Solution",
      color: "blue",
      summary: parsed.summary ?? "",
      proofPoints: Array.isArray(parsed.proofPoints) ? parsed.proofPoints : [],
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
      timestamp: req.rollingTranscript[req.rollingTranscript.length - 1]?.t ?? "00:00",
      priority: "high",
    };
  } catch (err) {
    console.warn(`[gemini] generateQuickAnswer failed: ${(err as Error).message}`);
    return null;
  }
}

// ---------- Follow-ups (Flash, periodic) ----------
export async function generateFollowups(
  rollingTranscript: TranscriptLine[],
  meetingGoal: string,
  lang?: "he" | "en",
): Promise<string[]> {
  if (!isGeminiEnabled() || rollingTranscript.length === 0) return [];
  const effectiveLang = lang ?? detectLang(rollingTranscript);
  try {
    const model = vertex().getGenerativeModel({
      model: MODEL_FLASH,
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    });
    const transcript = rollingTranscript
      .slice(-30)
      .map((l) => `[${l.t}] ${l.name}: ${l.text}`)
      .join("\n");
    const langInstruction = effectiveLang === "he"
      ? "IMPORTANT: Write ALL follow-up items in HEBREW (עברית). Technical product names stay in English but the sentence must be in Hebrew."
      : "Write ALL follow-up items in ENGLISH.";
    const prompt = `You are a sales coach assistant.
${langInstruction}

Read this rolling sales-call transcript and produce 3-6 concrete follow-up questions
that the sales rep should ask the client right now to advance the deal, uncover needs,
or handle objections. Each question should be a direct, actionable question the rep can
ask verbatim in the meeting (under 120 chars). Start each with a question word or verb.

Return STRICT JSON only (no prose, no markdown fences):
{ "items": ["<question 1>", "<question 2>", "<question 3>"] }

Meeting goal: ${meetingGoal || "(not specified)"}

Transcript:
${transcript}`;
    const raw = await streamToText(model, [{ role: "user", parts: [{ text: prompt }] }]);
    const cleaned = extractJson(raw);
    const parsed = JSON.parse(cleaned || "{}") as { items?: unknown };
    return Array.isArray(parsed.items)
      ? parsed.items.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, 6)
      : [];
  } catch (err) {
    console.warn(`[gemini] generateFollowups failed: ${(err as Error).message}`);
    return [];
  }
}

// ---------- Screen frame analysis (Vision, on-demand) ----------
export async function analyzeScreenFrame(imageBuffer: Buffer): Promise<{
  findings: string[];
  products: string[];
  competitors: string[];
  pricing: string[];
} | null> {
  if (!isGeminiEnabled()) return null;
  try {
    const model = vertex().getGenerativeModel({
      model: MODEL_FLASH,
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    });
    const base64 = imageBuffer.toString("base64");
    const raw = await streamToText(model, [
      {
        role: "user",
        parts: [
          {
            inlineData: { mimeType: "image/jpeg", data: base64 },
          },
          {
            text: `Analyze this meeting screen share image. Extract any visible:
1. Company or organization names
2. GCP/AWS/Azure product names or logos
3. Competitor mentions
4. Pricing or budget numbers
5. Technical architecture diagrams or components
6. Pain points or requirements mentioned in slides

Return STRICT JSON only:
{
  "findings": ["<key observation>", ...],
  "products": ["<product name>", ...],
  "competitors": ["<competitor product>", ...],
  "pricing": ["<pricing detail>", ...]
}
If the image has no useful sales context (blank screen, generic UI), return { "skip": true }`,
          },
        ],
      },
    ]);
    const cleaned = extractJson(raw);
    const parsed = JSON.parse(cleaned || "{}") as {
      skip?: boolean;
      findings?: string[];
      products?: string[];
      competitors?: string[];
      pricing?: string[];
    };
    if (parsed.skip) return null;
    return {
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
      pricing: Array.isArray(parsed.pricing) ? parsed.pricing : [],
    };
  } catch (err) {
    console.warn(`[gemini] analyzeScreenFrame failed: ${(err as Error).message}`);
    return null;
  }
}

// ---------- Google Meet info extraction from screen share ----------
export async function extractMeetInfo(imageBuffer: Buffer): Promise<{
  isMeet: boolean;
  meetingTitle?: string;
  participants?: string[];
} | null> {
  if (!isGeminiEnabled()) return null;
  try {
    const model = vertex().getGenerativeModel({
      model: MODEL_FLASH,
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    });
    const base64 = imageBuffer.toString("base64");
    const raw = await streamToText(model, [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64 } },
          {
            text: `Look at this screenshot. Is this a Google Meet video call interface?

If YES, extract:
1. The meeting title visible in the Google Meet UI (usually shown at the top or in the meeting details)
2. The names of participants visible on screen (from name labels on video tiles, the participants panel, or the meeting roster)

Return STRICT JSON only:
{
  "isMeet": true,
  "meetingTitle": "<meeting title if visible, or null>",
  "participants": ["<name1>", "<name2>", ...]
}

If this is NOT a Google Meet screen, return: { "isMeet": false }`,
          },
        ],
      },
    ]);
    const cleaned = extractJson(raw);
    const parsed = JSON.parse(cleaned || "{}") as {
      isMeet?: boolean;
      meetingTitle?: string;
      participants?: string[];
    };
    return {
      isMeet: !!parsed.isMeet,
      meetingTitle: parsed.meetingTitle || undefined,
      participants: Array.isArray(parsed.participants)
        ? parsed.participants.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
        : undefined,
    };
  } catch (err) {
    console.warn(`[gemini] extractMeetInfo failed: ${(err as Error).message}`);
    return null;
  }
}

// ---------- Action-item detection (auto-notes from both speakers) ----------
const ACTION_ITEM_EN = /\b(I'll|I will|let me|I can|I'm going to|we'll|we will|follow up|send you|set up|schedule|check on|get back to you|look into|prepare|I need to|I should|can you|could you|please\s+(?:send|share|prepare|schedule|check|provide|set up)|we need|we'd like|we expect|as a next step|by next|by end of|before the|don't forget|make sure|need to|let's schedule|let's set up|we agreed)\b/i;

const ACTION_ITEM_HE = /(?:אני אבדוק|אני אשלח|אני אקבע|אני ארשום|אני אחזור|אני אעביר|אני רוצה לקבוע|אני רוצה לשלוח|אני צריך ל|נשלח לכם|נקבע לכם|צריכים לקבוע|צריך לקבוע|בוא נקבע|בוא נתאם|אתה יכול|תשלח לי|תבדוק|תקבע|נחזור אליך|אחזור אליך|ארשום לעצמי)/;

export function hasActionItemPattern(text: string): boolean {
  return (ACTION_ITEM_EN.test(text) || ACTION_ITEM_HE.test(text)) && text.trim().length > 15;
}

export async function extractActionItem(text: string, speaker: string, lang: "he" | "en"): Promise<string | null> {
  if (!isGeminiEnabled()) return null;
  try {
    const model = vertex().getGenerativeModel({
      model: MODEL_FLASH,
      generationConfig: { temperature: 0, maxOutputTokens: 1024 },
    });
    const role = speaker === "rep" ? "sales rep" : "client";
    const prompt = `Extract the action item from this ${role}'s statement in a sales meeting.
Action items include: commitments ("I'll send you..."), requests ("Can you prepare..."), decisions ("Let's schedule..."), deadlines ("by next week").
If there's no clear action item, return { "skip": true }.
Otherwise return: { "note": "<concise action item, max 80 chars, in ${lang === "he" ? "Hebrew" : "English"}>" }

Statement: "${text}"`;
    const raw = await streamToText(model, [{ role: "user", parts: [{ text: prompt }] }]);
    const cleaned = extractJson(raw);
    const parsed = JSON.parse(cleaned || "{}") as { skip?: boolean; note?: string };
    if (parsed.skip || !parsed.note) return null;
    return parsed.note;
  } catch (err) {
    console.warn(`[gemini] extractActionItem failed: ${(err as Error).message}`);
    return null;
  }
}
