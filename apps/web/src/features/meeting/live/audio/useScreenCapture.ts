import { useEffect, useRef } from "react";

import { getIdToken } from "../../../../lib/firebase.ts";

const BASE =
  import.meta.env.VITE_API_BASE_URL === undefined
    ? "http://localhost:8080"
    : import.meta.env.VITE_API_BASE_URL;

const CHANGE_THRESHOLD = 0.03;
const SAMPLE_STEP = 40;

interface UseScreenCaptureOptions {
  stream: MediaStream | null;
  meetingId: string;
  intervalMs?: number;
}

function hasChanged(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  prev: Uint8ClampedArray | null,
): { changed: boolean; pixels: Uint8ClampedArray } {
  const current = ctx.getImageData(0, 0, width, height).data;
  if (!prev) return { changed: true, pixels: current };

  let diffSum = 0;
  let samples = 0;
  for (let i = 0; i < current.length; i += 4 * SAMPLE_STEP) {
    const dr = Math.abs(current[i]! - prev[i]!);
    const dg = Math.abs(current[i + 1]! - prev[i + 1]!);
    const db = Math.abs(current[i + 2]! - prev[i + 2]!);
    diffSum += (dr + dg + db) / 765;
    samples++;
  }
  const ratio = samples > 0 ? diffSum / samples : 0;
  return { changed: ratio > CHANGE_THRESHOLD, pixels: current };
}

export function useScreenCapture({ stream, meetingId, intervalMs = 5_000 }: UseScreenCaptureOptions) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevPixelsRef = useRef<Uint8ClampedArray | null>(null);

  useEffect(() => {
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return;

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    prevPixelsRef.current = null;

    let stopped = false;

    const capture = async () => {
      if (stopped || video.readyState < 2) return;
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const canvas = canvasRef.current!;
      canvas.width = Math.min(w, 1280);
      canvas.height = Math.round((canvas.width / w) * h);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const { changed, pixels } = hasChanged(ctx, canvas.width, canvas.height, prevPixelsRef.current);
      if (!changed) return;
      prevPixelsRef.current = pixels;

      try {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.7),
        );
        if (!blob || stopped) return;

        let token: string | null = null;
        try {
          token = await getIdToken();
        } catch { /* dev fallback */ }
        const headers: Record<string, string> = { "Content-Type": "image/jpeg" };
        if (token) headers.Authorization = `Bearer ${token}`;
        else if (import.meta.env.DEV) headers.Authorization = "Bearer dev-token";

        await fetch(`${BASE}/meetings/${meetingId}/screen-frame`, {
          method: "POST",
          headers,
          body: blob,
        });
      } catch {
        // Non-critical — skip this frame silently.
      }
    };

    const id = setInterval(capture, intervalMs);

    return () => {
      stopped = true;
      clearInterval(id);
      video.pause();
      video.srcObject = null;
    };
  }, [stream, meetingId, intervalMs]);
}
