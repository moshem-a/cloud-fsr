import {
  Bolt,
  Globe,
  Logout,
  Play,
  Search,
  Settings as SettingsIcon,
} from "@scoach/ui/icons";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { signOut } from "../../../lib/firebase.ts";
import { useAuthStore } from "../../auth/store.ts";

export interface DashHeaderProps {
  onStartNew: () => void;
}

export function DashHeader({ onStartNew }: DashHeaderProps) {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const initials = user?.initials ?? "NL";
  const color = user?.color ?? "#1A73E8";
  const name = user?.name ?? "Noa Levi";
  const email = user?.email ?? "noalevi@google.com";

  async function handleSignOut() {
    setOpen(false);
    try {
      await signOut();
    } catch {
      /* dev mode */
    }
    clear();
    nav({ to: "/signin" });
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <img src="/supercloud-mark.svg" alt="" width={28} height={28} />
          <div className="brand-text">
            <div className="brand-name">SuperCloud</div>
            <div className="brand-sub">
              Sales Coach <span className="brand-tag">Internal</span>
            </div>
          </div>
        </div>
        <nav className="dash-nav">
          <Link to="/dashboard" activeProps={{ className: "active" }}>Dashboard</Link>
          <a>Meetings</a>
          <a>Clients</a>
          <a>Team</a>
          <a>Library</a>
        </nav>
      </div>
      <div className="topbar-center" />
      <div className="topbar-right">
        <button type="button" className="icon-btn" aria-label="Search">
          <Search size={18} />
        </button>
        <Link to="/settings" className="icon-btn" aria-label="Settings">
          <SettingsIcon size={18} />
        </Link>
        <button type="button" className="pill-btn primary" onClick={onStartNew}>
          <Play size={14} /> New meeting
        </button>
        <div className="user-menu" ref={ref}>
          <button
            type="button"
            className="avatar-me"
            style={{ background: color }}
            onClick={() => setOpen((o) => !o)}
            title={name}
          >
            {initials}
          </button>
          {open && (
            <div className="user-pop">
              <div className="user-pop-head">
                <div className="who-avatar lg" style={{ background: color }}>
                  {initials}
                </div>
                <div>
                  <div className="user-pop-name">{name}</div>
                  <div className="user-pop-email mono">{email}</div>
                </div>
              </div>
              <ul>
                <li onClick={() => { setOpen(false); nav({ to: "/settings" }); }}>
                  <SettingsIcon size={14} /> Settings
                </li>
                <li onClick={() => { setOpen(false); nav({ to: "/apikey" }); }}>
                  <Bolt size={14} /> Manage Gemini API key
                </li>
                <li onClick={() => setOpen(false)}>
                  <Globe size={14} /> Language
                </li>
              </ul>
              <button type="button" className="user-pop-out" onClick={handleSignOut}>
                <Logout size={12} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
