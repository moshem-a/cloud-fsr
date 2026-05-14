import type { TranscriptLine } from "@scoach/types";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuthStore } from "../../../auth/store.ts";
import { api } from "../../../../lib/http.ts";

const WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";
const MODEL = "models/gemini-2.0-flash-live-001";

export interface UseGeminiLiveOptions {
  meetingId: string;
  systemInstruction: string;
  enabled: boolean;
}

export interface GeminiLiveHandle {
  connect: () => void;
  disconnect: () => void;
  sendAudio: (pcm: Int16Array) => void;
  connected: boolean;
  error: string | null;
}

let lineCounter = 0;
function makeTimestamp(): string {
  const s = Math.floor(lineCounter++ * 2);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function int16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin);
}

function base64ToFloat32(b64: string, _sampleRate: number): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i]! / 32768;
  }
  return float32;
}

export function useGeminiLive(opts: UseGeminiLiveOptions): GeminiLiveHandle {
  const { meetingId, systemInstruction, enabled: _enabled } = opts;
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const meetingIdRef = useRef(meetingId);
  const systemInstructionRef = useRef(systemInstruction);
  const textBufferRef = useRef("");

  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);
  useEffect(() => {
    systemInstructionRef.current = systemInstruction;
  }, [systemInstruction]);

  const playAudioChunk = useCallback((b64: string) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = audioCtxRef.current;
    const samples = base64ToFloat32(b64, 24000);
    if (samples.length === 0) return;

    const buf = ctx.createBuffer(1, samples.length, 24000);
    buf.copyToChannel(samples, 0);
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, nextPlayTimeRef.current);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + buf.duration;
  }, []);

  const flushTextBuffer = useCallback(() => {
    const text = textBufferRef.current.trim();
    if (!text) return;
    textBufferRef.current = "";

    const line: TranscriptLine = {
      id: crypto.randomUUID(),
      t: makeTimestamp(),
      speaker: "client",
      name: "Client (AI)",
      lang: "en",
      text,
      isFinal: true,
    };

    void api(`/meetings/${meetingIdRef.current}/transcript`, {
      method: "POST",
      body: line,
    }).catch((err) => {
      console.warn("[gemini-live] transcript inject failed:", err);
    });
  }, []);

  const connect = useCallback(() => {
    const key = useAuthStore.getState().geminiKey;
    if (!key) {
      setError("No Gemini API key set. Add one in Settings.");
      return;
    }

    const ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(key)}`);
    wsRef.current = ws;
    setError(null);

    ws.onopen = () => {
      const setup = {
        setup: {
          model: MODEL,
          generationConfig: {
            responseModalities: ["AUDIO", "TEXT"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
            },
          },
          systemInstruction: {
            parts: [{ text: systemInstructionRef.current }],
          },
        },
      };
      ws.send(JSON.stringify(setup));
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);

        if (msg.setupComplete) {
          setConnected(true);
          setError(null);
          return;
        }

        const parts = msg.serverContent?.modelTurn?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.inlineData?.data) {
              playAudioChunk(part.inlineData.data);
            }
            if (part.text) {
              textBufferRef.current += part.text;
            }
          }
        }

        if (msg.serverContent?.turnComplete) {
          flushTextBuffer();
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      setError("Gemini Live connection error");
      setConnected(false);
    };

    ws.onclose = (ev) => {
      setConnected(false);
      if (ev.code !== 1000) {
        const detail = ev.reason || `code ${ev.code}`;
        setError(`Gemini Live disconnected (${detail}). Check your API key and try again.`);
      }
    };
  }, [playAudioChunk, flushTextBuffer]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
    }
    setConnected(false);
    flushTextBuffer();
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    nextPlayTimeRef.current = 0;
  }, [flushTextBuffer]);

  const sendAudio = useCallback((pcm: Int16Array) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "audio/pcm;rate=16000",
            data: int16ToBase64(pcm),
          },
        ],
      },
    };
    ws.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000);
        wsRef.current = null;
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  return { connect, disconnect, sendAudio, connected, error };
}
