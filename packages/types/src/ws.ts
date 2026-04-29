import type { Hint, LangCode, SentimentSample, TranscriptLine } from "./meeting.ts";

export const WS_SUBPROTOCOL = "gcp-sales-coach.v1" as const;

// ---------- Client → Server ----------
export interface ClientHello {
  type: "hello";
  meetingId: string;
  sampleRate: 16000;
  language: "auto" | LangCode;
  resumeFromTs?: number;
}

export interface ClientMute {
  type: "mute";
  muted: boolean;
}

export interface ClientMarkHintActed {
  type: "mark-hint-acted";
  hintId: string;
  useful: boolean;
}

export interface ClientPrivateNote {
  type: "private-note";
  t: string;
  text: string;
}

export interface ClientLanguage {
  type: "language";
  lang: "auto" | LangCode;
}

export interface ClientPing {
  type: "ping";
  ts: number;
}

export interface ClientBye {
  type: "bye";
  reason: "ended" | "closed";
}

export type ClientWsMessage =
  | ClientHello
  | ClientMute
  | ClientMarkHintActed
  | ClientPrivateNote
  | ClientLanguage
  | ClientPing
  | ClientBye;

// ---------- Server → Client ----------
export interface ServerReady {
  type: "ready";
  sttSessionId: string;
  serverTimeMs: number;
}

export interface ServerTranscriptPartial {
  type: "transcript-partial";
  line: TranscriptLine;
}

export interface ServerTranscriptFinal {
  type: "transcript-final";
  line: TranscriptLine;
}

export interface ServerHint {
  type: "hint";
  hint: Hint;
}

export interface ServerFollowups {
  type: "followups";
  items: string[];
}

export interface ServerSentiment {
  type: "sentiment";
  sample: SentimentSample;
}

export interface ServerError {
  type: "error";
  code: string;
  message: string;
  recoverable: boolean;
}

export interface ServerPong {
  type: "pong";
  ts: number;
  latencyMs: number;
}

export interface ServerClosed {
  type: "closed";
  reason: string;
}

export type ServerWsMessage =
  | ServerReady
  | ServerTranscriptPartial
  | ServerTranscriptFinal
  | ServerHint
  | ServerFollowups
  | ServerSentiment
  | ServerError
  | ServerPong
  | ServerClosed;

export type WsMessage = ClientWsMessage | ServerWsMessage;
