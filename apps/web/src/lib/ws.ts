import {
  type ClientWsMessage,
  type ServerWsMessage,
  WS_SUBPROTOCOL,
} from "@scoach/types";

import { getIdToken } from "./firebase.ts";

function wsBase(): string {
  const cfg = import.meta.env.VITE_API_BASE_URL;
  if (cfg === undefined) return "ws://localhost:8080";
  if (cfg === "" || cfg.startsWith("/")) {
    if (typeof window === "undefined") return "ws://localhost:8080";
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  return cfg.replace(/^http/, "ws");
}
const BASE = wsBase();

export interface ScoachWsOpts {
  meetingId: string;
  onMessage: (msg: ServerWsMessage) => void;
  onOpen?: () => void;
  onClose?: (e: CloseEvent) => void;
  onError?: (e: Event) => void;
}

export interface ScoachWs {
  send(msg: ClientWsMessage): void;
  /** Stream a binary PCM audio frame (16-bit mono 16 kHz, 100 ms). */
  sendAudio(pcm: Int16Array): void;
  close(code?: number, reason?: string): void;
  readyState: number;
}

export async function openMeetingSocket(opts: ScoachWsOpts): Promise<ScoachWs> {
  let token: string | null = null;
  try {
    token = await getIdToken();
  } catch {
    /* MSW dev mode */
  }
  if (!token && import.meta.env.DEV) token = "dev-token";

  const url = `${BASE}/ws/meeting/${encodeURIComponent(opts.meetingId)}?token=${encodeURIComponent(token ?? "")}`;
  const ws = new WebSocket(url, WS_SUBPROTOCOL);

  ws.addEventListener("open", () => opts.onOpen?.());
  ws.addEventListener("close", (e) => opts.onClose?.(e));
  ws.addEventListener("error", (e) => opts.onError?.(e));
  ws.addEventListener("message", (ev) => {
    if (typeof ev.data !== "string") return;
    try {
      const msg = JSON.parse(ev.data) as ServerWsMessage;
      opts.onMessage(msg);
    } catch {
      // ignore non-JSON frames
    }
  });

  return {
    send(msg) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    sendAudio(pcm) {
      if (ws.readyState !== WebSocket.OPEN) return;
      // PCM Int16Array → ArrayBuffer; backend expects raw mono 16-bit 16 kHz.
      const buf = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength);
      ws.send(buf);
    },
    close(code, reason) {
      ws.close(code, reason);
    },
    get readyState() {
      return ws.readyState;
    },
  };
}
