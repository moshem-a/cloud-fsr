import type {
  Hint,
  RepNote,
  SentimentEvent,
  SentimentSample,
  ServerWsMessage,
  TranscriptLine,
} from "@scoach/types";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type LangMode = "en" | "he" | "bi";

export interface LiveMeetingState {
  meetingId: string | null;
  connected: boolean;
  listening: boolean;
  muted: boolean;
  langMode: LangMode;
  latencyMs: number | null;
  startedAt: number | null;
  sttError: string | null;

  transcript: TranscriptLine[];
  hints: Hint[];
  followups: string[];
  sentimentSeries: SentimentSample[];
  sentimentEvents: SentimentEvent[];

  actedHintIds: Set<string>;
  pinnedHintIds: Set<string>;
  notes: RepNote[];

  // setters
  reset: () => void;
  setConnection: (connected: boolean) => void;
  setListening: (listening: boolean) => void;
  setMuted: (muted: boolean) => void;
  setLangMode: (m: LangMode) => void;
  setLatencyMs: (ms: number) => void;
  setMeetingId: (id: string) => void;
  setStartedAt: (ts: number) => void;
  setSttError: (err: string | null) => void;
  applyServerMessage: (msg: ServerWsMessage) => void;
  markHintActed: (id: string) => void;
  togglePinned: (id: string) => void;
  addNote: (n: RepNote) => void;
}

export const useLiveMeetingStore = create<LiveMeetingState>()(
  subscribeWithSelector((set) => ({
    meetingId: null,
    connected: false,
    listening: false,
    muted: false,
    langMode: "bi",
    latencyMs: null,
    startedAt: null,
    sttError: null,
    transcript: [],
    hints: [],
    followups: [],
    sentimentSeries: [],
    sentimentEvents: [],
    actedHintIds: new Set<string>(),
    pinnedHintIds: new Set<string>(),
    notes: [],

    reset: () =>
      set({
        meetingId: null,
        connected: false,
        listening: false,
        muted: false,
        latencyMs: null,
        startedAt: null,
        sttError: null,
        transcript: [],
        hints: [],
        followups: [],
        sentimentSeries: [],
        sentimentEvents: [],
        actedHintIds: new Set<string>(),
        pinnedHintIds: new Set<string>(),
        notes: [],
      }),
    setConnection: (connected) => set({ connected }),
    setListening: (listening) => set({ listening }),
    setMuted: (muted) => set({ muted }),
    setLangMode: (langMode) => set({ langMode }),
    setLatencyMs: (latencyMs) => set({ latencyMs }),
    setMeetingId: (meetingId) => set({ meetingId }),
    setStartedAt: (startedAt) => set({ startedAt }),
    setSttError: (sttError) => set({ sttError }),

    applyServerMessage: (msg) =>
      set((s) => {
        switch (msg.type) {
          case "transcript-final":
          case "transcript-partial": {
            const idx = s.transcript.findIndex((l) => l.id === msg.line.id);
            if (idx >= 0) {
              const next = [...s.transcript];
              next[idx] = msg.line;
              return { transcript: next };
            }
            return { transcript: [...s.transcript, msg.line] };
          }
          case "hint": {
            if (s.hints.some((h) => h.id === msg.hint.id)) return {};
            return { hints: [...s.hints, msg.hint] };
          }
          case "followups":
            return { followups: msg.items };
          case "sentiment": {
            const series = [...s.sentimentSeries, msg.sample];
            const events = msg.sample.event ? [...s.sentimentEvents, msg.sample.event] : s.sentimentEvents;
            return { sentimentSeries: series, sentimentEvents: events };
          }
          case "pong":
            return { latencyMs: msg.latencyMs };
          default:
            return {};
        }
      }),

    markHintActed: (id) =>
      set((s) => {
        const next = new Set(s.actedHintIds);
        next.add(id);
        return { actedHintIds: next };
      }),
    togglePinned: (id) =>
      set((s) => {
        const next = new Set(s.pinnedHintIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { pinnedHintIds: next };
      }),
    addNote: (n) => set((s) => ({ notes: [...s.notes, n] })),
  })),
);
