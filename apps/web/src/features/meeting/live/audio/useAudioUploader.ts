import { useEffect, useRef } from "react";

import { getIdToken } from "../../../../lib/firebase.ts";

const BASE =
  import.meta.env.VITE_API_BASE_URL === undefined
    ? "http://localhost:8080"
    : import.meta.env.VITE_API_BASE_URL;

/**
 * Buffers PCM frames from useAudioCapture and POSTs them as binary blobs to
 * /meetings/:id/audio every `flushMs`. One open POST at a time per meeting
 * (chained sequentially) to avoid out-of-order STT input.
 *
 * Replaces the WebSocket sendAudio path because Firebase Hosting does not
 * proxy WebSocket Upgrade requests.
 */
export interface UseAudioUploaderOpts {
  meetingId: string;
  /** How often to flush the buffer to the server. Default 1000 ms. */
  flushMs?: number;
}

export interface AudioUploader {
  /** Push a PCM frame from the AudioWorklet. Buffered until next flush. */
  push: (pcm: Int16Array) => void;
  /** Force-flush whatever is buffered (e.g. on End meeting). */
  flush: () => Promise<void>;
}

export function useAudioUploader(opts: UseAudioUploaderOpts): AudioUploader {
  const { meetingId, flushMs = 1000 } = opts;
  const bufferRef = useRef<Int16Array[]>([]);
  const inFlightRef = useRef<Promise<unknown> | null>(null);
  const meetingIdRef = useRef(meetingId);

  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);

  function joinFrames(frames: Int16Array[]): ArrayBuffer {
    const totalSamples = frames.reduce((n, f) => n + f.length, 0);
    const out = new Int16Array(totalSamples);
    let off = 0;
    for (const f of frames) {
      out.set(f, off);
      off += f.length;
    }
    return out.buffer;
  }

  async function flushOnce(): Promise<void> {
    if (bufferRef.current.length === 0) return;
    if (inFlightRef.current) {
      await inFlightRef.current;
    }
    const frames = bufferRef.current;
    bufferRef.current = [];
    const blob = joinFrames(frames);
    // Skip empty bodies — the worklet sometimes emits zero-sample frames at
    // tab-focus / silence boundaries. The server treats them as noise too.
    if (blob.byteLength === 0) {
      inFlightRef.current = null;
      return;
    }

    let token: string | null = null;
    try {
      token = await getIdToken();
    } catch {
      /* dev fallback */
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (import.meta.env.DEV) headers.Authorization = "Bearer dev-token";

    const send = fetch(`${BASE}/meetings/${meetingIdRef.current}/audio`, {
      method: "POST",
      headers,
      body: blob,
    }).catch((err) => {
      // Don't crash the loop on transient errors; log and drop.
      console.warn("[audio-uploader] POST failed", err);
    });
    inFlightRef.current = send;
    await send;
    inFlightRef.current = null;
  }

  useEffect(() => {
    const t = setInterval(() => {
      void flushOnce();
    }, flushMs);
    return () => clearInterval(t);
    // intentionally not depending on flushOnce — its identity is stable per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flushMs]);

  return {
    push(pcm) {
      // Copy into a new Int16Array because the worklet recycles buffers.
      bufferRef.current.push(new Int16Array(pcm));
    },
    flush: flushOnce,
  };
}
