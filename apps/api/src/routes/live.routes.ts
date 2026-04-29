import type { FastifyInstance } from "fastify";

import { liveRepo } from "../repos/live.repo.ts";
import { meetingsRepo } from "../repos/meetings.repo.ts";
import { pushAudio, stopSession } from "../services/audio-session.service.ts";

/**
 * Live meeting HTTP API. Replaces the WebSocket flow because Firebase Hosting
 * does NOT proxy WebSocket Upgrade requests.
 *
 *   POST   /meetings/:id/audio     ← raw PCM 16-bit mono 16kHz, Content-Type: application/octet-stream
 *   PATCH  /meetings/:id/state     ← { listening?: boolean, muted?: boolean }
 *   POST   /meetings/:id/end       ← finalize: close STT session, write summary trigger
 *   POST   /meetings/:id/notes     ← { t: "MM:SS", text: string } private note
 *
 * Server writes transcript / hints / sentiment to Firestore subcollections;
 * the FE listens via onSnapshot.
 */

export async function registerLiveRoutes(app: FastifyInstance) {
  // Raw octet-stream parser for audio chunks.
  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body),
  );

  app.post<{ Params: { id: string } }>("/meetings/:id/audio", async (req, reply) => {
    const m = await meetingsRepo.get(req.params.id);
    if (!m || m.ownerUid !== req.user!.uid) {
      return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
    }
    const buf = req.body as Buffer | undefined;
    // Empty bodies are fine — the worklet occasionally flushes a zero-sample
    // chunk (silence boundary, tab focus change). Don't 400 the loop.
    if (buf && buf.length > 0) {
      pushAudio(req.params.id, buf);
    }
    return reply.code(204).send();
  });

  app.patch<{
    Params: { id: string };
    Body: { listening?: boolean; muted?: boolean };
  }>("/meetings/:id/state", async (req, reply) => {
    const m = await meetingsRepo.get(req.params.id);
    if (!m || m.ownerUid !== req.user!.uid) {
      return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
    }
    await liveRepo.writeLiveState(req.params.id, req.body);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>("/meetings/:id/end", async (req, reply) => {
    const m = await meetingsRepo.get(req.params.id);
    if (!m || m.ownerUid !== req.user!.uid) {
      return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
    }
    stopSession(req.params.id);
    await meetingsRepo.patch(req.params.id, {
      status: "ended",
      endedAt: new Date().toISOString(),
    });
    return reply.code(204).send();
  });

  app.post<{
    Params: { id: string };
    Body: { t: string; text: string };
  }>("/meetings/:id/notes", async (req, reply) => {
    const m = await meetingsRepo.get(req.params.id);
    if (!m || m.ownerUid !== req.user!.uid) {
      return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
    }
    const note = { t: req.body.t, text: req.body.text };
    await meetingsRepo.patch(req.params.id, {
      notes: [...(m.notes ?? []), note],
    });
    return reply.code(204).send();
  });
}
