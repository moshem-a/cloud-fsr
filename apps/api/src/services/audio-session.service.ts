import type { Hint, Participant, TranscriptLine } from "@scoach/types";
import { randomUUID } from "node:crypto";

import { getDb, isFirestoreEnabled } from "../repos/firestore.ts";
import { meetingsRepo } from "../repos/meetings.repo.ts";
import { liveRepo } from "../repos/live.repo.ts";
import { summaryRepo } from "../repos/summary.repo.ts";
import {
  analyzeScreenFrame,
  classifySentiment,
  detectLang,
  extractActionItem,
  extractMeetInfo,
  generateFollowups,
  generateHint,
  generateInfographic,
  generateLiveTip,
  generateMeetingName,
  generateQuickAnswer,
  hasActionItemPattern,
  isGeminiEnabled,
  regexEntities,
} from "./gemini.service.ts";
import { classifyMeetingType, generateMeetingSummary } from "./summary.service.ts";
import { isSttEnabled, openSttSession, type SpeakerRole, type SttSession } from "./stt.service.ts";

export type { SpeakerRole };

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

const SENTIMENT_TICK_MS = 20_000;
const FOLLOWUPS_TICK_MS = 60_000;
const TIPS_TICK_MS = 25_000;
const INFOGRAPHIC_TICK_MS = 20_000;
const SUMMARY_TICK_MS = 4 * 60 * 1000;
const ROLLING_WINDOW = 12;
// Hint heuristic: fire a hint cycle on every final transcript line. Dedup via
// recentHintTitles prevents flooding. Time gate (HINT_TIME_MS) still applies.
const HINT_FINAL_BATCH = 1;
const HINT_TIME_MS = 10_000;
// Immediate-fire patterns: competitor mentions + comparison-style questions.
// When matched in a final transcript line, fire a hint cycle right away with
// priority="high" so the UI surfaces a comparison card the rep can use.
// English-only: competitor product names stay English even in Hebrew calls.
const HIGH_PRIORITY_REGEX = /\b(Bedrock|SageMaker|Snowflake|Databricks|OpenAI|Anthropic\s+direct|Azure\s+OpenAI|AKS|EKS|Athena|Redshift|how\s+does|what\s+about|compared?\s+to|versus|\bvs\.?\b|why\s+(not|should)|difference\s+between|too\s+expensive|not\s+sure|concerned|worried|problem\s+with|won't\s+work|can't\s+afford|not\s+in\s+budget|we're\s+happy\s+with|already\s+using|no\s+need|not\s+interested|יקר\s+מדי|לא\s+בטוח|בעיה\s+עם|לא\s+צריך)\b/i;
// Sessions are evicted after this much idle time (no audio frames received).
// Cloud Run instances cycle on inactivity; tune separately.
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

interface ActiveSession {
  meetingId: string;
  cachedGoal: string;
  // Two STT streams per meeting — one for mic (rep), one for tab (client).
  stt: { rep: SttSession; client: SttSession };
  // Per-stream reopen + failure state. Each stream can fail independently.
  lastReopenAt: { rep: number; client: number };
  permanentlyFailed: { rep: boolean; client: boolean };
  rollingTranscript: TranscriptLine[];
  seenEntities: Set<string>;
  sentimentTick: NodeJS.Timeout | null;
  followupsTick: NodeJS.Timeout | null;
  tipsTick: NodeJS.Timeout | null;
  recentTips: string[];
  lastActivityAt: number;
  scheduleStartedAt: number;
  // Hint trigger state
  finalsSinceLastHint: number;
  lastHintAt: number;
  hintInFlight: boolean;
  recentHintTitles: string[];
  // Partial write throttle
  lastPartialWriteAt: number;
  // Quick answer debounce
  lastQuickAnswerAt: number;
  // Action item debounce (covers both rep commitments and client requests)
  lastActionItemAt: number;
  // Participant tracking — collects unique speakers from transcript
  seenSpeakers: Map<string, { side: "client" | "rep" }>;
  lastParticipantPatchAt: number;
  // Infographic generation
  infographicTick: NodeJS.Timeout | null;
  lastInfographicAt: number;
  infographicInFlight: boolean;
  linesAtLastInfographic: number;
  // Rolling summary
  summaryTick: NodeJS.Timeout | null;
  lastSummaryAt: number;
  summaryInFlight: boolean;
  // Google Meet screen detection
  meetInfoExtracted: boolean;
}

const NOOP_STT: SttSession = { pushAudio: () => {}, close: () => {} };

const sessions = new Map<string, ActiveSession>();

async function evictIdle() {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastActivityAt > IDLE_TIMEOUT_MS) {
      console.log(`[audio-session] idle-evicting meeting=${id}, finalizing summary`);
      await runRollingSummary(s).catch((err) =>
        console.warn(`[audio-session] final summary failed for ${id}: ${(err as Error).message}`),
      );
      const m = await meetingsRepo.get(id).catch(() => null);
      if (m) {
        const latest = await summaryRepo.get(id).catch(() => null);
        if (latest) {
          const meetingType = classifyMeetingType(latest.internal, m);
          await meetingsRepo.patch(id, { status: "summarized", meetingType, endedAt: new Date().toISOString() }).catch(() => {});
        } else {
          await meetingsRepo.patch(id, { status: "ended", endedAt: new Date().toISOString() }).catch(() => {});
        }
      }
      stopSession(id);
    }
  }
}
setInterval(() => void evictIdle(), 60_000).unref();

