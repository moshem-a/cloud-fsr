import type { FastifyInstance } from "fastify";

import { liveRepo } from "../repos/live.repo.ts";
import { meetingsRepo } from "../repos/meetings.repo.ts";
import type { TranscriptLine } from "@scoach/types";
import { getOrCreateSession, handleFinalLine, pushAudio, pushScreenFrame, stopSession } from "../services/audio-session.service.ts";

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

  // JPEG parser for screen frame analysis.
  app.addContentTypeParser(
    "image/jpeg",
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body),
  );

  app.post<{
    Params: { id: string };
    Querystring: { source?: "mic" | "tab" };
  }>("/meetings/:id/audio", async (req, reply) => {
    const m = await meetingsRepo.get(req.params.id);
    if (!m || m.ownerUid !== req.user!.uid) {
      return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
    }
    const buf = req.body as Buffer | undefined;
    // Empty bodies are fine — the worklet occasionally flushes a zero-sample
    // chunk (silence boundary, tab focus change). Don't 400 the loop.
    if (buf && buf.length > 0) {
      // mic = rep's voice, tab = client/customer audio. Default to "client"
      // (= old single-stream behaviour, which was always shared-tab audio).
      const role = req.query.source === "mic" ? "rep" : "client";
      pushAudio(req.params.id, role, buf);
    }
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>("/meetings/:id/screen-frame", async (req, reply) => {
    const m = await meetingsRepo.get(req.params.id);
    if (!m || m.ownerUid !== req.user!.uid) {
      return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
    }
    const buf = req.body as Buffer | undefined;
    if (buf && buf.length > 0) {
      void pushScreenFrame(req.params.id, buf);
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

  // Direct transcript line injection — used by the simulation feature.
  // The browser sends Gemini Live's text responses as client transcript lines,
  // which then flow through the same hint/sentiment/infographic pipeline.
  app.post<{
    Params: { id: string };
    Body: TranscriptLine;
  }>("/meetings/:id/transcript", async (req, reply) => {
    const m = await meetingsRepo.get(req.params.id);
    if (!m || m.ownerUid !== req.user!.uid) {
      return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
    }
    const session = getOrCreateSession(req.params.id);
    await handleFinalLine(session, req.body);
    return reply.code(204).send();
  });

  // Replace the entire notes array — used for inline edit / delete from the
  // rail's NotesPanel. Cheaper than per-note PATCH and avoids an index race
  // with the optimistic local state.
  app.put<{
    Params: { id: string };
    Body: { notes: { t: string; text: string }[] };
  }>("/meetings/:id/notes", async (req, reply) => {
    const m = await meetingsRepo.get(req.params.id);
    if (!m || m.ownerUid !== req.user!.uid) {
      return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
    }
    const cleaned = (req.body.notes ?? [])
      .filter((n) => typeof n?.text === "string")
      .map((n) => ({ t: String(n.t ?? ""), text: n.text.trim() }))
      .filter((n) => n.text.length > 0);
    await meetingsRepo.patch(req.params.id, { notes: cleaned });
    return reply.code(204).send();
  });
}
