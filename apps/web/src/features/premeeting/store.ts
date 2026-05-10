import type { ContextFile, ContextInsight, LangCode, Meeting, MeetingStage } from "@scoach/types";
import { create } from "zustand";

export interface PreMeetingState {
  step: 0 | 1 | 2 | 3;
  hydrated: boolean;

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

  tips: string[];
  loadingTips: boolean;

  setStep: (s: PreMeetingState["step"]) => void;
  patchStep1: (patch: Partial<Pick<PreMeetingState, "client" | "website" | "title" | "stage">>) => void;
  patchStep2: (patch: Partial<Pick<PreMeetingState, "goal" | "language" | "hintTone">>) => void;
  setContextFiles: (files: ContextFile[]) => void;
  setInsights: (i: ContextInsight | null) => void;
  setAnalyzing: (a: boolean) => void;
  setTips: (tips: string[]) => void;
  setLoadingTips: (l: boolean) => void;
  hydrateFromMeeting: (m: Meeting) => void;
  reset: () => void;
}

const initial: Omit<PreMeetingState, "setStep" | "patchStep1" | "patchStep2" | "setContextFiles" | "setInsights" | "setAnalyzing" | "setTips" | "setLoadingTips" | "hydrateFromMeeting" | "reset"> = {
  step: 0,
  hydrated: false,
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
  tips: [],
  loadingTips: false,
};

export const usePreMeetingStore = create<PreMeetingState>()((set) => ({
  ...initial,
  setStep: (step) => set({ step }),
  patchStep1: (patch) => set(patch),
  patchStep2: (patch) => set(patch),
  setContextFiles: (contextFiles) => set({ contextFiles }),
  setInsights: (insights) => set({ insights }),
  setAnalyzing: (analyzing) => set({ analyzing }),
  setTips: (tips) => set({ tips }),
  setLoadingTips: (loadingTips) => set({ loadingTips }),
  hydrateFromMeeting: (m) => {
    const hasClient = !!m.account?.name;
    const hasGoal = !!m.goal && m.goal.length > 5;

    let step: 0 | 1 | 2 | 3 = 0;
    if (hasClient && m.title) step = 1;
    if (step >= 1 && hasGoal) step = 2;
    if (step >= 2) step = 3;

    set({
      hydrated: true,
      step,
      client: m.account?.name ?? "",
      website: m.account?.website ?? "",
      title: m.title ?? "",
      stage: m.stage ?? "Discovery",
      goal: m.goal ?? "",
      language: m.language ?? "auto",
      hintTone: "consultative",
      contextFiles: m.contextFiles ?? [],
      insights: null,
      tips: [],
      loadingTips: false,
    });
  },
  reset: () => set(initial),
}));
