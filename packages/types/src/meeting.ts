import type { HexColor, ISO8601, UUID } from "./index.ts";

export type MeetingStage = "Intro" | "Discovery" | "Qualification" | "Negotiation";
export type SpeakerSide = "client" | "rep";
export type LangCode = "en" | "he";
export type Sentiment = "buying" | "concern" | "positive" | "neutral";
export type HintCategory = "Competitive" | "Problem→Solution" | "Commercial" | "Positive";
export type HintColor = "blue" | "red" | "yellow" | "green";
export type DealHealth = "hot" | "warm" | "cool" | "cold";

export interface Account {
  name: string;
  industry?: string;
  region?: string;
  contact?: string;
  contactRole?: string;
  deal?: string;
  arr?: string;
  website?: string;
}

export interface Participant {
  name: string;
  role: string;
  side: SpeakerSide;
  color: HexColor;
  initials: string;
}

export interface TranscriptLine {
  id: UUID;
  t: string;
  speaker: SpeakerSide;
  name: string;
  lang: LangCode;
  text: string;
  trans?: string;
  entities?: string[];
  sentiment?: Sentiment;
  isFinal: boolean;
}

export interface Hint {
  id: UUID;
  title: string;
  category: HintCategory;
  color: HintColor;
  summary: string;
  proofPoints: string[];
  sources: string[];
  confidence: number;
  timestamp: string;
  actedOn?: boolean;
}

export interface SentimentEvent {
  at: number;
  label: string;
  kind: Sentiment;
}

export interface SentimentSample {
  at: number;
  value: number;
  event?: SentimentEvent;
}

export type ContextItemKind = "url" | "doc" | "case";

export interface ContextItem {
  kind: ContextItemKind;
  label: string;
  note?: string;
  href?: string;
}

export interface ContextFile {
  id: UUID;
  name: string;
  size: number;
  sha256: string;
  contentType: string;
  uploadedAt: ISO8601;
  indexed: boolean;
}

export interface ContextInsight {
  entities: string[];
  painPoints: string[];
  tags: string[];
}

export interface RepNote {
  t: string;
  text: string;
}

export interface Meeting {
  id: UUID;
  ownerUid: string;
  account: Account;
  title: string;
  goal?: string;
  stage: MeetingStage;
  language: "auto" | LangCode;
  scheduledAt?: ISO8601;
  startedAt?: ISO8601;
  endedAt?: ISO8601;
  participants: Participant[];
  contextFiles: ContextFile[];
  contextItems: ContextItem[];
  notes: RepNote[];
  status: "draft" | "live" | "ended" | "summarized";
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface MeetingDraft {
  account: Pick<Account, "name" | "website">;
  title: string;
  stage: MeetingStage;
}

export interface MeetingSetup extends MeetingDraft {
  goal?: string;
  language: "auto" | LangCode;
  hintTone?: "direct" | "consultative" | "brief";
}

export interface HistoryItem {
  id: UUID;
  client: string;
  title: string;
  date: ISO8601;
  duration: string;
  rep: string;
  stage: MeetingStage;
  /** Live state — drives whether the row links to /live (resume) or /summary. */
  status?: "draft" | "live" | "ended" | "summarized";
  score: number;
  sentiment: Sentiment;
  tags: string[];
  hintCount: number;
  actedOn: number;
  nextStep?: string;
  avatar: HexColor;
  sharedBy?: { uid: string; name: string; initials: string; color: HexColor; role?: string };
  sharedAt?: ISO8601;
}

export interface UpsellOpportunity {
  name: string;
  reason: string;
  estimatedMonthlyArr?: number;
}

export interface ActionItem {
  id: UUID;
  who: string;
  what: string;
  due: ISO8601;
  done: boolean;
}

export interface ReferenceLink {
  title: string;
  href: string;
  source: string;
}

export interface InternalSummary {
  confidence: number;
  health: DealHealth;
  score: number;
  wentWell: string[];
  couldImprove: string[];
  upsell: UpsellOpportunity[];
  risks: string[];
  needs: { stated: string[]; actual: string[] };
  actionItems: ActionItem[];
  topMoments: { t: string; type: string; quote: string }[];
}

export interface ClientEmail {
  subject: string;
  greeting: string;
  body: string[];
  signoff: string;
  tone: "formal" | "warm" | "brief";
}

export interface MeetingSummary {
  meetingId: UUID;
  meeting: {
    client: string;
    title: string;
    date: ISO8601;
    duration: string;
    participants: string[];
  };
  internal: InternalSummary;
  client: ClientEmail;
  references: ReferenceLink[];
  generatedAt: ISO8601;
  generationLatencyMs: number;
}

export type SharePermission = "view" | "comment" | "edit";

export interface Share {
  id: UUID;
  meetingId: UUID;
  recipientUid?: string;
  recipientEmail: string;
  permission: SharePermission;
  external: boolean;
  message?: string;
  createdAt: ISO8601;
  createdByUid: string;
}