export function getOrCreateSession(meetingId: string): ActiveSession {
  let s = sessions.get(meetingId);
  if (s) {
    s.lastActivityAt = Date.now();
    return s;
  }

  const session: ActiveSession = {
    meetingId,
    cachedGoal: "",
    stt: { rep: NOOP_STT, client: NOOP_STT },
    lastReopenAt: { rep: 0, client: 0 },
    permanentlyFailed: { rep: false, client: false },
    rollingTranscript: [],
    seenEntities: new Set(),
    sentimentTick: null,
    followupsTick: null,
    tipsTick: null,
    recentTips: [],
    lastActivityAt: Date.now(),
    scheduleStartedAt: Date.now(),
    finalsSinceLastHint: 0,
    lastHintAt: 0,
    hintInFlight: false,
    recentHintTitles: [],
    lastPartialWriteAt: 0,
    lastQuickAnswerAt: 0,
    lastActionItemAt: 0,
    seenSpeakers: new Map(),
    lastParticipantPatchAt: 0,
    infographicTick: null,
    lastInfographicAt: 0,
    infographicInFlight: false,
    linesAtLastInfographic: 0,
    summaryTick: null,
    lastSummaryAt: 0,
    summaryInFlight: false,
    meetInfoExtracted: false,
  };

  // Cache meeting goal once — avoids a Firestore read on every hint/tip/answer cycle.
  void meetingsRepo.get(meetingId).then((m) => {
    session.cachedGoal = m?.goal ?? "";
  }).catch(() => {});

  if (isSttEnabled()) {
    // Clear any stale error banner from a previous failed attempt on this
    // meeting (e.g. before the latest deploy that fixed the config).
    void liveRepo.writeLiveState(meetingId, { sttError: "" }).catch(() => {});

    const openStream = (role: SpeakerRole): SttSession =>
      openSttSession(meetingId, role, {
        onPartial: (line) => {
          // Throttled write to a single overwrite-self doc so the FE can show
          // the live speculative text. Throttle is per-meeting (shared across
          // both sources) — the most recent partial wins, regardless of who.
          const now = Date.now();
          if (now - session.lastPartialWriteAt < 400) return;
          session.lastPartialWriteAt = now;
          void liveRepo.writePartial(meetingId, line).catch((err) => {
            console.warn(`[audio-session] writePartial failed: ${(err as Error).message}`);
          });
        },
        onFinal: (line) => {
          // Clear the live partial doc — the final has landed in the transcript
          // collection and the partial is now stale.
          void liveRepo.clearPartial(meetingId).catch(() => {});
          void handleFinalLine(session, line);
        },
        onError: (err) => {
          if (session.permanentlyFailed[role]) return;
          console.warn(`[audio-session] STT error for ${meetingId} (${role}):`, err.message);
          if (/INVALID_ARGUMENT|PERMISSION_DENIED|NOT_FOUND|UNAUTHENTICATED/.test(err.message)) {
            session.permanentlyFailed[role] = true;
            session.lastReopenAt[role] = Date.now();
            console.error(
              `[audio-session] STT permanently failed for ${meetingId} (${role}), not reopening: ${err.message}`,
            );
            // Surface only if BOTH streams are dead — one stream still working
            // is enough to use the meeting. (Mic-denied users still see client.)
            if (session.permanentlyFailed.rep && session.permanentlyFailed.client) {
              void liveRepo
                .writeLiveState(meetingId, { sttError: err.message })
                .catch(() => {});
            }
            return;
          }
          // Transient: auto-reopen this stream only, throttled to once per 2s.
          const now = Date.now();
          if (now - session.lastReopenAt[role] < 2_000) return;
          session.lastReopenAt[role] = now;
          try {
            session.stt[role] = openStream(role);
            console.log(`[audio-session] reopened STT stream for ${meetingId} (${role})`);
          } catch (e) {
            console.warn(
              `[audio-session] failed to reopen STT for ${meetingId} (${role}):`,
              (e as Error).message,
            );
          }
        },
      });

    session.stt = {
      rep: openStream("rep"),
      client: openStream("client"),
    };
  }

  // Sentiment + Followups loops (Gemini-backed)
  if (isGeminiEnabled()) {
    session.sentimentTick = setInterval(() => {
      void runSentimentTick(session);
    }, SENTIMENT_TICK_MS);
    session.followupsTick = setInterval(() => {
      void runFollowupsTick(session);
    }, FOLLOWUPS_TICK_MS);
    session.tipsTick = setInterval(() => {
      void runTipsTick(session);
    }, TIPS_TICK_MS);
    session.infographicTick = setInterval(() => {
      void runInfographicTick(session);
    }, INFOGRAPHIC_TICK_MS);
    session.summaryTick = setInterval(() => {
      void runRollingSummary(session);
    }, SUMMARY_TICK_MS);
    console.log(`[audio-session] started sentiment+followups+tips+infographic+summary timers for ${meetingId}`);
  } else {
    console.warn(`[audio-session] Gemini disabled (no GCP_PROJECT_ID), skipping hint/sentiment/followups for ${meetingId}`);
  }

  sessions.set(meetingId, session);
  return session;
}

