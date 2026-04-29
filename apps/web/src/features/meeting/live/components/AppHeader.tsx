import type { Meeting } from "@scoach/types";
import {
  Bolt,
  Chev,
  Globe,
  Mic,
  MicOff,
  Play,
  Stop,
} from "@scoach/ui/icons";

import { applyTheme, getStoredTheme, setStoredTheme, type Theme } from "../../../../lib/theme.ts";
import { type LangMode, useLiveMeetingStore } from "../store.ts";

export interface AppHeaderProps {
  meeting: Meeting;
  onToggleListening: () => void;
  onEnd: () => void;
}

function ThemeButton() {
  const setLatency = useLiveMeetingStore((s) => s.setLatencyMs); // satisfy eslint while we lock the type
  void setLatency;

  const handle = () => {
    const cur: Theme = (document.documentElement.getAttribute("data-theme") as Theme) || getStoredTheme();
    const next: Theme = cur === "dark" ? "light" : "dark";
    setStoredTheme(next);
    applyTheme(next);
  };

  // We render both icons and toggle which is shown via CSS so the button itself is stable.
  return (
    <button type="button" className="icon-btn" title="Toggle theme" onClick={handle}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" data-theme-icon="dark">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" data-theme-icon="light" style={{ display: "none" }}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}

function elapsed(startedAt: number | null) {
  if (!startedAt) return "00:00";
  const sec = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function AppHeader({ meeting, onToggleListening, onEnd }: AppHeaderProps) {
  const { listening, muted, langMode, latencyMs, startedAt, setLangMode, setMuted } = useLiveMeetingStore();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <img src="/supercloud-mark.svg" alt="SuperCloud" width={28} height={28} />
          <div className="brand-text">
            <div className="brand-name">SuperCloud</div>
            <div className="brand-sub">
              Sales Coach <span className="brand-tag">Internal</span>
            </div>
          </div>
        </div>

        <div className="meeting-chip">
          <div className="meeting-chip-dot" />
          <div>
            <div className="meeting-chip-title">
              {meeting.account.name}
              {meeting.account.deal ? ` · ${meeting.account.deal}` : ""}
            </div>
            <div className="meeting-chip-sub">
              {meeting.account.industry ?? meeting.title}
              {meeting.account.region ? ` · ${meeting.account.region}` : ""}
            </div>
          </div>
          <button type="button" className="meeting-chip-edit" title="Switch meeting">
            <Chev />
          </button>
        </div>
      </div>

      <div className="topbar-center">
        <div className="status-bar">
          <span className="live-dot" />
          <span className="status-bar-label">{listening ? "LIVE" : "PAUSED"}</span>
          <span className="status-bar-time">{elapsed(startedAt)}</span>
          <span className="status-bar-sep" />
          <span className="status-bar-meta">
            <Globe size={14} /> Hebrew ↔ English
          </span>
          {latencyMs != null && (
            <>
              <span className="status-bar-sep" />
              <span className="status-bar-meta">
                <Bolt size={14} /> {latencyMs}ms
              </span>
            </>
          )}
        </div>
      </div>

      <div className="topbar-right">
        <div className="seg">
          <button type="button" className={langMode === "en" ? "on" : ""} onClick={() => setLangMode("en")}>
            EN
          </button>
          <button type="button" className={langMode === "he" ? "on" : ""} onClick={() => setLangMode("he")}>
            עב
          </button>
          <button type="button" className={langMode === "bi" ? "on" : ""} onClick={() => setLangMode("bi")}>
            EN/עב
          </button>
        </div>

        <ThemeButton />

        <button
          type="button"
          className={`pill-btn ${muted ? "pill-muted" : ""}`}
          onClick={() => setMuted(!muted)}
        >
          {muted ? <MicOff size={16} /> : <Mic size={16} />}
          <span>{muted ? "Listening muted" : "Mute listening"}</span>
        </button>

        <button
          type="button"
          className={`pill-btn primary ${listening ? "recording" : ""}`}
          onClick={listening ? onEnd : onToggleListening}
        >
          {listening ? <Stop size={14} /> : <Play size={14} />}
          <span>{listening ? "End meeting" : "Start listening"}</span>
        </button>

        <div className="avatar-me" title="Noa Levi">
          NL
        </div>
      </div>
    </header>
  );
}

type LangModeUnion = LangMode; // re-export to satisfy bundler if elsewhere imports
export type { LangModeUnion };
