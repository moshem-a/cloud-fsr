import type { MeetingSummary } from "@scoach/types";

export const SUMMARY: MeetingSummary = {
  meetingId: "m-aviv-3",
  meeting: {
    client: "Aviv Capital",
    title: "Vertex AI Migration · Technical deep-dive",
    date: "2026-04-24T14:00:00Z",
    duration: "47 minutes",
    participants: ["Yael Ben-David (VP Eng)", "Daniel Cohen (Staff ML)", "Noa Levi (Sally workspace)"],
  },
  internal: {
    confidence: 0.78,
    health: "warm",
    score: 86,
    wentWell: [
      "Reframed Bedrock spend conversation around Model Garden — client engaged immediately.",
      "Surfaced regional endpoints (europe-west4) at the right moment when latency pain was admitted.",
      "Caught the buying signal at 22:34 and pivoted to procurement timeline.",
    ],
    couldImprove: [
      "Did not probe deeply enough on existing AWS contractual commitments — risk of co-existence.",
      "Skipped competitive Anthropic-on-Bedrock pricing comparison; would have strengthened the cost narrative.",
      "Missed opportunity to ask about VPC-SC / CMEK requirements after security mention.",
    ],
    upsell: [
      { name: "Vertex AI Pipelines", reason: "Daniel mentioned manual model promotion across teams.", estimatedMonthlyArr: 14000 },
      { name: "BigQuery ML", reason: "Trading-signal team currently exports to Snowflake — clean migration path." },
      { name: "Cloud Armor + WAF", reason: "Compliance posture mentioned 3× — security upsell warm." },
    ],
    risks: [
      "Existing Bedrock commitment unclear — could delay POC start.",
      "Yael flagged board pressure for Q2 — aggressive timeline risk.",
    ],
    needs: {
      stated: ["Lower latency from EU", "Multi-model flexibility", "Cost predictability"],
      actual: ["Architectural escape hatch from AWS", "Better governance for risk team", "Q2 board win"],
    },
    actionItems: [
      { id: "ai-1", who: "Noa", what: "Send latency benchmark for europe-west4 vs us-east-1", due: "2026-04-28", done: false },
      { id: "ai-2", who: "Noa", what: "Loop in Lior on architecture review", due: "2026-04-30", done: false },
      { id: "ai-3", who: "Maya", what: "Prepare Model Garden + Anthropic-on-Vertex pricing comparison", due: "2026-05-02", done: false },
      { id: "ai-4", who: "Yael", what: "Share existing AWS commitment terms", due: "2026-04-30", done: false },
    ],
    topMoments: [
      { t: "22:34", type: "Buying signal", quote: "If we migrate, it has to happen this quarter. The board is pushing." },
      { t: "01:18", type: "Cost concern", quote: "We're already at $38K/month just on inference." },
      { t: "01:04", type: "Latency pain", quote: "Around 1.8 to 2.2 seconds end-to-end." },
    ],
  },
  client: {
    subject: "Recap — Vertex AI migration discussion (Apr 24)",
    greeting: "Hi Yael, Daniel,",
    body: [
      "Thank you for the detailed conversation today. Quick recap of what we discussed and the next steps we agreed on.",
      "**Discussion summary**\nWe walked through your current model serving setup on AWS Bedrock and the latency challenges you're seeing for European traders (1.8–2.2s p95). We aligned on the value of evaluating Vertex AI Model Garden as a path to consolidate Anthropic, Google, and open-source models behind a single endpoint with regional deployment in europe-west4.",
      "**Key topics covered**\n• Current state: ~$38K/month inference spend on Claude Sonnet via Bedrock\n• Latency requirements: sub-1s p95 for trading workflows\n• Multi-team versioning challenges between research and risk\n• Compliance posture: VPC-SC and CMEK requirements",
      "**Next steps**\n• I will send a latency benchmark comparing europe-west4 to your current us-east-1 setup by Apr 28.\n• Maya from our team will prepare a pricing comparison for Model Garden vs. your current Bedrock spend by May 2.\n• You agreed to share your current AWS commitment terms so we can plan the migration window appropriately.\n• We will schedule a technical architecture review with Lior, our solutions architect, for the week of May 5.",
      "Looking forward to continuing the conversation. Please don't hesitate to reach out with any questions in the meantime.",
    ],
    signoff: "Best,\nNoa Levi\nSr. Cloud SE",
    tone: "warm",
  },
  references: [
    { title: "Vertex AI Model Garden — overview", href: "https://cloud.google.com/model-garden", source: "cloud.google.com" },
    { title: "Anthropic Claude on Vertex AI", href: "https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude", source: "cloud.google.com" },
    { title: "Regional endpoints for Vertex AI (europe-west4)", href: "https://cloud.google.com/vertex-ai/docs/general/locations", source: "cloud.google.com" },
    { title: "Vertex AI pricing & committed-use discounts", href: "https://cloud.google.com/vertex-ai/pricing", source: "cloud.google.com" },
    { title: "Provisioned throughput for Generative AI", href: "https://cloud.google.com/vertex-ai/generative-ai/docs/provisioned-throughput", source: "cloud.google.com" },
    { title: "Customer story — low-latency inference in EU", href: "https://cloud.google.com/customers", source: "cloud.google.com" },
  ],
  generatedAt: "2026-04-24T14:47:18Z",
  generationLatencyMs: 4200,
};