export function stopSession(meetingId: string): void {
  const s = sessions.get(meetingId);
  if (!s) return;
  if (s.sentimentTick) clearInterval(s.sentimentTick);
  if (s.followupsTick) clearInterval(s.followupsTick);
  if (s.tipsTick) clearInterval(s.tipsTick);
  if (s.infographicTick) clearInterval(s.infographicTick);
  if (s.summaryTick) clearInterval(s.summaryTick);
  void patchParticipants(s).catch(() => {});
  for (const role of ["rep", "client"] as const) {
    try {
      s.stt[role].close();
    } catch {
      /* noop */
    }
  }
  sessions.delete(meetingId);
}

export function pushAudio(meetingId: string, role: SpeakerRole, pcm: Buffer): void {
  let s = getOrCreateSession(meetingId);
  if (s.permanentlyFailed[role]) {
    // Evict and recreate ONLY this stream after a 30s cooldown — the other
    // stream might still be healthy, so we leave it alone.
    const sinceFail = Date.now() - s.lastReopenAt[role];
    if (sinceFail < 30_000) return;
    console.log(`[audio-session] evicting failed ${role} stream for ${meetingId}, recreating`);
    try {
      s.stt[role].close();
    } catch {
      /* noop */
    }
    s.permanentlyFailed[role] = false;
    s.lastReopenAt[role] = Date.now();
    // If both were dead before, clear the FE error banner.
    if (!s.permanentlyFailed.rep && !s.permanentlyFailed.client) {
      void liveRepo.writeLiveState(meetingId, { sttError: "" }).catch(() => {});
    }
    s.stt[role] = openSttSession(meetingId, role, {
      onPartial: (line) => {
        const now = Date.now();
        if (now - s.lastPartialWriteAt < 400) return;
        s.lastPartialWriteAt = now;
        void liveRepo.writePartial(meetingId, line).catch(() => {});
      },
      onFinal: (line) => {
        void liveRepo.clearPartial(meetingId).catch(() => {});
        void handleFinalLine(s, line);
      },
      onError: (err) => {
        console.warn(`[audio-session] STT error for ${meetingId} (${role}) after recreate:`, err.message);
      },
    });
  }
  s.stt[role].pushAudio(pcm);
}

