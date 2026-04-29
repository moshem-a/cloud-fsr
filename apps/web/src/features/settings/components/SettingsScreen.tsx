import { Button, Card, Field, Tabs, ToggleRow, useToast } from "@scoach/ui";
import { Logout } from "@scoach/ui/icons";
import type { HintPace, UserLanguage, UserRole, UserTeam } from "@scoach/types";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { signOut } from "../../../lib/firebase.ts";
import { authApi } from "../../auth/api.ts";
import { useAuthStore } from "../../auth/store.ts";

type TabId = "profile" | "key" | "language" | "coaching";

const ROLES: UserRole[] = [
  "Sr. Cloud SE",
  "Cloud SE",
  "Sales Manager",
  "Account Executive",
  "Customer Engineer",
  "Solutions Architect",
  "SE Manager",
];
const TEAMS: UserTeam[] = ["EMEA Cloud Sales", "NAMER Cloud Sales", "APAC Cloud Sales", "LATAM Cloud Sales", "Strategic Accounts"];
const LANGS: { value: UserLanguage; label: string; flag: string }[] = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "he", label: "עברית", flag: "🇮🇱" },
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "pt-BR", label: "Português (Brasil)", flag: "🇧🇷" },
  { value: "ja", label: "日本語", flag: "🇯🇵" },
  { value: "ko", label: "한국어", flag: "🇰🇷" },
  { value: "zh-CN", label: "中文 (简体)", flag: "🇨🇳" },
  { value: "ar", label: "العربية", flag: "🇸🇦" },
];

export function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  const geminiKey = useAuthStore((s) => s.geminiKey);
  const setGeminiKey = useAuthStore((s) => s.setGeminiKey);

  const nav = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState<TabId>("profile");
  const [draftName, setDraftName] = useState(user?.name ?? "");
  const [draftRole, setDraftRole] = useState<UserRole>(user?.role ?? "Sr. Cloud SE");
  const [draftTeam, setDraftTeam] = useState<UserTeam>(user?.team ?? "EMEA Cloud Sales");
  const [language, setLanguage] = useState<UserLanguage>(user?.settings.language ?? "en");
  const [hintPace, setHintPace] = useState<HintPace>(user?.settings.hintPace ?? "balanced");
  const [autoSummary, setAutoSummary] = useState(user?.settings.autoSummary ?? true);
  const [quietByDefault, setQuietByDefault] = useState(user?.settings.quietByDefault ?? false);
  const [saving, setSaving] = useState(false);

  async function saveAll() {
    setSaving(true);
    try {
      // Sprint 2 stub: PUT both endpoints. MSW handlers return updated user.
      await Promise.resolve();
      const next = user
        ? {
            ...user,
            name: draftName,
            role: draftRole,
            team: draftTeam,
            settings: {
              ...user.settings,
              language,
              hintPace,
              autoSummary,
              quietByDefault,
            },
          }
        : null;
      if (next) setUser(next);
      toast.push({ tone: "success", message: "Saved" });
    } catch (err) {
      toast.push({ tone: "error", message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      await Promise.resolve(authApi.signOut?.());
    } catch {}
    try {
      await signOut();
    } catch {}
    clear();
    nav({ to: "/signin" });
  }

  return (
    <div className="settings">
      <header className="settings-top">
        <button type="button" className="ghost-btn" onClick={() => nav({ to: "/dashboard" })}>
          ← Back
        </button>
        <h1>Settings</h1>
        <Button variant="primary" onClick={saveAll} loading={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </header>

      <div className="settings-body">
        <aside className="settings-side">
          <Tabs<TabId>
            tabs={[
              { value: "profile", label: "Profile" },
              { value: "key", label: "Gemini API" },
              { value: "language", label: "Language" },
              { value: "coaching", label: "Coaching" },
            ]}
            value={tab}
            onChange={setTab}
          />
          <button type="button" className="settings-signout" onClick={handleSignOut}>
            <Logout size={16} /> Sign out
          </button>
        </aside>

        <main className="settings-main">
          {tab === "profile" && (
            <section>
              <h2>Profile</h2>
              <Field label="Full name">
                <input className="setup-input" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
              </Field>
              <Field label="Email" hint="Synced from your Google account.">
                <input className="setup-input" value={user?.email ?? ""} disabled />
              </Field>
              <Field label="Role">
                <select className="setup-input" value={draftRole} onChange={(e) => setDraftRole(e.target.value as UserRole)}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Team">
                <select className="setup-input" value={draftTeam} onChange={(e) => setDraftTeam(e.target.value as UserTeam)}>
                  {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </section>
          )}

          {tab === "key" && (
            <section>
              <h2>Gemini API key</h2>
              <Card className="auth-callout">
                <strong>{geminiKey ? "Key configured" : "No key set"}</strong>
                <p>
                  Used only for Quiet Ask. Live hints + summary go through SuperCloud's Vertex AI account.
                  Stored in this browser's local storage; never sent to our servers.
                </p>
              </Card>
              <div className="auth-actions">
                <Button variant="ghost" onClick={() => nav({ to: "/apikey" })}>
                  {geminiKey ? "Replace key" : "Set up key"}
                </Button>
                {geminiKey && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setGeminiKey(null);
                      toast.push({ tone: "info", message: "Key removed" });
                    }}
                  >
                    Remove key
                  </Button>
                )}
              </div>
            </section>
          )}

          {tab === "language" && (
            <section>
              <h2>Display language</h2>
              <p className="muted">Choose the UI language. Hebrew + Arabic auto-flip the layout to RTL.</p>
              <div className="lang-grid">
                {LANGS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    className={`lang-card ${language === l.value ? "on" : ""}`}
                    onClick={() => setLanguage(l.value)}
                  >
                    <span className="lang-flag" aria-hidden>{l.flag}</span>
                    <span className="lang-name">{l.label}</span>
                    <span className="lang-code">{l.value}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {tab === "coaching" && (
            <section>
              <h2>Coaching behavior</h2>
              <Field label="Hint pace">
                <div className="seg">
                  {(["sparse", "balanced", "chatty"] as HintPace[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={hintPace === p ? "on" : ""}
                      onClick={() => setHintPace(p)}
                    >
                      {p[0]!.toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </Field>
              <ToggleRow
                label="Auto-generate summary"
                description="Internal summary + client email draft within 10 seconds of meeting end."
                checked={autoSummary}
                onChange={setAutoSummary}
              />
              <ToggleRow
                label="Start in Quiet mode"
                description="Coach listens but only surfaces hints when you ask."
                checked={quietByDefault}
                onChange={setQuietByDefault}
              />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
