import type { HexColor } from "./index.ts";

export type UserRole =
  | "Sr. Cloud SE"
  | "Cloud SE"
  | "Sales Manager"
  | "Account Executive"
  | "Customer Engineer"
  | "Solutions Architect"
  | "SE Manager";

export type UserTeam =
  | "EMEA Cloud Sales"
  | "NAMER Cloud Sales"
  | "APAC Cloud Sales"
  | "LATAM Cloud Sales"
  | "Strategic Accounts";

export type UserLanguage =
  | "en"
  | "he"
  | "es"
  | "fr"
  | "de"
  | "pt-BR"
  | "ja"
  | "ko"
  | "zh-CN"
  | "ar";

export type Timezone =
  | "Europe/London"
  | "Asia/Jerusalem"
  | "America/New_York"
  | "America/Los_Angeles"
  | "Asia/Tokyo";

export type HintPace = "sparse" | "balanced" | "chatty";

export interface UserProfile {
  name: string;
  role: UserRole;
  team: UserTeam;
  timezone: Timezone;
  email: string;
  initials: string;
  color: HexColor;
}

export interface UserSettings {
  language: UserLanguage;
  hintPace: HintPace;
  autoSummary: boolean;
  quietByDefault: boolean;
}

export interface User extends UserProfile {
  uid: string;
  settings: UserSettings;
  geminiKeyVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  uid: string;
  name: string;
  role: string;
  initials: string;
  color: HexColor;
  email: string;
  external?: boolean;
  online?: boolean;
}
