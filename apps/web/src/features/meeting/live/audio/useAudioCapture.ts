import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioCaptureFrame {
  pcm: Int16Array;
  rmsDb: number;
  peakDb: number;
  silent: boolean;
  capturedAt: number;
}

export interface UseAudioCaptureOptions {
  onFrame: (frame: AudioCaptureFrame) => void;
  onError?: (err: Error) => void;
  /** Pause forwarding frames upstream. AudioContext stays open so resume is instant. */
  paused?: boolean;
}

export interface AudioCaptureHandle {
  start: () => Promise<void>;
  stop: () => void;
  /** True between getDisplayMedia success and stop()/track-end. */
  capturing: boolean;
  /** Live MediaStream for the share preview. */
  stream: MediaStream | null;
  error: string | null;
  /** Latest RMS dB level (-100..0), updated per frame. */
  rmsDb: number;
}

const TARGET_SAMPLE_RATE = 16_000;
const FRAME_MS = 100;

/**
 * Captures audio via getDisplayMedia({ audio: true }), runs it through
 * the resampler AudioWorklet, and emits 100ms 16 kHz mono PCM frames
 * via onFrame. Honors `paused` to drop frames without tearing down the
 * pipeline.
 *
 * Validated by Risk 1 spike (docs/adr/0006-audio-capture.md).
 */
export function useAudioCapture(opts: UseAudioCaptureOptions): AudioCaptureHandle {
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
    if (capturing) return;
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          // Chrome-specific hints; ignored elsewhere
          // @ts-expect-error: chrome-only constraints
          suppressLocalAudioPlayback: false,
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      });

      const audioTracks = media.getAudioTracks();
      if (audioTracks.length === 0) {
        media.getTracks().forEach((t) => t.stop());
        const msg =
          'No audio track in shared stream. In the picker, choose "Chrome Tab" and tick "Share tab audio".';
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
      // Cleanup on unmount.
      workletRef.current?.disconnect();
      sourceRef.current?.disconnect();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return { start, stop, capturing, stream, error, rmsDb };
}
