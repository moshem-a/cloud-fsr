import { Button, useToast } from "@scoach/ui";
import { Logout } from "@scoach/ui/icons";
import type { HintPace, UserLanguage, UserRole, UserTeam } from "@scoach/types";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { signOut } from "../../../lib/firebase.ts";
import { applyDirection, dirForLang, setStoredLang, type UiLang } from "../../../lib/i18n.ts";
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

const UI_STRINGS: Record<string, Record<string, string>> = {
  en: {
    settings: "Settings",
    back: "← Back",
    save: "Save changes",
    saving: "Saving…",
    profile: "Profile",
    geminiApi: "Gemini API",
    language: "Language",
    coaching: "Coaching",
    signOut: "Sign out",
    fullName: "Full name",
    email: "Email",
    emailHint: "Synced from your Google account.",
    role: "Role",
    team: "Team",
    geminiTitle: "Gemini API key",
    keySet: "Key configured",
    keyUnset: "No key set",
    keyDesc: "Used only for Quiet Ask. Live hints + summary go through Sally's Vertex AI account. Stored in this browser's local storage; never sent to our servers.",
    replaceKey: "Replace key",
    setupKey: "Set up key",
    removeKey: "Remove key",
    keyRemoved: "Key removed",
    displayLang: "Display language",
    langDesc: "Choose the UI language. Hebrew + Arabic auto-flip the layout to RTL. English is always available for meetings.",
    meetingLangNote: "Meeting language default will include English + your selected UI language.",
    hintPace: "Hint pace",
    autoSummary: "Auto-generate summary",
    autoSummaryDesc: "Internal summary + client email draft within 10 seconds of meeting end.",
    quietMode: "Start in Quiet mode",
    quietModeDesc: "Coach listens but only surfaces hints when you ask.",
    coachingTitle: "Coaching behavior",
    saved: "Saved",
  },
  he: {
    settings: "הגדרות",
    back: "← חזרה",
    save: "שמור שינויים",
    saving: "שומר…",
    profile: "פרופיל",
    geminiApi: "מפתח Gemini",
    language: "שפה",
    coaching: "אימון",
    signOut: "התנתק",
    fullName: "שם מלא",
    email: "דוא״ל",
    emailHint: "מסונכרן מחשבון Google שלך.",
    role: "תפקיד",
    team: "צוות",
    geminiTitle: "מפתח API של Gemini",
    keySet: "המפתח מוגדר",
    keyUnset: "לא הוגדר מפתח",
    keyDesc: "משמש רק ל-Quiet Ask. רמזים חיים + סיכום עוברים דרך חשבון Vertex AI של Sally.",
    replaceKey: "החלף מפתח",
    setupKey: "הגדר מפתח",
    removeKey: "הסר מפתח",
    keyRemoved: "המפתח הוסר",
    displayLang: "שפת תצוגה",
    langDesc: "בחר את שפת הממשק. עברית + ערבית מפעילות RTL אוטומטית. אנגלית תמיד זמינה לפגישות.",
    meetingLangNote: "ברירת מחדל של שפת הפגישה תכלול אנגלית + השפה שבחרת.",
    hintPace: "קצב רמזים",
    autoSummary: "סיכום אוטומטי",
    autoSummaryDesc: "סיכום פנימי + טיוטת מייל ללקוח תוך 10 שניות מסיום הפגישה.",
    quietMode: "התחל במצב שקט",
    quietModeDesc: "המאמן מקשיב אך מציף רמזים רק כשאתה מבקש.",
    coachingTitle: "התנהגות אימון",
    saved: "נשמר",
  },
  fr: {
    settings: "Paramètres",
    back: "← Retour",
    save: "Enregistrer",
    saving: "Enregistrement…",
    profile: "Profil",
    geminiApi: "API Gemini",
    language: "Langue",
    coaching: "Coaching",
    signOut: "Déconnexion",
    fullName: "Nom complet",
    email: "E-mail",
    emailHint: "Synchronisé depuis votre compte Google.",
    role: "Rôle",
    team: "Équipe",
    geminiTitle: "Clé API Gemini",
    keySet: "Clé configurée",
    keyUnset: "Aucune clé définie",
    keyDesc: "Utilisée uniquement pour Quiet Ask. Les indices en direct + résumé passent par le compte Vertex AI de Sally.",
    replaceKey: "Remplacer la clé",
    setupKey: "Configurer la clé",
    removeKey: "Supprimer la clé",
    keyRemoved: "Clé supprimée",
    displayLang: "Langue d'affichage",
    langDesc: "Choisissez la langue de l'interface. L'anglais est toujours disponible pour les réunions.",
    meetingLangNote: "La langue par défaut de la réunion inclura l'anglais + votre langue sélectionnée.",
    hintPace: "Rythme des indices",
    autoSummary: "Résumé automatique",
    autoSummaryDesc: "Résumé interne + brouillon d'e-mail client dans les 10 secondes après la fin de la réunion.",
    quietMode: "Démarrer en mode silencieux",
    quietModeDesc: "Le coach écoute mais ne propose des indices que lorsque vous le demandez.",
    coachingTitle: "Comportement du coaching",
    saved: "Enregistré",
  },
  es: {
    settings: "Configuración",
    back: "← Volver",
    save: "Guardar cambios",
    saving: "Guardando…",
    profile: "Perfil",
    geminiApi: "API Gemini",
    language: "Idioma",
    coaching: "Coaching",
    signOut: "Cerrar sesión",
    fullName: "Nombre completo",
    email: "Correo",
    emailHint: "Sincronizado desde tu cuenta de Google.",
    role: "Rol",
    team: "Equipo",
    geminiTitle: "Clave API de Gemini",
    keySet: "Clave configurada",
    keyUnset: "Sin clave",
    keyDesc: "Se usa solo para Quiet Ask. Las pistas en vivo + resumen van a través de la cuenta Vertex AI de Sally.",
    replaceKey: "Reemplazar clave",
    setupKey: "Configurar clave",
    removeKey: "Eliminar clave",
    keyRemoved: "Clave eliminada",
    displayLang: "Idioma de la interfaz",
    langDesc: "Elige el idioma de la interfaz. El inglés siempre está disponible para reuniones.",
    meetingLangNote: "El idioma predeterminado de la reunión incluirá inglés + tu idioma seleccionado.",
    hintPace: "Ritmo de pistas",
    autoSummary: "Resumen automático",
    autoSummaryDesc: "Resumen interno + borrador de correo al cliente en 10 segundos tras finalizar la reunión.",
    quietMode: "Iniciar en modo silencioso",
    quietModeDesc: "El coach escucha pero solo muestra pistas cuando lo pides.",
    coachingTitle: "Comportamiento del coaching",
    saved: "Guardado",
  },
  de: {
    settings: "Einstellungen",
    back: "← Zurück",
    save: "Änderungen speichern",
    saving: "Speichern…",
    profile: "Profil",
    geminiApi: "Gemini API",
    language: "Sprache",
    coaching: "Coaching",
    signOut: "Abmelden",
    fullName: "Vollständiger Name",
    email: "E-Mail",
    emailHint: "Synchronisiert mit Ihrem Google-Konto.",
    role: "Rolle",
    team: "Team",
    geminiTitle: "Gemini API-Schlüssel",
    keySet: "Schlüssel konfiguriert",
    keyUnset: "Kein Schlüssel gesetzt",
    keyDesc: "Wird nur für Quiet Ask verwendet. Live-Hinweise + Zusammenfassung laufen über Sallys Vertex AI-Konto.",
    replaceKey: "Schlüssel ersetzen",
    setupKey: "Schlüssel einrichten",
    removeKey: "Schlüssel entfernen",
    keyRemoved: "Schlüssel entfernt",
    displayLang: "Anzeigesprache",
    langDesc: "Wählen Sie die UI-Sprache. Englisch ist immer für Meetings verfügbar.",
    meetingLangNote: "Die Standard-Meetingsprache umfasst Englisch + Ihre ausgewählte Sprache.",
    hintPace: "Hinweistempo",
    autoSummary: "Automatische Zusammenfassung",
    autoSummaryDesc: "Interne Zusammenfassung + E-Mail-Entwurf innerhalb von 10 Sekunden nach Meetingende.",
    quietMode: "Im stillen Modus starten",
    quietModeDesc: "Der Coach hört zu, zeigt aber nur Hinweise an, wenn Sie danach fragen.",
    coachingTitle: "Coaching-Verhalten",
    saved: "Gespeichert",
  },
  ar: {
    settings: "الإعدادات",
    back: "← رجوع",
    save: "حفظ التغييرات",
    saving: "جارٍ الحفظ…",
    profile: "الملف الشخصي",
    geminiApi: "مفتاح Gemini",
    language: "اللغة",
    coaching: "التدريب",
    signOut: "تسجيل الخروج",
    fullName: "الاسم الكامل",
    email: "البريد الإلكتروني",
    emailHint: "متزامن من حساب Google الخاص بك.",
    role: "الدور",
    team: "الفريق",
    geminiTitle: "مفتاح API Gemini",
    keySet: "المفتاح مُعد",
    keyUnset: "لا يوجد مفتاح",
    keyDesc: "يُستخدم فقط لـ Quiet Ask. التلميحات المباشرة + الملخص تمر عبر حساب Vertex AI الخاص بـ Sally.",
    replaceKey: "استبدال المفتاح",
    setupKey: "إعداد المفتاح",
    removeKey: "إزالة المفتاح",
    keyRemoved: "تم إزالة المفتاح",
    displayLang: "لغة العرض",
    langDesc: "اختر لغة الواجهة. العربية + العبرية تفعّل RTL تلقائياً. الإنجليزية متاحة دائماً للاجتماعات.",
    meetingLangNote: "ستتضمن لغة الاجتماع الافتراضية الإنجليزية + اللغة المختارة.",
    hintPace: "وتيرة التلميحات",
    autoSummary: "ملخص تلقائي",
    autoSummaryDesc: "ملخص داخلي + مسودة بريد إلكتروني للعميل خلال 10 ثوانٍ من انتهاء الاجتماع.",
    quietMode: "البدء في الوضع الهادئ",
    quietModeDesc: "المدرب يستمع لكنه يعرض التلميحات فقط عندما تطلب.",
    coachingTitle: "سلوك التدريب",
    saved: "تم الحفظ",
  },
};

