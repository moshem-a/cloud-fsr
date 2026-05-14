import type { FastifyInstance } from "fastify";

import { liveRepo } from "../repos/live.repo.ts";
import { meetingsRepo } from "../repos/meetings.repo.ts";
import type { TranscriptLine } from "@scoach/types";
import { getOrCreateSession, handleFinalLine, pushAudio, pushScreenFrame, runRollingSummary, setInfographicImageInterval, stopSession, triggerInfographicImage } from "../services/audio-session.service.ts";
import { summaryRepo } from "../repos/summary.repo.ts";
import { classifyMeetingType, generateMeetingSummary } from "../services/summary.service.ts";
import { isFirestoreEnabled, getDb } from "../repos/firestore.ts";

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
    // Run final summary BEFORE stopping the session so transcript is fresh
    const session = getOrCreateSession(req.params.id);
    await runRollingSummary(session).catch((err) =>
      console.warn(`[live] final summary on end failed: ${(err as Error).message}`),
    );
    stopSession(req.params.id);

    let latest = await summaryRepo.get(req.params.id).catch(() => null);

    // Fallback: if runRollingSummary didn't produce a summary, generate directly from Firestore
    if (!latest && isFirestoreEnabled()) {
      try {
        const snap = await getDb()
          .collection("meetings").doc(req.params.id)
          .collection("transcript").orderBy("_at", "asc").get();
        const transcript = snap.docs.map((d) => d.data() as TranscriptLine);
        if (transcript.length > 0) {
          const summary = await generateMeetingSummary(m, transcript);
          await summaryRepo.write(req.params.id, summary);
          latest = summary;
        }
      } catch (err) {
        console.warn(`[live] fallback summary on end failed: ${(err as Error).message}`);
      }
    }

    const meetingType = latest ? classifyMeetingType(latest.internal, m) : m.meetingType;
    await meetingsRepo.patch(req.params.id, {
      status: latest ? "summarized" : "ended",
      meetingType,
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

  app.patch<{
    Params: { id: string };
    Body: { intervalMin: number };
  }>("/meetings/:id/infographic-interval", async (req, reply) => {
    const m = await meetingsRepo.get(req.params.id);
    if (!m || m.ownerUid !== req.user!.uid) {
      return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
    }
    setInfographicImageInterval(req.params.id, req.body.intervalMin);
    return reply.code(204).send();
  });

  app.post<{
    Params: { id: string };
    Body: { hintTopic?: string };
  }>("/meetings/:id/generate-infographic", async (req, reply) => {
    const m = await meetingsRepo.get(req.params.id);
    if (!m || m.ownerUid !== req.user!.uid) {
      return reply.code(404).send({ code: "not-found", message: "Meeting not found" });
    }
    void triggerInfographicImage(req.params.id, req.body?.hintTopic);
    return reply.code(202).send({ status: "generating" });
  });

  app.get<{
    Params: { id: string; file: string };
  }>("/meetings/:id/infographic-images/:file", async (req, reply) => {
    const result = await liveRepo.readInfographicImage(`${req.params.id}/${req.params.file}`);
    if (!result) {
      return reply.code(404).send({ code: "not-found", message: "Image not found" });
    }
    return reply
      .header("Content-Type", result.contentType)
      .header("Cache-Control", "public, max-age=86400")
      .send(result.buffer);
  });
}
