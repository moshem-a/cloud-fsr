import type {
  ActionItem,
  ClientEmail,
  ContextFile,
  ContextInsight,
  Hint,
  HistoryItem,
  Meeting,
  MeetingDraft,
  MeetingSetup,
  MeetingSummary,
  RepNote,
  Share,
  SharePermission,
} from "./meeting.ts";
import type { CalendarEvent } from "./calendar.ts";
import type { TeamMember, User, UserProfile, UserSettings } from "./user.ts";

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ---------- Auth ----------
export interface SignInRequest {
  idToken: string;
}
export interface SignInResponse {
  user: User;
  sessionExpiresAt: number;
}
export interface VerifyGeminiKeyRequest {
  key: string;
}
export interface VerifyGeminiKeyResponse {
  valid: boolean;
  quotaTier?: "free" | "paid";
  error?: string;
  modelAvailable?: string;
}

// ---------- Users ----------
export type UpdateProfileRequest = Partial<UserProfile>;
export type UpdateSettingsRequest = Partial<UserSettings>;
export interface UserStatsResponse {
  thisWeek: {
    meetings: number;
    minutes: number;
    hintsActedPct: number;
    avgConfidence?: number;
    buyingSignals?: number;
    openTasks?: number;
  };
  trend: { meetings: number; minutes: number; hintsActedPct: number };
}

export interface CoachInsight {
  icon: "up" | "warn" | "info";
  title: string;
  detail: string;
}
export interface CoachInsightsResponse {
  items: CoachInsight[];
}

// ---------- Meetings ----------
export interface ListMeetingsResponse {
  items: Meeting[];
  nextCursor?: string;
}
export interface CreateMeetingRequest extends MeetingDraft {}
export interface ListHistoryQuery {
  scope?: "mine" | "shared";
  stage?: string;
  search?: string;
  cursor?: string;
}
export interface ListHistoryResponse {
  items: HistoryItem[];
  nextCursor?: string;
}

// ---------- Pre-meeting ----------
export interface SetupMeetingRequest extends MeetingSetup {}
export interface UploadContextResponse {
  files: ContextFile[];
}
export interface AnalyzeContextResponse {
  jobId: string;
}
export interface ContextAnalysisResult {
  status: "pending" | "done" | "error";
  summary?: string;
  insights?: ContextInsight;
  error?: string;
}
export interface PriorMeetingsResponse {
  items: HistoryItem[];
}

// ---------- Hints / Followups ----------
export interface ListHintsResponse {
  items: Hint[];
}
export interface ListFollowupsResponse {
  items: string[];
}
export interface RegenerateFollowupsResponse {
  items: string[];
}

// ---------- Notes ----------
export interface CreateNoteRequest extends RepNote {}

// ---------- Summary ----------
export interface SummarizeResponse {
  jobId: string;
  status: "pending" | "done";
}
export interface RegenerateEmailRequest {
  tone: "formal" | "warm" | "brief";
}
export type RegenerateEmailResponse = ClientEmail;
export interface UpdateEmailRequest {
  bodyText: string;
  subject?: string;
}
export type UpdateEmailResponse = ClientEmail;
export interface SendEmailRequest {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
}
export interface SendEmailResponse {
  messageId: string;
}

// ---------- Action Items ----------
export interface UpdateActionItemsRequest {
  actionItems: ActionItem[];
}
export type UpdateActionItemsResponse = ActionItem[];

// ---------- Tasks ----------
export interface TaskView {
  taskId: string;
  meetingId: string;
  client: string;
  meetingTitle: string;
  meetingDate: string;
  who: string;
  what: string;
  due: string;
  done: boolean;
  meetingType?: string;
}
export interface ListTasksResponse {
  items: TaskView[];
}
export interface UpdateTaskRequest {
  done?: boolean;
  who?: string;
  what?: string;
  due?: string;
}
export type UpdateTaskResponse = TaskView;

// ---------- Sharing ----------
export interface ShareRecipient {
  email: string;
  permission: SharePermission;
}
export interface CreateShareRequest {
  recipients: ShareRecipient[];
  message?: string;
}
export interface CreateShareResponse {
  shares: Share[];
}
export interface ListSharesResponse {
  items: Share[];
}

// ---------- Calendar ----------
export interface ListCalendarEventsResponse {
  events: CalendarEvent[];
}

// ---------- Team ----------
export interface ListTeamMembersResponse {
  items: TeamMember[];
}

// ---------- Telemetry ----------
export interface LogEvent {
  name: string;
  ts: number;
  level: "debug" | "info" | "warn" | "error";
  attrs?: Record<string, string | number | boolean | null>;
}
export interface LogBatchRequest {
  events: LogEvent[];
}

// ---------- Generic ----------
export interface SummaryResponseEnvelope {
  summary: MeetingSummary;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
