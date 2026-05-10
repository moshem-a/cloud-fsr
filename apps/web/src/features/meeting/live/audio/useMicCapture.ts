import { useCallback, useEffect, useRef, useState } from "react";

import type { AudioCaptureFrame, AudioCaptureHandle } from "./useAudioCapture.ts";

export interface UseMicCaptureOptions {
  onFrame: (frame: AudioCaptureFrame) => void;
  onError?: (err: Error) => void;
  /** Pause forwarding frames upstream. AudioContext stays open so resume is instant. */
  paused?: boolean;
}

const TARGET_SAMPLE_RATE = 16_000;
const FRAME_MS = 100;

/**
 * Captures audio from the rep's laptop mic via getUserMedia, runs it through
 * the same resampler AudioWorklet as useAudioCapture, and emits 100ms 16 kHz
 * mono PCM frames via onFrame. Echo/noise/AGC enabled so meeting playback
 * doesn't bleed into the mic stream when the rep isn't on headphones.
 *
 * Mirror of useAudioCapture but for mic instead of getDisplayMedia. Same frame
 * shape so the uploader path is identical.
 */
export function useMicCapture(opts: UseMicCaptureOptions): AudioCaptureHandle {
  const { onFrame, onError, paused } = opts;
  const onFrameRef = useRef(onFrame);
  const onErrorRef = useRef(onError);
  const pausedRef = useRef(!!paused);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [rmsDb, setRmsDb] = useState(-100);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    pausedRef.current = !!paused;
  }, [paused]);

  const stop = useCallback(() => {
    workletRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioCtxRef.current?.close().catch(() => {});
    workletRef.current = null;
    sourceRef.current = null;
    audioCtxRef.current = null;

    setStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setCapturing(false);
    setRmsDb(-100);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    // Tear down existing capture first so re-clicking Switch (or restarting
    // alongside a tab-source switch) actually reopens the mic stream.
    if (capturing) {
      stop();
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioTracks = media.getAudioTracks();
      if (audioTracks.length === 0) {
        media.getTracks().forEach((t) => t.stop());
        const msg = "No microphone audio track available.";
        setError(msg);
        onErrorRef.current?.(new Error(msg));
        return;
      }
      audioTracks[0]!.addEventListener("ended", () => stop());

      const settings = audioTracks[0]!.getSettings();
      const ctx = new AudioContext({ sampleRate: settings.sampleRate ?? 48_000 });
      audioCtxRef.current = ctx;
      await ctx.audioWorklet.addModule("/worklets/resampler-worklet.js");

      const audioOnly = new MediaStream([audioTracks[0]!]);
      const src = ctx.createMediaStreamSource(audioOnly);
      sourceRef.current = src;

      const node = new AudioWorkletNode(ctx, "resampler", {
        processorOptions: { targetSampleRate: TARGET_SAMPLE_RATE, frameMs: FRAME_MS },
      });
      workletRef.current = node;

      node.port.onmessage = (ev: MessageEvent) => {
        const data = ev.data as { pcm: Int16Array; rmsDb: number; peakDb: number; silent: boolean };
        setRmsDb(data.rmsDb);
        if (pausedRef.current) return;
        onFrameRef.current({
          pcm: data.pcm,
          rmsDb: data.rmsDb,
          peakDb: data.peakDb,
          silent: data.silent,
          capturedAt: performance.timeOrigin + performance.now(),
        });
      };

      src.connect(node);
      // Intentionally NOT connecting node → ctx.destination so we don't echo audio back.

      setStream(media);
      setCapturing(true);
    } catch (err) {
      const e = err as Error;
      setError(e.message);
      onErrorRef.current?.(e);
    }
  }, [capturing, stop]);

  useEffect(() => {
    return () => {
      workletRef.current?.disconnect();
      sourceRef.current?.disconnect();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return { start, stop, capturing, stream, error, rmsDb };
}
