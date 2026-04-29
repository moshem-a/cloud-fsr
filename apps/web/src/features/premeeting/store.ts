import type { ContextFile, ContextInsight, LangCode, MeetingStage } from "@scoach/types";
import { create } from "zustand";

export interface PreMeetingState {
  step: 0 | 1 | 2 | 3;

  client: string;
  website: string;
  title: string;
  stage: MeetingStage;

  goal: string;
  language: "auto" | LangCode;
  hintTone: "direct" | "consultative" | "brief";

  contextFiles: ContextFile[];
  insights: ContextInsight | null;
  analyzing: boolean;

  setStep: (s: PreMeetingState["step"]) => void;
  patchStep1: (patch: Partial<Pick<PreMeetingState, "client" | "website" | "title" | "stage">>) => void;
  patchStep2: (patch: Partial<Pick<PreMeetingState, "goal" | "language" | "hintTone">>) => void;
  setContextFiles: (files: ContextFile[]) => void;
  setInsights: (i: ContextInsight | null) => void;
  setAnalyzing: (a: boolean) => void;
  reset: () => void;
}

const initial: Omit<PreMeetingState, "setStep" | "patchStep1" | "patchStep2" | "setContextFiles" | "setInsights" | "setAnalyzing" | "reset"> = {
  step: 0,
  client: "",
  website: "",
  title: "",
  stage: "Discovery",
  goal: "",
  language: "auto",
  hintTone: "consultative",
  contextFiles: [],
  insights: null,
  analyzing: false,
};

export const usePreMeetingStore = create<PreMeetingState>()((set) => ({
  ...initial,
  setStep: (step) => set({ step }),
  patchStep1: (patch) => set(patch),
  patchStep2: (patch) => set(patch),
  setContextFiles: (contextFiles) => set({ contextFiles }),
  setInsights: (insights) => set({ insights }),
  setAnalyzing: (analyzing) => set({ analyzing }),
  reset: () => set(initial),
}));
