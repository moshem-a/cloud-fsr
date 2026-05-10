import { v2 as speechV2 } from "@google-cloud/speech";
import type { TranscriptLine } from "@scoach/types";
import { randomUUID } from "node:crypto";
import type { Writable } from "node:stream";

import { isFirestoreEnabled } from "../repos/firestore.ts";

/**
 * Streaming transcription via Cloud Speech-to-Text V2 with `chirp_2`.
 *
 * Why this model:
 *   - chirp_2 is a real streaming ASR model available in regional locations
 *     including `us-central1`. (chirp_3 only exists in `us`/`eu` multi-regions.)
 *   - Supports Hebrew (iw-IL) + English (en-US) bilingual auto-detection.
 *
 * Why not Gemini Live: it's a conversational model. Its `inputAudioTranscription`
 * field exists but the model only emits transcription events when it's actively
 * "listening" in a conversational context — continuously streamed, non-conversational
 * audio gets silently dropped.
 *
 * Gracefully degrades to a no-op when no GCP project is configured.
 */

export interface SttSession {
  pushAudio(pcm: Buffer): void;
  close(): void;
}

export type SpeakerRole = "rep" | "client";

export interface SttCallbacks {
  onPartial?: (line: TranscriptLine) => void;
  onFinal?: (line: TranscriptLine) => void;
  onError?: (err: Error) => void;
}

export function isSttEnabled(): boolean {
  return Boolean(process.env.GCP_PROJECT_ID || isFirestoreEnabled());
}

// chirp_3 supports Hebrew (iw-IL) — chirp_2 does not. chirp_3 lives only in
// the `us` and `eu` multi-region locations (NOT in zonal locations like
// `us-central1`). Keep both env-overridable for ops flexibility.
const STT_LOCATION = process.env.STT_LOCATION ?? "us";
const STT_MODEL = process.env.STT_MODEL ?? "chirp_3";

let _client: speechV2.SpeechClient | null = null;
function getClient(): speechV2.SpeechClient {
  if (_client) return _client;
  // Regional STT requires both a regional recognizer path AND a regional API
  // endpoint (e.g. `us-central1-speech.googleapis.com`).
  const apiEndpoint =
    STT_LOCATION === "global" ? "speech.googleapis.com" : `${STT_LOCATION}-speech.googleapis.com`;
  _client = new speechV2.SpeechClient({ apiEndpoint });
  return _client;
}

// Chirp 2 streaming caps each audio chunk at 25,600 bytes (= 800 ms of
// 16-bit mono 16 kHz PCM). The FE batches frames into 1-second blobs
// (32,000 bytes), so we slice them down here before writing.
const MAX_CHUNK_BYTES = 25_600;