export async function handleFinalLine(session: ActiveSession, line: TranscriptLine): Promise<void> {
  session.rollingTranscript.push(line);
  // 1. Persist transcript line
  await liveRepo.writeTranscript(session.meetingId, line);

  // 2. Entity extraction — regex-only for speed (no Gemini call).
  for (const e of regexEntities(line.text)) session.seenEntities.add(e);

  // 2b. Track participant names from transcript speaker labels.
  if (line.name && !session.seenSpeakers.has(line.name)) {
    session.seenSpeakers.set(line.name, { side: line.speaker });
    const now = Date.now();
    if (now - session.lastParticipantPatchAt > 30_000) {
      session.lastParticipantPatchAt = now;
      void patchParticipants(session).catch(() => {});
    }
  }

  // 3. Hint generation — fires immediately on competitor/comparison signals,
  // or after every HINT_FINAL_BATCH transcripts OR HINT_TIME_MS elapsed.
  session.finalsSinceLastHint += 1;
  const sinceLastHint = Date.now() - session.lastHintAt;
  const highPriority = HIGH_PRIORITY_REGEX.test(line.text);
  const shouldHint =
    isGeminiEnabled() &&
    !session.hintInFlight &&
    (highPriority || session.rollingTranscript.length >= 2) &&
    (highPriority || session.finalsSinceLastHint >= HINT_FINAL_BATCH || sinceLastHint >= HINT_TIME_MS);
  if (shouldHint) {
    session.hintInFlight = true;
    session.finalsSinceLastHint = 0;
    session.lastHintAt = Date.now();
    void runHintCycle(session, highPriority ? "high" : "normal").finally(() => {
      session.hintInFlight = false;
    });

    // 3b. Infographic — piggyback on the exact same trigger as hints.
    if (!session.infographicInFlight) {
      void runInfographicTick(session);
    }
  }

  // 4. Quick answer — when the client asks a question, generate an instant answer
  if (line.speaker === "client" && isQuestionLine(line.text) && isGeminiEnabled()) {
    void generateAndWriteQuickAnswer(session, line).catch(() => {});
  }

  // 5. Auto-note — detect action items from BOTH speakers (rep commitments + client requests)
  if (hasActionItemPattern(line.text) && isGeminiEnabled()) {
    void detectAndWriteActionItem(session, line).catch(() => {});
  }

  // 6. Auto-detect meeting name after ~5 transcript lines (skip if already extracted from Google Meet screen)
  if (session.rollingTranscript.length === 5 && isGeminiEnabled() && !session.meetInfoExtracted) {
    void (async () => {
      const m = await meetingsRepo.get(session.meetingId).catch(() => null);
      if (m && (!m.title || m.title === "New Meeting" || m.title.startsWith("Meeting with"))) {
        const name = await generateMeetingName(session.rollingTranscript).catch(() => null);
        if (name) {
          await meetingsRepo.patch(session.meetingId, { title: name }).catch(() => {});
          console.log(`[audio-session] auto-named meeting=${session.meetingId} title="${name}"`);
        }
      }
    })();
  }
}

