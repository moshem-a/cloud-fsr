import type { Hint, TranscriptLine } from "@scoach/types";

import { meetingsRepo } from "../repos/meetings.repo.ts";
import { liveRepo } from "../repos/live.repo.ts";
import {
  classifySentiment,
  extractEntities,
  generateHint,
  isGeminiEnabled,
} from "./gemini.service.ts";
import { isSttEnabled, openSttSession, type SttSession } from "./stt.service.ts";

/**
 * Per-meeting audio session manager.
 *
 * Holds an open Cloud STT V2 streaming session per active meeting in process
 * memory. Cloud Run session affinity (already enabled) keeps subsequent audio
 * POSTs from the same client landing on the same instance, so the STT session
 * stays warm across HTTP requests.
 *
 * When STT returns a final transcript line:
 *   1. Write it to Firestore meetings/:id/transcript/{lineId}.
 *   2. Run entity extraction. New entities trigger Vertex Gemini hint gen.
 *   3. Write hint to Firestore meetings/:id/hints/{hintId}.
 *
 * Periodic sentiment classification writes to meetings/:id/sentiment/{at}.
 */

const SENTIMENT_TICK_MS = 10_000;
const ROLLING_WINDOW = 12;
// Sessions are evicted after this much idle time (no audio frames received).
// Cloud Run instances cycle on inactivity; tune separately.
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

interface ActiveSession {
  meetingId: string;
  stt: SttSession;
  rollingTranscript: TranscriptLine[];
  seenEntities: Set<string>;
  sentimentTick: NodeJS.Timeout | null;
  lastActivityAt: number;
  scheduleStartedAt: number;
  lastReopenAt: number;
  permanentlyFailed: boolean;
}

const sessions = new Map<string, ActiveSession>();

function evictIdle() {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastActivityAt > IDLE_TIMEOUT_MS) {
      stopSession(id);
    }
  }
}
setInterval(evictIdle, 60_000).unref();

export function getOrCreateSession(meetingId: string): ActiveSession {
  let s = sessions.get(meetingId);
  if (s) {
    s.lastActivityAt = Date.now();
    return s;
  }

  const session: ActiveSession = {
    meetingId,
    stt: null as unknown as SttSession, // assigned below
    rollingTranscript: [],
    seenEntities: new Set(),
    sentimentTick: null,
    lastActivityAt: Date.now(),
    scheduleStartedAt: Date.now(),
    lastReopenAt: 0,
    permanentlyFailed: false,
  };

  if (isSttEnabled()) {
    // Clear any stale error banner from a previous failed attempt on this
    // meeting (e.g. before the latest deploy that fixed the config).
    void liveRepo.writeLiveState(meetingId, { sttError: "" }).catch(() => {});

    const openStream = () => openSttSession(meetingId, {
      onPartial: () => {
        // Sprint 6: write to a separate "partial" doc that overwrites itself.
      },
      onFinal: (line) => {
        void handleFinalLine(session, line);
      },
      onError: (err) => {
        // Once flagged permanently dead, swallow every subsequent error event
        // (including the cascade of "write after stream destroyed" from
        // in-flight audio frames). No reopens, no log spam.
        if (session.permanentlyFailed) return;
        console.warn(`[audio-session] STT error for ${meetingId}:`, err.message);
        if (/INVALID_ARGUMENT|PERMISSION_DENIED|NOT_FOUND|UNAUTHENTICATED/.test(err.message)) {
          session.permanentlyFailed = true;
          session.lastReopenAt = Date.now(); // gate the evict-and-recreate retry window
          console.error(`[audio-session] STT permanently failed for ${meetingId}, not reopening: ${err.message}`);
          void liveRepo.writeLiveState(meetingId, { sttError: err.message }).catch(() => {});
          return;
        }
        // Transient: auto-reopen, throttled to once per 2s.
        const now = Date.now();
        if (now - session.lastReopenAt < 2_000) return;
        session.lastReopenAt = now;
        try {
          session.stt = openStream();
          console.log(`[audio-session] reopened STT stream for ${meetingId}`);
        } catch (e) {
          console.warn(`[audio-session] failed to reopen STT for ${meetingId}:`, (e as Error).message);
        }
      },
    });
    session.stt = openStream();
  } else {
    // Stub session: no real STT, no callbacks. Audio is dropped.
    session.stt = {
      pushAudio: () => {},
      close: () => {},
    };
  }

  // Sentiment loop
  if (isGeminiEnabled()) {
    session.sentimentTick = setInterval(() => {
      void runSentimentTick(session);
    }, SENTIMENT_TICK_MS);
  }

  sessions.set(meetingId, session);
  return session;
}

