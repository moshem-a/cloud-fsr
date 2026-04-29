import type { Hint, SentimentSample, ServerWsMessage, TranscriptLine } from "@scoach/types";

/**
 * Canned 5-min replay for Sprint 3.
 * Real Sprint 4 STT + Vertex pipeline replaces this.
 */

export const TRANSCRIPT_REPLAY: TranscriptLine[] = [
  {
    id: "tl-1",
    t: "00:42",
    speaker: "client",
    name: "Yael",
    lang: "he",
    text: "אז כמו שאמרתי, אנחנו כרגע מריצים את המודלים שלנו על Bedrock, וזה עובד — אבל יש לנו בעיית latency משמעותית מהלקוחות באירופה.",
    trans:
      "So as I said, we're currently running our models on Bedrock — it works, but we have significant latency issues from European customers.",
    isFinal: true,
  },
  {
    id: "tl-2",
    t: "00:58",
    speaker: "rep",
    name: "Noa",
    lang: "en",
    text: "Got it. When you say significant — what range are we looking at, p95?",
    isFinal: true,
  },
  {
    id: "tl-3",
    t: "01:04",
    speaker: "client",
    name: "Yael",
    lang: "en",
    text: "Around 1.8 to 2.2 seconds end-to-end. Honestly anything above one second feels broken for our traders.",
    entities: ["latency", "p95"],
    isFinal: true,
  },
  {
    id: "tl-4",
    t: "01:18",
    speaker: "client",
    name: "Daniel",
    lang: "he",
    text: "וגם המחיר על Claude Sonnet התחיל לטפס. אנחנו כבר ב‑$38K לחודש רק על inference, וזה לפני שאנחנו מתחילים לדבר על fine-tuning.",
    trans:
      "And the price on Claude Sonnet has started climbing. We're already at $38K/month just on inference, before we even talk about fine-tuning.",
    entities: ["Claude Sonnet", "Bedrock", "$38K/mo"],
    isFinal: true,
  },
  {
    id: "tl-5",
    t: "01:34",
    speaker: "rep",
    name: "Noa",
    lang: "en",
    text: "Understood. Are you doing any model versioning across teams, or is it one shared endpoint right now?",
    isFinal: true,
  },
  {
    id: "tl-6",
    t: "01:41",
    speaker: "client",
    name: "Daniel",
    lang: "en",
    text: "One shared endpoint. It's becoming a problem — risk team wants stable behavior, research wants the latest. We're hacking around it with prompt prefixes.",
    entities: ["model versioning", "shared endpoint"],
    sentiment: "concern",
    isFinal: true,
  },
  {
    id: "tl-7",
    t: "01:55",
    speaker: "client",
    name: "Yael",
    lang: "he",
    text: "תקשיב, אם אנחנו עוברים, אנחנו צריכים שזה יקרה ברבעון הזה. ה‑board לוחץ.",
    trans: "Look — if we migrate, it has to happen this quarter. The board is pushing.",
    sentiment: "buying",
    isFinal: true,
  },
];

export const HINTS_REPLAY: Hint[] = [
  {
    id: "h1",
    title: "AWS Bedrock mentioned",
    category: "Competitive",
    color: "blue",
    summary:
      "Client is running Anthropic Claude on Bedrock. Reframe around Model Garden's one-click access to 200+ models including Claude, Llama, Gemini and pay-as-you-go pricing.",
    proofPoints: [
      "Vertex AI Model Garden supports Anthropic, Meta, Mistral & Google models from a single endpoint.",
      "Multi-model A/B routing without redeploying infrastructure.",
      "Regional endpoints in europe-west4 (Eemshaven) cut p95 by ~40% for EU traffic.",
    ],
    sources: ["Battlecard: Bedrock vs. Vertex (Q1)", "Customer story: NeoBank — 1.9s → 380ms"],
    confidence: 0.92,
    timestamp: "01:22",
  },
  {
    id: "h2",
    title: "Latency pain — 1.8–2.2s p95",
    category: "Problem→Solution",
    color: "red",
    summary:
      "Client mentioned 1.8–2.2s end-to-end latency from EU traders. Their endpoint is likely us-east. Surface regional Vertex endpoints + provisioned throughput.",
    proofPoints: [
      "europe-west4 + private Service Connect typically lands sub-500ms for Tel Aviv ↔ Frankfurt.",
      "Provisioned throughput removes cold-start variance for trading workloads.",
      "Auto-failover across two EU regions for compliance.",
    ],
    sources: ["Latency calculator", "Reference arch: low-latency inference"],
    confidence: 0.88,
    timestamp: "01:09",
  },
  {
    id: "h3",
    title: "Cost climbing — $38K/mo on inference",
    category: "Commercial",
    color: "yellow",
    summary:
      "Spend on Claude Sonnet via Bedrock is escalating. Position committed-use discounts + Gemini 2.5 Flash for non-critical paths.",
    proofPoints: [
      "CUDs on Vertex give 25–52% off list for 1y/3y commitments.",
      "Hybrid routing: Gemini Flash for triage, Claude on Vertex for high-value queries — typically 30–45% TCO drop.",
    ],
    sources: ["Pricing model (sheet)", "ROI calculator"],
    confidence: 0.83,
    timestamp: "01:31",
  },
];

export const FOLLOWUPS_REPLAY = [
  "Which AWS region are your model endpoints in today?",
  "Have you benchmarked Gemini 2.5 Flash for the triage tier?",
  "Who owns the model-versioning policy — research, risk, or platform?",
  "What's your hard ceiling on p95 latency before this becomes a board issue?",
];

const SENTIMENT_SERIES = [62, 64, 66, 65, 60, 55, 52, 56, 61, 68, 74, 78, 81, 84, 86, 84, 82, 85, 88, 90];
const SENTIMENT_EVENTS = [
  { at: 5, label: "Small talk", kind: "neutral" as const },
  { at: 8, label: "Hesitation detected", kind: "concern" as const },
  { at: 12, label: "Engagement rising", kind: "positive" as const },
  { at: 18, label: "Buying signal", kind: "buying" as const },
];

/**
 * Schedule entries: { atMs, frame } — emitted in order via setTimeout from session start.
 * 5-min compressed timeline (~12s window between events) so demo feels live.
 */
export interface ReplayStep {
  atMs: number;
  frame: ServerWsMessage;
}

export function buildReplaySchedule(): ReplayStep[] {
  const steps: ReplayStep[] = [];

  // Followups land first (pre-meeting context)
  steps.push({ atMs: 600, frame: { type: "followups", items: FOLLOWUPS_REPLAY } });

  // Transcript lines — one every 6s
  TRANSCRIPT_REPLAY.forEach((line, i) => {
    steps.push({ atMs: 1500 + i * 6000, frame: { type: "transcript-final", line } });
  });

  // Hints — staggered after transcript triggers them
  HINTS_REPLAY.forEach((hint, i) => {
    steps.push({ atMs: 4500 + i * 8000, frame: { type: "hint", hint } });
  });

  // Sentiment samples — every 3s, 20 samples covering the window
  SENTIMENT_SERIES.forEach((value, i) => {
    const event = SENTIMENT_EVENTS.find((e) => e.at === i);
    const sample: SentimentSample = event ? { at: i, value, event } : { at: i, value };
    steps.push({ atMs: 2000 + i * 3000, frame: { type: "sentiment", sample } });
  });

  return steps.sort((a, b) => a.atMs - b.atMs);
}
