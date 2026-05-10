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
      const files: UploadContextResponse["files"] = [];
      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          const buf = await part.toBuffer();
          files.push({
            id: randomUUID(),
            name: part.filename ?? "file",
            size: buf.byteLength,
            sha256: "stub",
            contentType: part.mimetype ?? "application/octet-stream",
            uploadedAt: new Date().toISOString(),
            indexed: true,
          });
        }
      }
      await meetingsRepo.patch(req.params.id, { contextFiles: [...m.contextFiles, ...files] });
      return reply.send({ files });
    },
  );

  app.post<{ Params: { id: string }; Reply: AnalyzeContextResponse }>(
    "/meetings/:id/context/analyze",
    async (req, reply) => {
      const m = await meetingsRepo.get(req.params.id);
      if (!m || m.ownerUid !== req.user!.uid) {
        return reply.code(404).send({ jobId: "" });
      }
      const meetingId = req.params.id;
      analysisJobs.set(meetingId, { status: "pending" });
      setTimeout(() => {
        const fileNames = m.contextFiles.map((f) => f.name).join(", ");
        analysisJobs.set(meetingId, {
          status: "done",
          result: {
            status: "done",
            summary: `Context analysis for ${m.account.name}. Analyzed: ${fileNames || "uploaded documents"}.`,
            insights: {
              entities: ["Vertex AI", m.account.name, ...(m.goal ? [m.goal.split(/\s+/).slice(0, 3).join(" ")] : [])].filter(Boolean),
              painPoints: m.goal
                ? [`Key focus: ${m.goal.slice(0, 80)}`]
                : ["Upload context documents and re-analyze for specific insights"],
              tags: [m.stage ?? "Discovery", m.account.industry ?? "Technology", ...(m.account.region ? [m.account.region] : [])].filter(Boolean),
            },
          },
        });
      }, 800);
      return reply.code(202).send({ jobId: meetingId });
    },
  );

  app.get<{ Params: { id: string }; Reply: ContextAnalysisResult }>(
    "/meetings/:id/context/analysis",
    async (req, reply) => {
      const job = analysisJobs.get(req.params.id);
      if (!job) return reply.send({ status: "pending" });
      return reply.send(job.result ?? { status: job.status });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/meetings/:id/tips",
    async (req, reply) => {
      const m = await meetingsRepo.get(req.params.id);
      if (!m || m.ownerUid !== req.user!.uid) {
        return reply.code(404).send({ tips: [] });
      }
      const analysis = analysisJobs.get(req.params.id);
      const insights = analysis?.result?.insights;
      const tips = generateMeetingTips(m, insights ?? null);
      return reply.send({ tips });
    },
  );
}

function generateMeetingTips(
  m: { account: { name: string; website?: string; industry?: string; region?: string }; goal?: string; stage: string; contextFiles: { name: string }[] },
  insights: { entities: string[]; painPoints: string[]; tags: string[] } | null,
): string[] {
  const tips: string[] = [];
  const stage = m.stage?.toLowerCase() ?? "";

  if (stage === "intro" || stage === "discovery") {
    tips.push(`Start with open-ended questions about ${m.account.name}'s current cloud strategy — let them talk 70% of the time.`);
    tips.push("Focus on understanding their pain points before presenting any solutions.");
  }
  if (stage === "qualification") {
    tips.push(`Confirm ${m.account.name}'s budget range and decision timeline early in the conversation.`);
    tips.push("Identify the technical champion and economic buyer — they may not be the same person.");
  }
  if (stage === "negotiation") {
    tips.push("Lead with value delivered, not pricing. Frame costs as investment against their stated pain points.");
    tips.push("Have your final pricing authority pre-approved so you can move fast if they're ready to commit.");
  }

  if (m.goal) {
    tips.push(`Your stated goal: "${m.goal.slice(0, 100)}${m.goal.length > 100 ? "…" : ""}" — keep steering the conversation back to this.`);
  }

  if (m.account.website) {
    tips.push(`Review ${m.account.website} before the call — note their tech stack, recent blog posts, and any job postings that reveal infra priorities.`);
  }

  if (insights?.painPoints && insights.painPoints.length > 0) {
    tips.push(`Key pain points from your context docs: ${insights.painPoints.slice(0, 2).join("; ")}. Reference these to show you've done your homework.`);
  }

  if (insights?.entities && insights.entities.length > 0) {
    const competitors = insights.entities.filter((e) =>
      /bedrock|sagemaker|snowflake|databricks|azure|aws|openai/i.test(e),
    );
    if (competitors.length > 0) {
      tips.push(`Competitors in play: ${competitors.join(", ")}. Prepare differentiators and be ready for comparison questions.`);
    }
  }

  if (m.contextFiles.length > 0) {
    tips.push(`You have ${m.contextFiles.length} context document${m.contextFiles.length > 1 ? "s" : ""} loaded — the coach will use these to generate more targeted hints during the call.`);
  } else {
    tips.push("Consider uploading battlecards or prior call notes in the Context step — this significantly improves hint quality.");
  }

  if (m.account.region) {
    tips.push(`Client is in ${m.account.region} — be mindful of regional compliance requirements and data residency concerns.`);
  }

  tips.push("Take notes during the call using the Notes panel — they persist across sessions and appear in the post-meeting summary.");

  return tips;
}
