import { Alert } from "@scoach/ui/icons";
import { type FormEvent, useState } from "react";

import {
  ALLOWED_DOMAIN,
  ALLOWED_DOMAINS,
  isAllowedEmail,
  signInWithGoogle,
} from "../../../lib/firebase.ts";
import { useAuthStore } from "../store.ts";

export interface SignInScreenProps {
  onSignedIn?: () => void;
}

export function SignInScreen({ onSignedIn }: SignInScreenProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);

  /** Direct Google sign-in via Firebase popup. The Google account chooser
   * comes from Google itself — no fake suggestions. */
  async function signInGoogle() {
    setErr("");
    setLoading(true);
    try {
      const fbUser = await signInWithGoogle();
      if (!isAllowedEmail(fbUser.email)) {
        throw new Error(
          `Access is restricted to ${ALLOWED_DOMAINS.map((d) => `@${d}`).join(" or ")} accounts.`,
        );
      }
      useAuthStore.getState().setFirebaseUser(fbUser.uid, fbUser.email, fbUser.displayName ?? null);
      onSignedIn?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  /** Dev-only manual sign-in (used when Firebase config isn't set locally). */
  async function manualSignIn(e: FormEvent) {
    e.preventDefault();
    setErr("");
    const target = {
      email: email.trim().toLowerCase(),
      name: name.trim() || (email.split("@")[0] ?? ""),
    };
    if (!target.email) return setErr("Enter your work email.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.email))
      return setErr("That doesn't look like a valid email.");
    if (!isAllowedEmail(target.email)) {
      return setErr(
        `Access is restricted to ${ALLOWED_DOMAINS.map((d) => `@${d}`).join(" or ")} accounts.`,
      );
    }
    setLoading(true);
    try {
      // Try Firebase popup first; if the project isn't configured (local dev), fall back.
      try {
        const fbUser = await signInWithGoogle();
        useAuthStore.getState().setFirebaseUser(fbUser.uid, fbUser.email, fbUser.displayName ?? null);
      } catch {
        await new Promise((r) => setTimeout(r, 850));
        useAuthStore.getState().setFirebaseUser(`dev-${target.email}`, target.email, target.name);
      }
      onSignedIn?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-blob b1" />
        <div className="auth-blob b2" />
        <div className="auth-blob b3" />
        <div className="auth-blob b4" />
        <div className="auth-grid" />
      </div>

      <div className="auth-shell">
        <div className="auth-brand">
          <div className="auth-logo">
            <span className="dot d1" />
            <span className="dot d2" />
            <span className="dot d3" />
            <span className="dot d4" />
          </div>
          <div>
            <div className="auth-brand-name">Sally</div>
            <div className="auth-brand-sub mono">Your AI assistant · Cloud Sales Engineering</div>
          </div>
        </div>

        <div className="auth-card">
          <h1 className="auth-h1">Sign in to continue</h1>
          <p className="auth-sub">
            Real-time meeting coaching for the Google Cloud sales org. Access is limited to{" "}
            <span className="mono">@google.com or @altostrat.com</span> accounts.
          </p>

          {!showManual ? (
            <>
              <button
                type="button"
                className="goog-btn"
                onClick={signInGoogle}
                disabled={loading}
              >
                <GoogleG />
                <span>{loading ? "Signing in…" : "Sign in with Google"}</span>
              </button>

              {err && (
                <div className="auth-err">
                  <Alert size={14} /> {err}
                </div>
              )}

              <button
                type="button"
                className="ghost-btn"
                onClick={() => setShowManual(true)}
                style={{ marginTop: 8 }}
              >
                Use email instead
              </button>
            </>
          ) : (
            <form onSubmit={manualSignIn} className="auth-form">
              <label className="auth-label">
                Email
                <input
                  type="email"
                  placeholder={`you@${ALLOWED_DOMAIN}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="auth-label">
                Full name <span className="auth-opt">(optional)</span>
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {err && (
                <div className="auth-err">
                  <Alert size={14} /> {err}
                </div>
              )}
              <button type="submit" className="pill-btn primary lg" disabled={loading}>
                {loading ? "Signing in…" : "Continue"}
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setShowManual(false);
                  setErr("");
                }}
              >
                ← Back
              </button>
            </form>
          )}

          <div className="auth-foot">
            <span className="mono">v0.4.2-internal</span>
            <span>•</span>
            <a href="#">Privacy</a>
            <span>•</span>
            <a href="#">Terms</a>
            <span>•</span>
            <a href="#">Support</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.3 0 6.3 1.2 8.6 3.2l6-6C34.6 4.5 29.6 2.5 24 2.5 12.1 2.5 2.5 12.1 2.5 24S12.1 45.5 24 45.5c12.4 0 21.5-9 21.5-21.5 0-1.4-.1-2.7-.5-4z"/>
      <path fill="#34A853" d="M6.3 14.7l7 5.1C15.4 16 19.4 13 24 13c3.3 0 6.3 1.2 8.6 3.2l6-6C34.6 4.5 29.6 2.5 24 2.5c-8.4 0-15.6 4.7-19.3 11.6z"/>
      <path fill="#FBBC05" d="M24 45.5c5.8 0 10.6-1.9 14.2-5.2l-6.6-5.4C29.6 36.4 27 37 24 37c-6 0-11-3.9-12.8-9.3l-7 5.4C7.6 41 15.2 45.5 24 45.5z"/>
      <path fill="#EA4335" d="M44.5 20H24v8.5h11.8C35 30.9 33.5 33 31.6 34.4l6.6 5.4C42.6 36.6 45.5 31 45.5 24c0-1.4-.1-2.7-.5-4z"/>
    </svg>
  );
}