const PARTICIPANT_COLORS = ["#EA4335", "#F9AB00", "#1A73E8", "#34A853", "#A142F4", "#E8710A"];

async function patchParticipants(session: ActiveSession): Promise<void> {
  const participants: Participant[] = [];
  let i = 0;
  for (const [name, { side }] of session.seenSpeakers) {
    const words = name.split(/\s+/);
    const initials = words.map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2);
    participants.push({
      name,
      role: "",
      side,
      color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length]!,
      initials: initials || "?",
    });
    i++;
  }
  await meetingsRepo.patch(session.meetingId, { participants }).catch(() => {});
}

async function runInfographicTick(session: ActiveSession): Promise<void> {
  if (session.infographicInFlight) return;
  session.infographicInFlight = true;
  const transcriptLen = session.rollingTranscript.length;
  console.log(`[audio-session] infographic tick start meeting=${session.meetingId} transcriptLen=${transcriptLen}`);
  try {
    const ig = await generateInfographic({
      rollingTranscript: session.rollingTranscript,
      meetingGoal: session.cachedGoal,
      meetingTitle: "",
    });
    if (ig) {
      console.log(`[audio-session] infographic generated kind=${ig.kind} title="${ig.title}" meeting=${session.meetingId}`);
      await liveRepo.writeInfographic(session.meetingId, ig);
      session.linesAtLastInfographic = transcriptLen;
      session.lastInfographicAt = Date.now();
    } else {
      console.log(`[audio-session] infographic tick returned null meeting=${session.meetingId}`);
    }
  } catch (err) {
    console.warn(`[audio-session] infographic tick error: ${(err as Error).message}`);
  } finally {
    session.infographicInFlight = false;
  }
}

export async function runRollingSummary(session: ActiveSession): Promise<void> {
  if (session.summaryInFlight) return;
  if (session.rollingTranscript.length < 3) return;
  session.summaryInFlight = true;
  try {
    const m = await meetingsRepo.get(session.meetingId);
    if (!m) return;
    if (!isFirestoreEnabled()) return;
    const snap = await getDb()
      .collection("meetings")
      .doc(session.meetingId)
      .collection("transcript")
      .orderBy("_at", "asc")
      .get();
    const transcript = snap.docs.map((d) => d.data() as TranscriptLine);
    if (transcript.length === 0) return;

    // Auto-detect meeting name if still using default
    if (!m.title || m.title === "New Meeting" || m.title.startsWith("Meeting with")) {
      const autoName = await generateMeetingName(transcript).catch(() => null);
      if (autoName) {
        await meetingsRepo.patch(session.meetingId, { title: autoName }).catch(() => {});
        m.title = autoName;
      }
    }

    const [hintSnap, sentSnap] = await Promise.all([
      getDb().collection("meetings").doc(session.meetingId).collection("hints").get(),
      getDb().collection("meetings").doc(session.meetingId).collection("sentiment").orderBy("at", "asc").get(),
    ]);
    const hintStats = {
      total: hintSnap.size,
      acted: hintSnap.docs.filter((d) => d.data().actedOn).length,
    };
    const sentValues = sentSnap.docs.map((d) => (d.data().value as number) ?? 50);
    const lastKind =
      sentSnap.docs.length > 0
        ? String(sentSnap.docs[sentSnap.docs.length - 1]!.data().event?.kind ?? "neutral")
        : "neutral";

    const summary = await generateMeetingSummary(m, transcript, {
      hintStats,
      sentimentData: { values: sentValues, lastKind },
    });
    await summaryRepo.write(session.meetingId, summary);
    session.lastSummaryAt = Date.now();
    console.log(`[audio-session] rolling summary saved for meeting=${session.meetingId}`);
  } catch (err) {
    console.warn(`[audio-session] rolling summary failed: ${(err as Error).message}`);
  } finally {
    session.summaryInFlight = false;
  }
}

