import type {
  AnalyzeContextResponse,
  ContextAnalysisResult,
  UploadContextResponse,
} from "@scoach/types";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

import { meetingsRepo } from "../repos/meetings.repo.ts";

/**
 * Sprint 2: stub implementation that records uploads in the meeting record
 * and returns a fake "indexed" file. Sprint 4 wires:
 *   - GCS signed URL upload (server mints PUT URL → browser uploads)
 *   - PDF/DOCX parse via pdf-parse + mammoth
 *   - Vertex AI Gemini summarization for entities + pain points
 */
const analysisJobs = new Map<string, { status: "pending" | "done"; result?: ContextAnalysisResult }>();

export async function registerContextRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Reply: UploadContextResponse }>(
    "/meetings/:id/context",
    async (req, reply) => {
      const m = await meetingsRepo.get(req.params.id);
      if (!m || m.ownerUid !== req.user!.uid) {
        return reply.code(404).send({ files: [] });
      }
      // Stub: record N fake files. Real impl reads multipart and stores to GCS.
      const fake = [
        {
          id: randomUUID(),
          name: "uploaded.pdf",
          size: 1024 * 1024,
          sha256: "stub",
          contentType: "application/pdf",
          uploadedAt: new Date().toISOString(),
          indexed: true,
        },
      ];
      await meetingsRepo.patch(req.params.id, { contextFiles: [...m.contextFiles, ...fake] });
      return reply.send({ files: fake });
    },
  );

  app.post<{ Params: { id: string }; Reply: AnalyzeContextResponse }>(
    "/meetings/:id/context/analyze",
    async (req, reply) => {
      const m = await meetingsRepo.get(req.params.id);
      if (!m || m.ownerUid !== req.user!.uid) {
        return reply.code(404).send({ jobId: "" });
      }
      const jobId = randomUUID();
      analysisJobs.set(jobId, { status: "pending" });
      // Sprint 4 calls Vertex AI here; for now return canned insights after a tick
      setTimeout(() => {
        analysisJobs.set(jobId, {
          status: "done",
          result: {
            status: "done",
            summary: `Context analysis stub for ${m.account.name}.`,
            insights: {
              entities: ["Vertex AI", "Bedrock", "VPC-SC", "CMEK"],
              painPoints: ["High EU latency", "Cost climbing", "Multi-team versioning"],
              tags: ["EMEA", "Cost-sensitive", "Latency-critical", "Compliance"],
            },
          },
        });
      }, 800);
      return reply.code(202).send({ jobId });
    },
  );

  app.get<{ Params: { id: string }; Reply: ContextAnalysisResult }>(
    "/meetings/:id/context/analysis",
    async (_req, reply) => {
      // Return the most recent job for this meeting. Sprint 4 keys jobs by meetingId.
      const recent = Array.from(analysisJobs.values()).pop();
      if (!recent) return reply.send({ status: "pending" });
      return reply.send(recent.result ?? { status: recent.status });
    },
  );
}