export function openSttSession(
  meetingId: string,
  speakerRole: SpeakerRole,
  cb: SttCallbacks,
): SttSession {
  if (!isSttEnabled()) {
    return { pushAudio: () => {}, close: () => {} };
  }

  const projectId = process.env.GCP_PROJECT_ID!;
  const recognizer = `projects/${projectId}/locations/${STT_LOCATION}/recognizers/_`;

  // Bypass the SDK's `streamingRecognize` helper — it's V1-shaped and wraps
  // audio as `{ audioContent }` (V1 field) instead of `{ audio }` (V2). Going
  // through `_streamingRecognize` lets us write proper V2 messages directly.
  // biome-ignore lint/suspicious/noExplicitAny: V2 SDK typing gap
  const stream = (getClient() as any)._streamingRecognize();

  // First message: recognizer + streamingConfig. Must precede any audio.
  // Chirp 2 has a smaller config surface than older models — just encoding +
  // languages + model. Punctuation is on by default; per-word diarization
  // is not supported here (would need a separate diarization pass).
  stream.write({
    recognizer,
    streamingConfig: {
      config: {
        explicitDecodingConfig: {
          encoding: "LINEAR16",
          sampleRateHertz: 16_000,
          audioChannelCount: 1,
        },
        // Hebrew in V2 uses the legacy ISO 639-1 code `iw`, NOT `he`.
        languageCodes: ["iw-IL", "en-US"],
        model: STT_MODEL,
      },
      streamingFeatures: { interimResults: true },
    },
  });
  console.log(`[stt] opened V2 stream meeting=${meetingId} model=${STT_MODEL} location=${STT_LOCATION} speaker=${speakerRole}`);

  let frameCount = 0;
  let firstResultLogged = false;

  stream.on("data", (response: { results?: SpeechResult[] }) => {
    if (!firstResultLogged) {
      firstResultLogged = true;
      console.log(`[stt] meeting=${meetingId} first response received from STT`);
    }
    for (const result of response.results ?? []) {
      const alt = result.alternatives?.[0];
      if (!alt?.transcript) continue;
      const code = result.languageCode ?? "";
      const lang: TranscriptLine["lang"] =
        code.startsWith("he") || code.startsWith("iw") ? "he" : "en";
      // Speaker is fixed per stream (one stream per audio source). The mic
      // stream is always "rep", the tab stream is always "client".
      const line: TranscriptLine = {
        // Partial id is per-source so mic + tab partials don't overwrite each
        // other in the FE's single live-partial doc (they're written separately
        // in audio-session via writePartial — the doc id key is shared, but
        // throttling ensures only the most recent of either source wins).
        id: result.isFinal ? randomUUID() : `partial-${meetingId}-${speakerRole}`,
        t: formatT(result.resultEndOffset),
        speaker: speakerRole,
        name: speakerRole === "rep" ? "You" : "Client",
        lang,
        text: alt.transcript.trim(),
        isFinal: !!result.isFinal,
      };
      console.log(
        `[stt] meeting=${meetingId} speaker=${speakerRole} ${result.isFinal ? "FINAL" : "partial"} lang=${lang} text="${line.text.slice(0, 80)}"`,
      );
      if (result.isFinal) cb.onFinal?.(line);
      else cb.onPartial?.(line);
    }
  });

  stream.on("error", (err: Error) => {
    // gRPC errors carry detail in `metadata` and `details` fields beyond
    // `.message`. Dump everything so future "Invalid arguments" errors
    // show which field actually broke.
    // biome-ignore lint/suspicious/noExplicitAny: gax errors are loosely typed
    const e = err as any;
    const detail = {
      message: err.message,
      code: e.code,
      details: e.details,
      metadata: e.metadata?.internalRepr ? Object.fromEntries(e.metadata.internalRepr) : undefined,
      statusDetails: e.statusDetails,
    };
    console.error(`[stt] meeting=${meetingId} stream error detail:`, JSON.stringify(detail));
    cb.onError?.(err);
  });

  stream.on("end", () => {
    /* noop — Node will GC the writable side */
  });

  return {
    pushAudio(pcm) {
      try {
        for (let off = 0; off < pcm.length; off += MAX_CHUNK_BYTES) {
          const end = Math.min(off + MAX_CHUNK_BYTES, pcm.length);
          stream.write({ audio: pcm.subarray(off, end) });
        }
        frameCount++;
        if (frameCount % 20 === 1) {
          console.log(
            `[stt] meeting=${meetingId} pushed audio batch=${frameCount} bytes=${pcm.length}`,
          );
        }
      } catch (err) {
        cb.onError?.(err as Error);
      }
    },
    close() {
      try {
        (stream as unknown as Writable).end();
      } catch {
        /* noop */
      }
    },
  };
}

function formatT(offset: SpeechDuration | undefined): string {
  if (!offset) return "00:00";
  const sec = Number(offset.seconds ?? 0);
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface SpeechWord {
  speakerLabel?: string;
}
interface SpeechAlternative {
  transcript?: string;
  words?: SpeechWord[];
}
interface SpeechResult {
  alternatives?: SpeechAlternative[];
  isFinal?: boolean;
  languageCode?: string;
  resultEndOffset?: SpeechDuration;
}
interface SpeechDuration {
  seconds?: number | string | bigint;
  nanos?: number;
}