async function runHintCycle(session: ActiveSession, priority: "normal" | "high" = "normal"): Promise<void> {
  const t0 = Date.now();
  try {
    const lang = detectLang(session.rollingTranscript);
    const hint: Hint | null = await generateHint({
      meetingGoal: session.cachedGoal,
      contextSummary: "",
      rollingTranscript: session.rollingTranscript.slice(-ROLLING_WINDOW),
      lang,
      priority,
      recentHintTitles: session.recentHintTitles,
    });
    if (hint) {
      const isDuplicate = session.recentHintTitles.some(
        (t) => t.toLowerCase() === hint.title.toLowerCase(),
      );
      if (!isDuplicate) {
        await liveRepo.writeHint(session.meetingId, hint);
        session.recentHintTitles = [...session.recentHintTitles.slice(-7), hint.title];
      }
    }
    console.log(
      `[audio-session] meeting=${session.meetingId} hintCycle=${Date.now() - t0}ms hinted=${!!hint} priority=${priority} hasCompare=${!!hint?.comparisonTable} transcriptLen=${session.rollingTranscript.length}`,
    );
  } catch (err) {
    console.warn(
      `[audio-session] meeting=${session.meetingId} hint cycle error: ${(err as Error).message}`,
    );
  }
}

// ---------- Question detection + quick answer ----------
const QUESTION_REGEX = /(\?|^(how|what|why|when|where|which|can|could|does|do|is|are|will|would|should|have|has|who|tell\s+me|explain|מה|למה|איך|מתי|איפה|האם|כמה|אילו)\b)/i;

function isQuestionLine(text: string): boolean {
  return QUESTION_REGEX.test(text.trim()) && text.trim().length > 15;
}

async function generateAndWriteQuickAnswer(session: ActiveSession, line: TranscriptLine): Promise<void> {
  const now = Date.now();
  if (now - session.lastQuickAnswerAt < 5_000) return;
  session.lastQuickAnswerAt = now;
  const t0 = Date.now();
  try {
    const lang = detectLang(session.rollingTranscript);
    const hint = await generateQuickAnswer({
      question: line.text,
      rollingTranscript: session.rollingTranscript.slice(-6),
      meetingGoal: session.cachedGoal,
      lang,
    });
    if (hint) {
      await liveRepo.writeHint(session.meetingId, hint);
    }
    console.log(
      `[audio-session] meeting=${session.meetingId} quickAnswer=${Date.now() - t0}ms answered=${!!hint}`,
    );
  } catch (err) {
    console.warn(
      `[audio-session] meeting=${session.meetingId} quickAnswer error: ${(err as Error).message}`,
    );
  }
}

async function detectAndWriteActionItem(session: ActiveSession, line: TranscriptLine): Promise<void> {
  const now = Date.now();
  if (now - session.lastActionItemAt < 8_000) return;
  session.lastActionItemAt = now;
  const t0 = Date.now();
  try {
    const lang = detectLang(session.rollingTranscript);
    const noteText = await extractActionItem(line.text, line.speaker, lang);
    if (noteText) {
      const note = { t: line.t, text: noteText, source: "auto" as const };
      await liveRepo.writeAutoNote(session.meetingId, note);
      void meetingsRepo.get(session.meetingId).then((meeting) => {
        if (meeting) {
          void meetingsRepo.patch(session.meetingId, {
            notes: [...(meeting.notes ?? []), note],
          });
        }
      }).catch(() => {});
    }
    console.log(
      `[audio-session] meeting=${session.meetingId} actionItem=${Date.now() - t0}ms found=${!!noteText} speaker=${line.speaker}`,
    );
  } catch (err) {
    console.warn(
      `[audio-session] meeting=${session.meetingId} actionItem error: ${(err as Error).message}`,
    );
  }
}

