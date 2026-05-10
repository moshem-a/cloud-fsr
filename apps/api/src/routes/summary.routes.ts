import type {
  ActionItem,
  ClientEmail,
  MeetingSummary,
  RegenerateEmailRequest,
  SummarizeResponse,
  TranscriptLine,
  UpdateActionItemsRequest,
  UpdateActionItemsResponse,
  UpdateEmailRequest,
  UpdateEmailResponse,
} from "@scoach/types";
import type { FastifyInstance } from "fastify";

import { getDb, isFirestoreEnabled } from "../repos/firestore.ts";
import { meetingsRepo } from "../repos/meetings.repo.ts";
import { summaryRepo } from "../repos/summary.repo.ts";
import { renderSummaryPdf } from "../services/pdf.service.ts";
import { defaultClient, generateClientEmail, generateMeetingSummary } from "../services/summary.service.ts";

/**
 * In-memory cache to avoid hitting Firestore on every read. Authoritative
 * source is summaryRepo (Firestore meetings/:id/summary/latest). Cache is
 * populated on first read and invalidated on edit/regenerate.
 */
const summaryCache = new Map<string, MeetingSummary>();

export function invalidateSummaryCache(meetingId: string): void {
  summaryCache.delete(meetingId);
}

async function getOrLoadSummary(meetingId: string): Promise<MeetingSummary | null> {
  const cached = summaryCache.get(meetingId);
  if (cached) return cached;
  const persisted = await summaryRepo.get(meetingId);
  if (persisted) {
    summaryCache.set(meetingId, persisted);
    return persisted;
  }
  return null;
}

async function persistSummary(meetingId: string, summary: MeetingSummary): Promise<void> {
  summaryCache.set(meetingId, summary);
  await summaryRepo.write(meetingId, summary).catch((err) => {
    console.warn(`[summary] persist failed for ${meetingId}: ${(err as Error).message}`);
  });
}

