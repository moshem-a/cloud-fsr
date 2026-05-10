import type { ClientWsMessage, ServerWsMessage, TranscriptLine } from "@scoach/types";
import { WS_SUBPROTOCOL } from "@scoach/types";
import type { FastifyInstance } from "fastify";

import { meetingsRepo } from "../repos/meetings.repo.ts";
import { buildReplaySchedule } from "../services/canned-replay.ts";
import {
  classifySentiment,
  extractEntities,
  generateHint,
  isGeminiEnabled,
} from "../services/gemini.service.ts";
import { isSttEnabled, openSttSession, type SttSession } from "../services/stt.service.ts";

/**
 * Live meeting WebSocket — `/ws/meeting/:id`
 *
 * Mode A (no GCP_PROJECT_ID): canned-replay path from Sprint 3.
 * Mode B (GCP_PROJECT_ID set): real STT V2 + Vertex Gemini pipeline.
 *
 * Client-side code is identical for both modes — same frame envelopes go up.
 */

const SENTIMENT_TICK_MS = 10_000;
const ROLLING_WINDOW = 12;

export async function registerWsMeeting(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { token?: string } }>(
    "/ws/meeting/:id",
    { websocket: true },
    (socket, req) => {
      const { id } = req.params;
      const token = req.query.token;
      if (!token) {
        socket.close(4001, "missing token");
        return;
      }

      const send = (msg: ServerWsMessage) => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
      };

      let muted = false;
      let started = false;
      let scheduleStartedAt = 0;
      const cannedTimers = new Set<NodeJS.Timeout>();

      let stt: SttSession | null = null;
      const rollingTranscript: TranscriptLine[] = [];
      const seenEntities = new Set<string>();
      let sentimentTick: NodeJS.Timeout | null = null;

      function clearTimers() {
        for (const t of cannedTimers) clearTimeout(t);
        cannedTimers.clear();
        if (sentimentTick) {
          clearInterval(sentimentTick);
          sentimentTick = null;
        }
        stt?.close();
        stt = null;
        started = false;
      }

      function startCannedReplay() {
        if (started) return;
        started = true;
        scheduleStartedAt = Date.now();
        const schedule = buildReplaySchedule();
        for (const step of schedule) {
          const t = setTimeout(() => {
            cannedTimers.delete(t);
            if (muted) return;
            send(step.frame);
          }, step.atMs);
          cannedTimers.add(t);
        }
        app.log.info({ meetingId: id, steps: schedule.length, mode: "canned" }, "replay scheduled");
      }

      async function handleFinalLine(line: TranscriptLine) {
        const tFinal = Date.now();
        rollingTranscript.push(line);
        send({ type: "transcript-final", line });

        const tEntStart = Date.now();
        const entities = await extractEntities(line.text);
        const fresh = entities.filter((e) => !seenEntities.has(e));
        for (const e of fresh) seenEntities.add(e);
        const tEntEnd = Date.now();

        if (fresh.length > 0 && isGeminiEnabled()) {
          const tHintStart = Date.now();
          const meeting = await meetingsRepo.get(id);
          const hint = await generateHint({
            meetingGoal: meeting?.goal ?? "",
            contextSummary: "",
            rollingTranscript: rollingTranscript.slice(-ROLLING_WINDOW),
            newEntities: fresh,
          });
          const tHintEnd = Date.now();
          if (hint) send({ type: "hint", hint });
          app.log.info(
            {
              meetingId: id,
              hintLatencyMs: tHintEnd - tFinal,
              entityLatencyMs: tEntEnd - tEntStart,
              hintLlmMs: tHintEnd - tHintStart,
              freshEntityCount: fresh.length,
              hinted: !!hint,
            },
            "hint pipeline timing",
          );
        }
      }

      function startRealPipeline() {
        if (started) return;
        started = true;
        scheduleStartedAt = Date.now();

        // Legacy WS path — single-stream tab audio, labeled "client". The
        // production flow uses HTTP + Firestore (audio-session.service.ts).
        stt = openSttSession(id, "client", {
          onPartial: (line: TranscriptLine) => send({ type: "transcript-partial", line }),
          onFinal: (line: TranscriptLine) => {
            void handleFinalLine(line);
          },
          onError: (err: Error) => {
            app.log.error({ err }, "STT error");
            send({ type: "error", code: "stt-error", message: err.message, recoverable: true });
          },
        });

        sentimentTick = setInterval(async () => {
          if (muted) return;
          const window = rollingTranscript
            .slice(-ROLLING_WINDOW)
            .map((l) => l.text)
            .join(" ");
          const cls = await classifySentiment(window);
          const at = Math.floor((Date.now() - scheduleStartedAt) / SENTIMENT_TICK_MS);
          send({
            type: "sentiment",
            sample: cls.label
              ? { at, value: cls.value, event: { at, label: cls.label, kind: cls.kind } }
              : { at, value: cls.value },
          });
        }, SENTIMENT_TICK_MS);

        app.log.info({ meetingId: id, mode: "real" }, "real-time pipeline started");
      }

      socket.on("message", (raw: Buffer, isBinary: boolean) => {
        if (isBinary) {
          if (!muted && stt) stt.pushAudio(raw);
          return;
        }

        let parsed: ClientWsMessage;
        try {
          parsed = JSON.parse(raw.toString()) as ClientWsMessage;
        } catch {
          send({ type: "error", code: "bad-json", message: "invalid frame", recoverable: true });
          return;
        }

        switch (parsed.type) {
          case "hello":
            send({
              type: "ready",
              sttSessionId: `stt-${id}-${Date.now()}`,
              serverTimeMs: Date.now(),
            });
            if (isSttEnabled()) startRealPipeline();
            else startCannedReplay();
            break;
          case "ping":
            send({ type: "pong", ts: parsed.ts, latencyMs: Date.now() - parsed.ts });
            break;
          case "mute":
            muted = parsed.muted;
            app.log.info(
              { meetingId: id, muted, sinceMs: Date.now() - scheduleStartedAt },
              "mute toggled",
            );
            break;
          case "mark-hint-acted":
            app.log.info(
              { meetingId: id, hintId: parsed.hintId, useful: parsed.useful },
              "hint feedback received",
            );
            break;
          case "private-note":
            app.log.info({ meetingId: id, t: parsed.t }, "private note received");
            break;
          case "language":
            app.log.info({ meetingId: id, lang: parsed.lang }, "language switch requested");
            break;
          case "bye":
            send({ type: "closed", reason: parsed.reason });
            clearTimers();
            socket.close(1000, parsed.reason);
            break;
          default:
            break;
        }
      });

      socket.on("close", () => {
        clearTimers();
        app.log.info({ meetingId: id }, "ws closed");
      });
    },
  );

  app.log.info(`ws subprotocol expected: ${WS_SUBPROTOCOL}`);
  app.log.info(
    `pipeline mode: ${isSttEnabled() ? "real (STT V2 + Vertex Gemini)" : "canned-replay (no GCP_PROJECT_ID)"}`,
  );
}
