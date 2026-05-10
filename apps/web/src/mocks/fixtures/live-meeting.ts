import type { Hint, Infographic, Meeting, SentimentEvent, TranscriptLine } from "@scoach/types";

export const LIVE_MEETING: Meeting = {
  id: "m-aviv-3",
  ownerUid: "u-noa",
  account: {
    name: "Aviv Capital",
    industry: "Fintech · Series B",
    region: "Tel Aviv, IL",
    contact: "Yael Ben-David",
    contactRole: "VP Engineering",
    deal: "Vertex AI Migration",
    arr: "$1.4M ARR (potential)",
    website: "avivcapital.com",
  },
  title: "Vertex AI Migration · Technical deep-dive",
  goal:
    "Follow-up on previous Vertex AI discussion. Probe latency requirements and current Bedrock spend; surface Model Garden + regional endpoints.",
  stage: "Discovery",
  language: "auto",
  scheduledAt: "2026-04-24T14:00:00Z",
  startedAt: "2026-04-24T14:00:00Z",
  participants: [
    { name: "Yael Ben-David", role: "VP Engineering, Aviv Capital", side: "client", color: "#EA4335", initials: "YB" },
    { name: "Daniel Cohen", role: "Staff ML Engineer, Aviv", side: "client", color: "#F9AB00", initials: "DC" },
    { name: "You — Noa Levi", role: "Sr. Cloud SE", side: "rep", color: "#1A73E8", initials: "NL" },
  ],
  contextFiles: [],
  contextItems: [
    { kind: "url", label: "avivcapital.com", note: "Series B fintech, algo trading desk" },
    { kind: "doc", label: "Discovery call notes — Mar 14", note: "Bedrock spend, multi-model interest" },
    { kind: "case", label: "NeoBank — Vertex migration", note: "Comparable EU latency story" },
    { kind: "doc", label: "Aviv security review.pdf", note: "VPC-SC + CMEK requirements" },
  ],
  notes: [{ t: "00:21", text: "Yael seemed cooler than last call — board pressure?" }],
  status: "live",
  createdAt: "2026-04-24T13:45:00Z",
  updatedAt: "2026-04-24T14:00:00Z",
};

export const TRANSCRIPT: TranscriptLine[] = [
  {
    id: "tl-1",
    t: "00:42",
    speaker: "client",
    name: "Yael",
    lang: "he",
    text: "אז כמו שאמרתי, אנחנו כרגע מריצים את המודלים שלנו על Bedrock, וזה עובד — אבל יש לנו בעיית latency משמעותית מהלקוחות באירופה.",
    trans: "So as I said, we're currently running our models on Bedrock — it works, but we have significant latency issues from European customers.",
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
    trans: "And the price on Claude Sonnet has started climbing. We're already at $38K/month just on inference, before we even talk about fine-tuning.",
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

export const HINTS: Hint[] = [
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

export const FOLLOWUPS: string[] = [
  "Which AWS region are your model endpoints in today?",
  "Have you benchmarked Gemini 2.5 Flash for the triage tier?",
  "Who owns the model-versioning policy — research, risk, or platform?",
  "What's your hard ceiling on p95 latency before this becomes a board issue?",
];

export const SENTIMENT_SERIES = [62, 64, 66, 65, 60, 55, 52, 56, 61, 68, 74, 78, 81, 84, 86, 84, 82, 85, 88, 90];

export const SENTIMENT_EVENTS: SentimentEvent[] = [
  { at: 5, label: "Small talk", kind: "neutral" },
  { at: 8, label: "Hesitation detected", kind: "concern" },
  { at: 12, label: "Engagement rising", kind: "positive" },
  { at: 18, label: "Buying signal", kind: "buying" },
];

export const MOCK_INFOGRAPHICS: Infographic[] = [
  {
    id: "ig-1",
    kind: "steps",
    title: "Migration Roadmap",
    generatedAt: new Date().toISOString(),
    data: {
      steps: [
        { title: "Assessment", detail: "Audit Bedrock usage" },
        { title: "POC", detail: "Vertex AI Model Garden" },
        { title: "Migrate", detail: "Re-point endpoints" },
        { title: "Optimize", detail: "Regional tuning" },
      ],
    },
  },
  {
    id: "ig-2",
    kind: "flow",
    title: "Current Architecture",
    generatedAt: new Date().toISOString(),
    data: {
      nodes: [
        { id: "app", label: "Trading App" },
        { id: "api", label: "API Gateway" },
        { id: "bedrock", label: "AWS Bedrock" },
        { id: "vertex", label: "Vertex AI" },
        { id: "bq", label: "BigQuery" },
      ],
      edges: [
        { from: "app", to: "api" },
        { from: "api", to: "bedrock", label: "current" },
        { from: "api", to: "vertex", label: "planned" },
        { from: "vertex", to: "bq", label: "logs" },
      ],
    },
  },
  {
    id: "ig-3",
    kind: "comparison",
    title: "Bedrock vs Vertex AI",
    generatedAt: new Date().toISOString(),
    data: {
      columns: [
        { header: "Bedrock", items: ["3 regions", "150ms p50", "$2.1/M tokens", "Limited fine-tune"] },
        { header: "Vertex AI", items: ["8 regions", "95ms p50", "$1.8/M tokens", "Full fine-tune + distill"] },
      ],
    },
  },
  {
    id: "ig-4",
    kind: "gantt",
    title: "Project Timeline",
    generatedAt: new Date().toISOString(),
    data: {
      tasks: [
        { name: "Assessment", start: "2026-05-01", end: "2026-05-15" },
        { name: "POC Build", start: "2026-05-12", end: "2026-06-01" },
        { name: "Migration", start: "2026-06-01", end: "2026-07-15" },
        { name: "Go-live", start: "2026-07-15", end: "2026-07-31" },
      ],
    },
  },
  {
    id: "ig-5",
    kind: "timeline",
    title: "Key Discussion Points",
    generatedAt: new Date().toISOString(),
    data: {
      entries: [
        { label: "Latency requirements discussed", date: "14:05", detail: "Sub-100ms p50 target" },
        { label: "Bedrock cost concerns raised", date: "14:12", detail: "$2.1/M tokens current spend" },
        { label: "Model Garden demo requested", date: "14:18", detail: "Gemma 2 + regional endpoints" },
        { label: "POC timeline agreed", date: "14:25", detail: "2-week assessment phase" },
      ],
    },
  },
];