export function stopSession(meetingId: string): void {
  const s = sessions.get(meetingId);
  if (!s) return;
  if (s.sentimentTick) clearInterval(s.sentimentTick);
  try {
    s.stt.close();
  } catch {
    /* noop */
  }
  sessions.delete(meetingId);
}

export function pushAudio(meetingId: string, pcm: Buffer): void {
  let s = getOrCreateSession(meetingId);
  if (s.permanentlyFailed) {
    // Evict and recreate so a deploy that fixes the underlying issue heals
    // automatically. Throttled to once per 30 s to avoid hot-looping when
    // the failure mode persists across the deploy.
    const sinceFail = Date.now() - s.lastReopenAt;
    if (sinceFail < 30_000) return;
    console.log(`[audio-session] evicting failed session for ${meetingId}, recreating`);
    stopSession(meetingId);
    void liveRepo.writeLiveState(meetingId, { sttError: "" }).catch(() => {});
    s = getOrCreateSession(meetingId);
  }
  s.stt.pushAudio(pcm);
}

async function handleFinalLine(session: ActiveSession, line: TranscriptLine): Promise<void> {
  const tFinal = Date.now();
  session.rollingTranscript.push(line);
  // 1. Persist transcript line
  await liveRepo.writeTranscript(session.meetingId, line);

  // 2. Entity extraction
  const tEntStart = Date.now();
  const entities = await extractEntities(line.text);
  const fresh = entities.filter((e) => !session.seenEntities.has(e));
  for (const e of fresh) session.seenEntities.add(e);
  const tEntEnd = Date.now();

  // 3. Hint generation if new entities and Gemini enabled
  if (fresh.length > 0 && isGeminiEnabled()) {
    const tHintStart = Date.now();
    const meeting = await meetingsRepo.get(session.meetingId);
    const hint: Hint | null = await generateHint({
      meetingGoal: meeting?.goal ?? "",
      contextSummary: "",
      rollingTranscript: session.rollingTranscript.slice(-ROLLING_WINDOW),
      newEntities: fresh,
    });
    const tHintEnd = Date.now();
    if (hint) {
      await liveRepo.writeHint(session.meetingId, hint);
    }
    console.log(
      `[audio-session] meeting=${session.meetingId} hintLatency=${
        tHintEnd - tFinal
      }ms entityLatency=${tEntEnd - tEntStart}ms hintLlm=${
        tHintEnd - tHintStart
      }ms freshEntities=${fresh.length} hinted=${!!hint}`,
    );
  }
}

async function runSentimentTick(session: ActiveSession): Promise<void> {
  const window = session.rollingTranscript
    .slice(-ROLLING_WINDOW)
    .map((l) => l.text)
    .join(" ");
  if (!window) return;
  const cls = await classifySentiment(window);
  const at = Math.floor((Date.now() - session.scheduleStartedAt) / SENTIMENT_TICK_MS);
  await liveRepo.writeSentiment(session.meetingId, {
    at,
    value: cls.value,
    ...(cls.label ? { event: { at, label: cls.label, kind: cls.kind } } : {}),
  });
}