export async function registerSummaryRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Reply: SummarizeResponse }>(
    "/meetings/:id/summarize",
    async (req, reply) => {
      const m = await meetingsRepo.get(req.params.id);
      if (!m || m.ownerUid !== req.user!.uid) {
        return reply.code(404).send({ jobId: "", status: "done" } as SummarizeResponse);
      }
      const [transcript, hintStats, sentimentData] = await Promise.all([
        loadTranscript(req.params.id),
        loadHintStats(req.params.id),
        loadSentimentSeries(req.params.id),
      ]);
      const summary = await generateMeetingSummary(m, transcript, { hintStats, sentimentData });
      await persistSummary(req.params.id, summary);
      return reply.code(202).send({ jobId: `sum-${Date.now()}`, status: "done" });
    },
  );

  app.get<{ Params: { id: string }; Reply: MeetingSummary }>(
    "/meetings/:id/summary-data",
    async (req, reply) => {
      const m = await meetingsRepo.get(req.params.id);
      if (!m || m.ownerUid !== req.user!.uid) {
        return reply.code(404).send({} as MeetingSummary);
      }
      let summary = await getOrLoadSummary(req.params.id);
      if (!summary) {
        const [transcript, hintStats, sentimentData] = await Promise.all([
          loadTranscript(req.params.id),
          loadHintStats(req.params.id),
          loadSentimentSeries(req.params.id),
        ]);
        summary = await generateMeetingSummary(m, transcript, { hintStats, sentimentData });
        await persistSummary(req.params.id, summary);
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
      const transcript = await loadTranscript(req.params.id);
      const email = await generateClientEmail(m, transcript, req.body.tone);
      const cached = await getOrLoadSummary(req.params.id);
      if (cached) await persistSummary(req.params.id, { ...cached, client: email });
      return reply.send(email);
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateEmailRequest; Reply: UpdateEmailResponse }>(
    "/meetings/:id/email",
    async (req, reply) => {
      const m = await meetingsRepo.get(req.params.id);
      if (!m || m.ownerUid !== req.user!.uid) {
        return reply.code(404).send({} as ClientEmail);
      }
      const cached = await getOrLoadSummary(req.params.id);
      const base: ClientEmail = cached?.client ?? defaultClient(m);
      const next: ClientEmail = {
        ...base,
        subject: req.body.subject ?? base.subject,
        bodyText: req.body.bodyText,
        edited: true,
        editedAt: new Date().toISOString(),
      };
      if (cached) await persistSummary(req.params.id, { ...cached, client: next });
      return reply.send(next);
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateActionItemsRequest; Reply: UpdateActionItemsResponse }>(
    "/meetings/:id/action-items",
    async (req, reply) => {
      const m = await meetingsRepo.get(req.params.id);
      if (!m || m.ownerUid !== req.user!.uid) {
        return reply.code(404).send([] as ActionItem[]);
      }
      const cached = await getOrLoadSummary(req.params.id);
      if (!cached) {
        return reply.code(404).send([] as ActionItem[]);
      }
      const next: MeetingSummary = {
        ...cached,
        internal: { ...cached.internal, actionItems: req.body.actionItems },
      };
      await persistSummary(req.params.id, next);
      return reply.send(next.internal.actionItems);
    },
  );

  app.get<{ Params: { id: string } }>("/meetings/:id/summary.pdf", async (req, reply) => {
    const m = await meetingsRepo.get(req.params.id);
    if (!m || m.ownerUid !== req.user!.uid) {
      return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
    }
    // Always reload transcript + sentiment fresh for the PDF — these are the
    // bits the user wants visualized in full, even if a cached summary exists.
    const [summaryMaybe, sentimentData] = await Promise.all([
      getOrLoadSummary(req.params.id),
      loadSentimentSeries(req.params.id),
    ]);
    let summary = summaryMaybe;
    if (!summary) {
      const [transcript, hintStats] = await Promise.all([
        loadTranscript(req.params.id),
        loadHintStats(req.params.id),
      ]);
      summary = await generateMeetingSummary(m, transcript, { hintStats, sentimentData });
      await persistSummary(req.params.id, summary);
    }
    const bytes = await renderSummaryPdf(summary, {
      notes: m.notes ?? [],
      sentimentValues: sentimentData.values,
    });
    return reply
      .header("content-type", "application/pdf")
      .header(
        "content-disposition",
        `attachment; filename="summary-${m.account.name.replace(/\W+/g, "-")}-${m.id.slice(0, 8)}.pdf"`,
      )
      .send(Buffer.from(bytes));
  });
}

async function loadTranscript(meetingId: string): Promise<TranscriptLine[]> {
  if (!isFirestoreEnabled()) return [];
  const snap = await getDb()
    .collection("meetings")
    .doc(meetingId)
    .collection("transcript")
    .orderBy("_at", "asc")
    .get();
  return snap.docs.map((d) => d.data() as TranscriptLine);
}

async function loadHintStats(meetingId: string): Promise<{ total: number; acted: number }> {
  if (!isFirestoreEnabled()) return { total: 0, acted: 0 };
  const snap = await getDb()
    .collection("meetings")
    .doc(meetingId)
    .collection("hints")
    .get();
  let acted = 0;
  for (const d of snap.docs) {
    if (d.data().actedOn) acted++;
  }
  return { total: snap.size, acted };
}

async function loadSentimentSeries(meetingId: string): Promise<{ values: number[]; lastKind: string }> {
  if (!isFirestoreEnabled()) return { values: [], lastKind: "neutral" };
  const snap = await getDb()
    .collection("meetings")
    .doc(meetingId)
    .collection("sentiment")
    .orderBy("at", "asc")
    .get();
  const values = snap.docs.map((d) => (d.data().value as number) ?? 50);
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : undefined;
  const lastKind = lastDoc ? (String(lastDoc.data().event?.kind ?? "neutral")) : "neutral";
  return { values, lastKind };
}
