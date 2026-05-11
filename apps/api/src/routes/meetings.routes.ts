import type {
  CreateMeetingRequest,
  ListHistoryQuery,
  ListHistoryResponse,
  ListMeetingsResponse,
  Meeting,
  MeetingStage,
} from "@scoach/types";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

import { meetingsRepo } from "../repos/meetings.repo.ts";
import { summaryRepo } from "../repos/summary.repo.ts";

export async function registerMeetingsRoutes(app: FastifyInstance) {
  app.get<{ Reply: ListMeetingsResponse }>("/meetings", async (req) => {
    const items = await meetingsRepo.listForOwner(req.user!.uid);
    return { items };
  });

  app.get<{ Reply: ListHistoryResponse; Querystring: ListHistoryQuery }>(
    "/meetings/history",
    async (req) => {
      const { scope, stage, search } = req.query;
      const items = await meetingsRepo.historyForOwner(req.user!.uid, {
        scope: (scope as "mine" | "shared") ?? "mine",
        stage: stage as MeetingStage | undefined,
        search: search ?? undefined,
      });
      return { items };
    },
  );

  app.get<{ Params: { id: string }; Reply: Meeting | { code: string; message: string } }>(
    "/meetings/:id",
    async (req, reply) => {
      const m = await meetingsRepo.get(req.params.id);
      if (!m) return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
      if (m.ownerUid !== req.user!.uid) {
        return reply.code(403).send({ code: "forbidden", message: "Not your meeting" });
      }
      return reply.send(m);
    },
  );

  app.post<{ Body: CreateMeetingRequest; Reply: Meeting }>(
    "/meetings",
    async (req, reply) => {
      // Idempotency-Key header is required per ADR. For Sprint 2 we just accept it; Sprint 5 wires real dedupe.
      if (!req.headers["idempotency-key"]) {
        return reply
          .code(400)
          .send({ code: "missing-idempotency-key", message: "Idempotency-Key header required" } as unknown as Meeting);
      }
      const now = new Date().toISOString();
      // Build account without undefined fields (Firestore rejects them).
      const account: Meeting["account"] = { name: req.body.account.name || "Untitled" };
      if (req.body.account.website) account.website = req.body.account.website;

      const m: Meeting = {
        id: randomUUID(),
        ownerUid: req.user!.uid,
        account,
        title: req.body.title || "Untitled meeting",
        stage: req.body.stage,
        language: "auto",
        participants: [],
        contextFiles: [],
        contextItems: [],
        notes: [],
        status: "draft",
        createdAt: now,
        updatedAt: now,
      };
      await meetingsRepo.create(m);
      return reply.code(201).send(m);
    },
  );

  app.patch<{ Params: { id: string }; Body: Partial<Meeting>; Reply: Meeting | { code: string; message: string } }>(
    "/meetings/:id",
    async (req, reply) => {
      const existing = await meetingsRepo.get(req.params.id);
      if (!existing) return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
      if (existing.ownerUid !== req.user!.uid) {
        return reply.code(403).send({ code: "forbidden", message: "Not your meeting" });
      }
      const updated = await meetingsRepo.patch(req.params.id, req.body);
      if (!updated) return reply.code(500).send({ code: "patch-failed", message: "Patch failed" });
      return reply.send(updated);
    },
  );

  app.post<{ Params: { id: string }; Reply: Meeting | { code: string; message: string } }>(
    "/meetings/:id/simulate",
    async (req, reply) => {
      const parent = await meetingsRepo.get(req.params.id);
      if (!parent) return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
      if (parent.ownerUid !== req.user!.uid) {
        return reply.code(403).send({ code: "forbidden", message: "Not your meeting" });
      }

      const summary = await summaryRepo.get(parent.id);
      const actionItems = summary?.internal?.actionItems ?? [];
      const goalParts = [`Practice follow-up with ${parent.account.name}.`];
      if (actionItems.length > 0) {
        goalParts.push(`Open items: ${actionItems.filter((a) => !a.done).map((a) => a.what).join("; ")}`);
      }
      if (summary?.internal?.couldImprove?.length) {
        goalParts.push(`Focus on: ${summary.internal.couldImprove.slice(0, 2).join("; ")}`);
      }

      const now = new Date().toISOString();
      const sim: Meeting = {
        id: randomUUID(),
        ownerUid: req.user!.uid,
        account: { ...parent.account },
        title: `Simulation — ${parent.title}`,
        goal: goalParts.join(" "),
        stage: parent.stage,
        meetingType: "simulation",
        parentMeetingId: parent.id,
        language: parent.language,
        participants: parent.participants.map((p) => ({ ...p })),
        contextFiles: [],
        contextItems: parent.contextItems ? [...parent.contextItems] : [],
        notes: [],
        status: "draft",
        createdAt: now,
        updatedAt: now,
      };
      await meetingsRepo.create(sim);
      return reply.code(201).send(sim);
    },
  );

  app.delete<{ Params: { id: string }; Reply: { ok: boolean } | { code: string; message: string } }>(
    "/meetings/:id",
    async (req, reply) => {
      const existing = await meetingsRepo.get(req.params.id);
      if (!existing) return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
      if (existing.ownerUid !== req.user!.uid) {
        return reply.code(403).send({ code: "forbidden", message: "Not your meeting" });
      }
      await meetingsRepo.remove(req.params.id);
      return reply.send({ ok: true });
    },
  );
}
