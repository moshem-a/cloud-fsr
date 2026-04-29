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
}
