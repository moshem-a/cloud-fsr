import type {
  ClientEmail,
  MeetingSummary,
  RegenerateEmailRequest,
  SummarizeResponse,
  TranscriptLine,
} from "@scoach/types";
import type { FastifyInstance } from "fastify";

import { meetingsRepo } from "../repos/meetings.repo.ts";
import { renderSummaryPdf } from "../services/pdf.service.ts";
import { generateClientEmail, generateMeetingSummary } from "../services/summary.service.ts";

// In-memory summary cache. Sprint 5+ persists to Firestore meetings/:id/summary doc.
const summaryCache = new Map<string, MeetingSummary>();

export async function registerSummaryRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Reply: SummarizeResponse }>(
    "/meetings/:id/summarize",
    async (req, reply) => {
      const m = await meetingsRepo.get(req.params.id);
      if (!m || m.ownerUid !== req.user!.uid) {
        return reply.code(404).send({ jobId: "", status: "done" } as SummarizeResponse);
      }
      // Synchronous for the small mock dataset; for real STT runs Sprint 5
      // wires a Cloud Tasks queue + polled status endpoint.
      const transcript = await loadTranscript();
      const summary = await generateMeetingSummary(m, transcript);
      summaryCache.set(req.params.id, summary);
      return reply.code(202).send({ jobId: `sum-${Date.now()}`, status: "done" });
    },
  );

  app.get<{ Params: { id: string }; Reply: MeetingSummary }>(
    "/meetings/:id/summary",
    async (req, reply) => {
      const m = await meetingsRepo.get(req.params.id);
      if (!m || m.ownerUid !== req.user!.uid) {
        return reply.code(404).send({} as MeetingSummary);
      }
      let summary = summaryCache.get(req.params.id);
      if (!summary) {
        const transcript = await loadTranscript();
        summary = await generateMeetingSummary(m, transcript);
        summaryCache.set(req.params.id, summary);
      }
      return reply.send(summary);
    },
  );

  app.post<{ Params: { id: string }; Body: RegenerateEmailRequest; Reply: ClientEmail }>(
    "/meetings/:id/email/regenerate",
    async (req, reply) => {
      const m = await meetingsRepo.get(req.params.id);
      if (!m || m.ownerUid !== req.user!.uid) {
        return reply.code(404).send({} as ClientEmail);
      }
      const transcript = await loadTranscript();
      const email = await generateClientEmail(m, transcript, req.body.tone);
      const cached = summaryCache.get(req.params.id);
      if (cached) summaryCache.set(req.params.id, { ...cached, client: email });
      return reply.send(email);
    },
  );

  app.get<{ Params: { id: string } }>("/meetings/:id/summary.pdf", async (req, reply) => {
    const m = await meetingsRepo.get(req.params.id);
    if (!m || m.ownerUid !== req.user!.uid) {
      return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
    }
    let summary = summaryCache.get(req.params.id);
    if (!summary) {
      const transcript = await loadTranscript();
      summary = await generateMeetingSummary(m, transcript);
      summaryCache.set(req.params.id, summary);
    }
    const bytes = await renderSummaryPdf(summary);
    return reply
      .header("content-type", "application/pdf")
      .header(
        "content-disposition",
        `attachment; filename="summary-${m.account.name.replace(/\W+/g, "-")}-${m.id.slice(0, 8)}.pdf"`,
      )
      .send(Buffer.from(bytes));
  });
}

/**
 * Loads the transcript for a meeting. Sprint 5 reads from Firestore's
 * meetings/:id/transcript subcollection. Until that's wired we use an
 * empty placeholder; the summary generator's fallback path produces a
 * sensible stub when no transcript is present.
 */
async function loadTranscript(): Promise<TranscriptLine[]> {
  return [];
}
