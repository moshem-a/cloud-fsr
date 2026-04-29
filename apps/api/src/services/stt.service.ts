import { GoogleGenAI, Modality, type Session } from "@google/genai";
import type { TranscriptLine } from "@scoach/types";
import { randomUUID } from "node:crypto";

import { isFirestoreEnabled } from "../repos/firestore.ts";

/**
 * Streaming transcription via Gemini Live (replaces Cloud Speech V2 Chirp 3).
 *
 * We hold a per-meeting Live WebSocket session. Audio frames pushed by the
 * HTTP /audio uploader are base64-encoded LINEAR16 16 kHz mono PCM, sent via
 * `sendRealtimeInput`. Gemini emits incremental `inputTranscription` events
 * which we surface as partials; the `finished: true` flag turns into a final
 * line for downstream entity-extraction + hint generation.
 *
 * Gracefully degrades to a no-op when no GCP project is configured —
 * the canned-replay path stays in charge in that case.
 */

export interface SttSession {
  /** Push a PCM frame (16-bit mono 16 kHz) into the streaming recognizer. */
  pushAudio(pcm: Buffer): void;
  /** Cleanly close the upstream STT session. */
  close(): void;
}

export interface SttCallbacks {
  onPartial?: (line: TranscriptLine) => void;
  onFinal?: (line: TranscriptLine) => void;
  onError?: (err: Error) => void;
}

export function isSttEnabled(): boolean {
  return Boolean(process.env.GCP_PROJECT_ID || isFirestoreEnabled());
}

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (_client) return _client;
  _client = new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID,
    location: process.env.VERTEX_REGION ?? "us-central1",
  });
  return _client;
}

// Vertex AI Gemini Live (GA, released Dec 2025). The older preview IDs
// (`gemini-2.0-flash-live-preview-04-09`, `gemini-live-2.5-flash-preview-…`)
// are deprecated and may not be enabled on the project. Override via env if
// a newer build is published.
const LIVE_MODEL = process.env.LIVE_MODEL ?? "gemini-live-2.5-flash-native-audio";

export function openSttSession(meetingId: string, cb: SttCallbacks): SttSession {
  if (!isSttEnabled()) {
    return {
      pushAudio: () => {
        /* noop — canned-replay handles the fixture timeline */
      },
      close: () => {
        /* noop */
      },
    };
  }

  // Buffer audio frames until the WS handshake completes; flush in order
  // once the session is open. Gemini Live tolerates ordered backfill.
  const pending: Buffer[] = [];
  let session: Session | null = null;
  let opened = false;
  let closed = false;
  const startedAt = Date.now();
  let partialBuffer = "";
  let frameCount = 0;

  function flushPending() {
    if (!session || !opened) return;
    while (pending.length > 0) {
      const buf = pending.shift()!;
      writeAudio(buf);
    }
  }

  function writeAudio(pcm: Buffer) {
    if (!session) return;
    try {
      session.sendRealtimeInput({
        audio: {
          data: pcm.toString("base64"),
          mimeType: "audio/pcm;rate=16000",
        },
      });
    } catch (err) {
      cb.onError?.(err as Error);
    }
  }

  function emitFinal(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const sec = Math.floor((Date.now() - startedAt) / 1000);
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    const line: TranscriptLine = {
      id: randomUUID(),
      t: `${m}:${s}`,
      // Gemini Live's input transcription does not yet expose per-speaker
      // diarization. Treat all input as the rep's audio side; if the user is
      // sharing a Meet tab, the client's voice is also in the same channel —
      // we'll add diarization on top when Live exposes it.
      speaker: "rep",
      name: "You",
      lang: detectLang(trimmed),
      text: trimmed,
      isFinal: true,
    };
    console.log(`[stt] meeting=${meetingId} FINAL lang=${line.lang} text="${trimmed.slice(0, 80)}"`);
    cb.onFinal?.(line);
  }

  function emitPartial(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const sec = Math.floor((Date.now() - startedAt) / 1000);
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    const line: TranscriptLine = {
      id: `partial-${meetingId}`,
      t: `${m}:${s}`,
      speaker: "rep",
      name: "You",
      lang: detectLang(trimmed),
      text: trimmed,
      isFinal: false,
    };
    cb.onPartial?.(line);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Live message shape varies by SDK build
  function handleMessage(msg: any) {
    const sc = msg?.serverContent;
    if (!sc) return;
    const it = sc.inputTranscription;
    if (it?.text) {
      partialBuffer += it.text;
      if (it.finished) {
        emitFinal(partialBuffer);
        partialBuffer = "";
      } else {
        emitPartial(partialBuffer);
      }
    }
    // turnComplete flushes any residual partial as a final.
    if (sc.turnComplete && partialBuffer) {
      emitFinal(partialBuffer);
      partialBuffer = "";
    }
  }

  // Open the live session. Buffered audio flushes once the WS is up.
  // The native-audio Live model REQUIRES responseModalities: [AUDIO]; sending
  // [TEXT] returns "Text output is not supported for native audio output
  // model." We don't care about the model's audio output — we discard it and
  // only consume `inputAudioTranscription` events for the transcript.
  void getClient()
    .live.connect({
      model: LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        // Disable VAD/auto-response so the model doesn't try to "reply" to
        // every audio chunk — we want pure transcription, not a chat.
        realtimeInputConfig: {
          automaticActivityDetection: { disabled: true },
        },
      } as never,
      callbacks: {
        onopen: () => {
          opened = true;
          console.log(`[stt] gemini-live opened meeting=${meetingId} model=${LIVE_MODEL}`);
          flushPending();
        },
        onmessage: handleMessage,
        // biome-ignore lint/suspicious/noExplicitAny: WS event shapes vary by runtime
        onerror: (e: any) => {
          const err = (e?.error ?? new Error(e?.message ?? "live error")) as Error;
          console.error(`[stt] gemini-live error meeting=${meetingId}:`, err.message);
          cb.onError?.(err);
        },
        // biome-ignore lint/suspicious/noExplicitAny: WS event shapes vary by runtime
        onclose: (e: any) => {
          if (!closed) {
            console.warn(`[stt] gemini-live closed meeting=${meetingId} reason="${e?.reason ?? ""}"`);
            cb.onError?.(new Error(`live session closed: ${e?.reason ?? "unknown"}`));
          }
        },
      },
    })
    .then((s) => {
      session = s;
      // If onopen already fired before this resolved, flush now.
      if (opened) flushPending();
    })
    .catch((err: Error) => {
      console.error(`[stt] gemini-live connect failed meeting=${meetingId}:`, err.message);
      cb.onError?.(err);
    });

  return {
    pushAudio(pcm) {
      if (closed) return;
      frameCount++;
      if (frameCount % 20 === 1) {
        console.log(`[stt] meeting=${meetingId} pushed audio batch=${frameCount} bytes=${pcm.length}`);
      }
      if (!session || !opened) {
        pending.push(pcm);
        // Cap the pre-handshake buffer at ~10 s of audio so a hung handshake
        // doesn't grow memory unboundedly.
        while (pending.length > 100) pending.shift();
        return;
      }
      writeAudio(pcm);
    },
    close() {
      closed = true;
      try {
        session?.close();
      } catch {
        /* noop */
      }
    },
  };
}

function detectLang(text: string): TranscriptLine["lang"] {
  // Hebrew block: U+0590..U+05FF. If any Hebrew letter present, call it `he`.
  return /[֐-׿]/.test(text) ? "he" : "en";
}