async function runSentimentTick(session: ActiveSession): Promise<void> {
  if (session.rollingTranscript.length === 0) return;
  const at = Math.floor((Date.now() - session.scheduleStartedAt) / SENTIMENT_TICK_MS);
  const recent = session.rollingTranscript.slice(-ROLLING_WINDOW);

  // Build per-speaker windows so we can show two sentiment graphs (rep + client).
  // Falls back to the combined window if one side hasn't spoken in this slice.
  const repText = recent.filter((l) => l.speaker === "rep").map((l) => l.text).join(" ");
  const clientText = recent.filter((l) => l.speaker === "client").map((l) => l.text).join(" ");
  const allText = recent.map((l) => l.text).join(" ");

  const t0 = Date.now();
  const tasks: Array<Promise<void>> = [];

  if (allText) {
    tasks.push(classifyAndWrite(session, at, allText, "all"));
  }
  if (repText) {
    tasks.push(classifyAndWrite(session, at, repText, "rep"));
  }
  if (clientText) {
    tasks.push(classifyAndWrite(session, at, clientText, "client"));
  }
  try {
    await Promise.all(tasks);
    console.log(
      `[audio-session] meeting=${session.meetingId} sentiment-tick rep=${!!repText} client=${!!clientText} latency=${Date.now() - t0}ms`,
    );
  } catch (err) {
    console.warn(
      `[audio-session] meeting=${session.meetingId} sentiment tick error: ${(err as Error).message}`,
    );
  }
}

async function classifyAndWrite(
  session: ActiveSession,
  at: number,
  text: string,
  speaker: "rep" | "client" | "all",
): Promise<void> {
  try {
    const cls = await classifySentiment(text);
    await liveRepo.writeSentiment(session.meetingId, {
      at,
      value: cls.value,
      speaker,
      ...(cls.label ? { event: { at, label: cls.label, kind: cls.kind } } : {}),
    });
  } catch (err) {
    console.warn(
      `[audio-session] meeting=${session.meetingId} sentiment(${speaker}) failed: ${(err as Error).message}`,
    );
  }
}

async function runFollowupsTick(session: ActiveSession): Promise<void> {
  if (session.rollingTranscript.length === 0) return;
  const t0 = Date.now();
  try {
    const lang = detectLang(session.rollingTranscript);
    const items = await generateFollowups(session.rollingTranscript, session.cachedGoal, lang);
    if (items.length > 0) {
      await liveRepo.writeFollowups(session.meetingId, items);
    }
    console.log(
      `[audio-session] meeting=${session.meetingId} followups count=${items.length} latency=${Date.now() - t0}ms`,
    );
  } catch (err) {
    console.warn(
      `[audio-session] meeting=${session.meetingId} followups tick error: ${(err as Error).message}`,
    );
  }
}

async function runTipsTick(session: ActiveSession): Promise<void> {
  if (session.rollingTranscript.length < 4) return;
  const t0 = Date.now();
  try {
    const lang = detectLang(session.rollingTranscript);
    const tipText = await generateLiveTip({
      rollingTranscript: session.rollingTranscript.slice(-ROLLING_WINDOW),
      meetingGoal: session.cachedGoal,
      lang,
      existingTips: session.recentTips,
    });
    if (tipText) {
      const tip = { id: randomUUID(), text: tipText, at: Date.now() };
      await liveRepo.writeTip(session.meetingId, tip);
      session.recentTips = [...session.recentTips.slice(-4), tipText];
    }
    console.log(
      `[audio-session] meeting=${session.meetingId} tipsTick=${Date.now() - t0}ms tipped=${!!tipText}`,
    );
  } catch (err) {
    console.warn(
      `[audio-session] meeting=${session.meetingId} tips tick error: ${(err as Error).message}`,
    );
  }
}

