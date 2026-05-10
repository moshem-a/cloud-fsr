import type {
  Hint,
  Infographic,
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
  /** Live speculative text from STT — overwrites itself as the speaker talks.
   * Cleared when the corresponding final transcript lands. */
  livePartial: string | null;

  transcript: TranscriptLine[];
  hints: Hint[];
  followups: string[];
  /** Time-ordered history of follow-up sets (newest last). Each set is the
   * full list returned by the server at that tick. Used by FollowupList to
   * show the latest set above and prior sets collapsed below. Cap at 8. */
  followupSets: { items: string[]; at: number }[];
  /** Combined sentiment series (legacy/global). */
  sentimentSeries: SentimentSample[];
  /** Sentiment series filtered to only what the rep ("You") said. */
  sentimentRep: SentimentSample[];
  /** Sentiment series filtered to only what the client said. */
  sentimentClient: SentimentSample[];
  sentimentEvents: SentimentEvent[];

  actedHintIds: Set<string>;
  pinnedHintIds: Set<string>;
  notes: RepNote[];
  liveTips: { id: string; text: string; at: number }[];

  infographics: Infographic[];
  rightPanelTab: "infographics" | "transcript";
  quietInfographic: Infographic | null;
  activeInfographicIndex: number;

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
  setLivePartial: (text: string | null) => void;
  applyServerMessage: (msg: ServerWsMessage) => void;
  markHintActed: (id: string) => void;
  togglePinned: (id: string) => void;
  addNote: (n: RepNote) => void;
  setNotes: (notes: RepNote[]) => void;
  updateNote: (index: number, text: string) => void;
  deleteNote: (index: number) => void;
  addInfographic: (ig: Infographic) => void;
  setInfographics: (igs: Infographic[]) => void;
  setRightPanelTab: (tab: "infographics" | "transcript") => void;
  setQuietInfographic: (ig: Infographic | null) => void;
  setActiveInfographicIndex: (i: number) => void;
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
    livePartial: null,
    transcript: [],
    hints: [],
    followups: [],
    followupSets: [],
    sentimentSeries: [],
    sentimentRep: [],
    sentimentClient: [],
    sentimentEvents: [],
    actedHintIds: new Set<string>(),
    pinnedHintIds: new Set<string>(),
    notes: [],
    liveTips: [],
    infographics: [],
    rightPanelTab: "infographics",
    quietInfographic: null,
    activeInfographicIndex: 0,

    reset: () =>
      set({
        meetingId: null,
        connected: false,
        listening: false,
        muted: false,
        latencyMs: null,
        startedAt: null,
        sttError: null,
        livePartial: null,
        transcript: [],
        hints: [],
        followups: [],
        followupSets: [],
        sentimentSeries: [],
        sentimentRep: [],
        sentimentClient: [],
        sentimentEvents: [],
        actedHintIds: new Set<string>(),
        pinnedHintIds: new Set<string>(),
        notes: [],
        liveTips: [],
        infographics: [],
        rightPanelTab: "infographics",
        quietInfographic: null,
        activeInfographicIndex: 0,
      }),
    setConnection: (connected) => set({ connected }),
    setListening: (listening) => set({ listening }),
    setMuted: (muted) => set({ muted }),
    setLangMode: (langMode) => set({ langMode }),
    setLatencyMs: (latencyMs) => set({ latencyMs }),
    setMeetingId: (meetingId) => set({ meetingId }),
    setStartedAt: (startedAt) => set({ startedAt }),
    setSttError: (sttError) => set({ sttError }),
    setLivePartial: (livePartial) => set({ livePartial }),

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
            return { hints: [msg.hint, ...s.hints] };
          }
          case "followups": {
            const last = s.followupSets[s.followupSets.length - 1];
            // Skip if items haven't changed — keeps history meaningful.
            if (last && JSON.stringify(last.items) === JSON.stringify(msg.items)) {
              return { followups: msg.items };
            }
            return {
              followups: msg.items,
              followupSets: [...s.followupSets, { items: msg.items, at: Date.now() }].slice(-8),
            };
          }
          case "sentiment": {
            const speaker = msg.sample.speaker ?? "all";
            const events = msg.sample.event ? [...s.sentimentEvents, msg.sample.event] : s.sentimentEvents;
            if (speaker === "rep") {
              return { sentimentRep: [...s.sentimentRep, msg.sample], sentimentEvents: events };
            }
            if (speaker === "client") {
              return { sentimentClient: [...s.sentimentClient, msg.sample], sentimentEvents: events };
            }
            return { sentimentSeries: [...s.sentimentSeries, msg.sample], sentimentEvents: events };
          }
          case "tip": {
            if (s.liveTips.some((t) => t.id === msg.tip.id)) return {};
            return { liveTips: [msg.tip, ...s.liveTips] };
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
    setNotes: (notes) => set({ notes }),
    updateNote: (index, text) =>
      set((s) => {
        if (index < 0 || index >= s.notes.length) return {};
        const next = [...s.notes];
        const existing = next[index];
        if (!existing) return {};
        next[index] = { t: existing.t, text };
        return { notes: next };
      }),
    deleteNote: (index) =>
      set((s) => {
        if (index < 0 || index >= s.notes.length) return {};
        const next = s.notes.filter((_, i) => i !== index);
        return { notes: next };
      }),
    addInfographic: (ig) =>
      set((s) => {
        if (s.infographics.some((x) => x.id === ig.id)) return {};
        return { infographics: [ig, ...s.infographics].slice(0, 20), activeInfographicIndex: 0 };
      }),
    setInfographics: (infographics) => set({ infographics, activeInfographicIndex: 0 }),
    setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
    setQuietInfographic: (quietInfographic) => set({ quietInfographic }),
    setActiveInfographicIndex: (activeInfographicIndex) => set({ activeInfographicIndex }),
  })),
);