function t(lang: string, key: string): string {
  const baseLang = lang.split("-")[0] ?? "en";
  return UI_STRINGS[baseLang]?.[key] ?? UI_STRINGS.en?.[key] ?? key;
}

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
  const [language, setLanguageState] = useState<UserLanguage>(user?.settings.language ?? "en");
  const [hintPace, setHintPace] = useState<HintPace>(user?.settings.hintPace ?? "balanced");
  const [autoSummary, setAutoSummary] = useState(user?.settings.autoSummary ?? true);
  const [quietByDefault, setQuietByDefault] = useState(user?.settings.quietByDefault ?? false);
  const [keepTranscript, setKeepTranscript] = useState(user?.settings.keepTranscript !== false);
  const [saving, setSaving] = useState(false);

  function setLanguage(lang: UserLanguage) {
    setLanguageState(lang);
    const baseLang = lang.split("-")[0] ?? "en";
    if (baseLang === "he" || baseLang === "ar" || baseLang === "en") {
      setStoredLang(baseLang as UiLang);
      applyDirection(dirForLang(baseLang as UiLang));
    } else {
      setStoredLang("en");
      applyDirection("ltr");
    }
    document.documentElement.lang = baseLang;
  }

  async function saveAll() {
    setSaving(true);
    try {
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
              keepTranscript,
            },
          }
        : null;
      if (next) setUser(next);
      toast.push({ tone: "success", message: t(language, "saved") });
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

  const meetingLangs = language === "en"
    ? "English"
    : `English + ${LANGS.find((l) => l.value === language)?.label ?? language}`;

  return (
    <div className="settings-page">
      <header className="settings-top">
        <button type="button" className="ghost-btn" onClick={() => nav({ to: "/dashboard" })}>
          {t(language, "back")}
        </button>
        <div className="settings-title-wrap">
          <h1 className="settings-title">{t(language, "settings")}</h1>
        </div>
        <div className="settings-top-actions">
          <Button variant="primary" onClick={saveAll} loading={saving}>
            {saving ? t(language, "saving") : t(language, "save")}
          </Button>
        </div>
      </header>

      <div className="settings-body">
        <nav className="settings-nav">
          <ul>
            {([
              { id: "profile" as TabId, label: t(language, "profile") },
              { id: "key" as TabId, label: t(language, "geminiApi") },
              { id: "language" as TabId, label: t(language, "language") },
              { id: "coaching" as TabId, label: t(language, "coaching") },
            ]).map((item) => (
              <li
                key={item.id}
                className={tab === item.id ? "on" : ""}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </li>
            ))}
          </ul>
          <button type="button" className="signout-btn" onClick={handleSignOut}>
            <Logout size={16} /> {t(language, "signOut")}
          </button>
        </nav>

        <main className="settings-main">
          {tab === "profile" && (
            <div className="set-section">
              <h2>{t(language, "profile")}</h2>
              <div className="set-grid">
                <div className="set-field">
                  <div className="set-field-top">
                    <span className="set-field-label">{t(language, "fullName")}</span>
                  </div>
                  <input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
                </div>
                <div className="set-field">
                  <div className="set-field-top">
                    <span className="set-field-label">{t(language, "email")}</span>
                    <span className="set-field-hint">{t(language, "emailHint")}</span>
                  </div>
                  <input className="ro" value={user?.email ?? ""} disabled />
                </div>
                <div className="set-field">
                  <div className="set-field-top">
                    <span className="set-field-label">{t(language, "role")}</span>
                  </div>
                  <select value={draftRole} onChange={(e) => setDraftRole(e.target.value as UserRole)}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="set-field">
                  <div className="set-field-top">
                    <span className="set-field-label">{t(language, "team")}</span>
                  </div>
                  <select value={draftTeam} onChange={(e) => setDraftTeam(e.target.value as UserTeam)}>
                    {TEAMS.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {tab === "key" && (
            <div className="set-section">
              <h2>{t(language, "geminiTitle")}</h2>
              <div className="key-status">
                <span className={`key-dot ${geminiKey ? "ok" : "warn"}`} />
                <div>
                  <div className="key-status-title">{geminiKey ? t(language, "keySet") : t(language, "keyUnset")}</div>
                  <div className="key-status-sub">{t(language, "keyDesc")}</div>
                </div>
                {geminiKey && <span className="meta-pill">Active</span>}
              </div>
              <div className="key-actions">
                <Button variant="ghost" onClick={() => nav({ to: "/apikey" })}>
                  {geminiKey ? t(language, "replaceKey") : t(language, "setupKey")}
                </Button>
                {geminiKey && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setGeminiKey(null);
                      toast.push({ tone: "info", message: t(language, "keyRemoved") });
                    }}
                  >
                    {t(language, "removeKey")}
                  </Button>
                )}
              </div>
            </div>
          )}

          {tab === "language" && (
            <div className="set-section">
              <h2>{t(language, "displayLang")}</h2>
              <p className="set-section-sub">{t(language, "langDesc")}</p>
              <div className="lang-grid">
                {LANGS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    className={`lang-card ${language === l.value ? "on" : ""}`}
                    onClick={() => setLanguage(l.value)}
                  >
                    <span className="lang-flag" aria-hidden>{l.flag}</span>
                    <div className="lang-meta">
                      <div className="lang-label">{l.label}</div>
                      <div className="lang-code">{l.value}</div>
                    </div>
                    {language === l.value && (
                      <span className="lang-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="set-callout" style={{ marginTop: 14 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                <div>
                  <strong>{t(language, "meetingLangNote")}</strong>
                  <div style={{ marginTop: 4 }}>Meeting language: <strong>{meetingLangs}</strong></div>
                </div>
              </div>
            </div>
          )}

          {tab === "coaching" && (
            <div className="set-section">
              <h2>{t(language, "coachingTitle")}</h2>
              <div className="set-field">
                <div className="set-field-top">
                  <span className="set-field-label">{t(language, "hintPace")}</span>
                </div>
                <div className="seg-lg">
                  {(["sparse", "balanced", "chatty"] as HintPace[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={hintPace === p ? "on" : ""}
                      onClick={() => setHintPace(p)}
                    >
                      <span className="seg-label">{p[0]!.toUpperCase() + p.slice(1)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="toggle-row" onClick={() => setAutoSummary(!autoSummary)}>
                <div>
                  <div className="toggle-row-title">{t(language, "autoSummary")}</div>
                  <div className="toggle-row-sub">{t(language, "autoSummaryDesc")}</div>
                </div>
                <div className={`toggle ${autoSummary ? "on" : ""}`}>
                  <div className="toggle-knob" />
                </div>
              </div>
              <div className="toggle-row" onClick={() => setQuietByDefault(!quietByDefault)}>
                <div>
                  <div className="toggle-row-title">{t(language, "quietMode")}</div>
                  <div className="toggle-row-sub">{t(language, "quietModeDesc")}</div>
                </div>
                <div className={`toggle ${quietByDefault ? "on" : ""}`}>
                  <div className="toggle-knob" />
                </div>
              </div>
              <div className="toggle-row" onClick={() => setKeepTranscript(!keepTranscript)}>
                <div>
                  <div className="toggle-row-title">Keep meeting transcripts</div>
                  <div className="toggle-row-sub">
                    {keepTranscript
                      ? "Transcripts are kept after summary generation. You can delete them manually from each meeting."
                      : "Transcripts are auto-deleted after summary generation. Summaries are always kept."}
                  </div>
                </div>
                <div className={`toggle ${keepTranscript ? "on" : ""}`}>
                  <div className="toggle-knob" />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