// ---------- Screen frame analysis ----------
const screenFrameThrottle = new Map<string, number>();
const SCREEN_FRAME_COOLDOWN_MS = 15_000;
const meetInfoAttempts = new Map<string, number>();
const MAX_MEET_INFO_ATTEMPTS = 3;

export async function pushScreenFrame(meetingId: string, imageBuffer: Buffer): Promise<void> {
  if (!isGeminiEnabled()) return;
  const now = Date.now();
  const lastAt = screenFrameThrottle.get(meetingId) ?? 0;
  if (now - lastAt < SCREEN_FRAME_COOLDOWN_MS) return;
  screenFrameThrottle.set(meetingId, now);

  const session = sessions.get(meetingId);

  // --- Google Meet info extraction (first few frames only) ---
  if (session && !session.meetInfoExtracted) {
    const attempts = meetInfoAttempts.get(meetingId) ?? 0;
    if (attempts < MAX_MEET_INFO_ATTEMPTS) {
      meetInfoAttempts.set(meetingId, attempts + 1);
      try {
        const meetInfo = await extractMeetInfo(imageBuffer);
        if (meetInfo?.isMeet) {
          const patch: Record<string, unknown> = {};
          if (meetInfo.meetingTitle) {
            patch.title = meetInfo.meetingTitle;
          }
          if (meetInfo.participants && meetInfo.participants.length > 0) {
            const participants: Participant[] = meetInfo.participants.map((name, i) => {
              const words = name.split(/\s+/);
              const initials = words.map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2);
              return {
                name,
                role: "",
                side: "client" as const,
                color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length]!,
                initials: initials || "?",
              };
            });
            patch.participants = participants;
            for (const p of meetInfo.participants) {
              if (!session.seenSpeakers.has(p)) {
                session.seenSpeakers.set(p, { side: "client" });
              }
            }
          }
          if (Object.keys(patch).length > 0) {
            await meetingsRepo.patch(meetingId, patch).catch(() => {});
            console.log(
              `[audio-session] meeting=${meetingId} extracted meet info: title="${meetInfo.meetingTitle}" participants=${meetInfo.participants?.length ?? 0}`,
            );
          }
          session.meetInfoExtracted = true;
        } else if (meetInfo && !meetInfo.isMeet) {
          session.meetInfoExtracted = true;
        }
      } catch (err) {
        console.warn(
          `[audio-session] meeting=${meetingId} extractMeetInfo error: ${(err as Error).message}`,
        );
      }
    } else {
      session.meetInfoExtracted = true;
    }
  }

  // --- Screen content analysis (always runs) ---
  const t0 = Date.now();
  try {
    const result = await analyzeScreenFrame(imageBuffer);
    if (!result) return;

    const allFindings = [
      ...result.findings,
      ...result.products.map((p) => `Product: ${p}`),
      ...result.competitors.map((c) => `Competitor: ${c}`),
      ...result.pricing.map((p) => `Pricing: ${p}`),
    ];
    if (allFindings.length === 0) return;

    const hint: Hint = {
      id: randomUUID(),
      title: "Screen insight",
      category: result.competitors.length > 0 ? "Competitive" : "Problem→Solution",
      color: result.competitors.length > 0 ? "blue" : "green",
      summary: allFindings.slice(0, 3).join(". "),
      proofPoints: allFindings.slice(0, 5),
      sources: ["screen-share"],
      confidence: 0.8,
      timestamp: session?.rollingTranscript[session.rollingTranscript.length - 1]?.t ?? "00:00",
    };
    await liveRepo.writeHint(meetingId, hint);
    console.log(
      `[audio-session] meeting=${meetingId} screenFrame=${Date.now() - t0}ms findings=${allFindings.length}`,
    );
  } catch (err) {
    console.warn(
      `[audio-session] meeting=${meetingId} screenFrame error: ${(err as Error).message}`,
    );
  }
}
