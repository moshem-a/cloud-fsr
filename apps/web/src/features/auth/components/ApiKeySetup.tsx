import { Button, Card, Field, useToast } from "@scoach/ui";
import { Eye, EyeOff, Lock } from "@scoach/ui/icons";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { authApi } from "../api.ts";
import { useAuthStore } from "../store.ts";

const KEY_RX = /^AIza[\w-]{20,}$/;

export function ApiKeySetup() {
  const setKey = useAuthStore((s) => s.setGeminiKey);
  const stored = useAuthStore((s) => s.geminiKey);
  const nav = useNavigate();
  const toast = useToast();

  const [key, setKeyLocal] = useState(stored ?? "");
  const [show, setShow] = useState(false);
  const [verified, setVerified] = useState(Boolean(stored));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    setError(null);
    if (!KEY_RX.test(key)) {
      setError('Key format invalid (expected "AIza…")');
      return;
    }
    setBusy(true);
    try {
      const r = await authApi.verifyGeminiKey(key);
      if (!r.valid) {
        setError(r.error ?? "Verification failed");
        return;
      }
      setVerified(true);
      toast.push({ tone: "success", message: `Key verified · ${r.modelAvailable ?? "Gemini available"}` });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleSave() {
    setKey(key);
    nav({ to: "/dashboard" });
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

      <div className="auth-shell wide">
        <div className="auth-progress">
          <span className="auth-step done">1 · Sign in</span>
          <span className="auth-step active">2 · Connect Gemini</span>
          <span className="auth-step pending">3 · Start coaching</span>
        </div>

      <h1 className="auth-headline">Connect your Gemini API key</h1>
      <p className="auth-sub">
        We use your personal Gemini key only for the Quiet Ask feature (private questions during a call).
        Live hints, summaries, and analysis run server-side via Vertex AI on the SuperCloud account.
      </p>

      <Field label="Gemini API key" hint="Get one from aistudio.google.com/apikey.">
        <div className="key-input">
          <Lock size={14} />
          <input
            type={show ? "text" : "password"}
            value={key}
            onChange={(e) => {
              setKeyLocal(e.target.value);
              setVerified(false);
            }}
            placeholder="AIzaSy…"
            spellCheck={false}
          />
          <button
            type="button"
            aria-label={show ? "Hide key" : "Show key"}
            className="icon-btn icon-btn-sm"
            onClick={() => setShow((v) => !v)}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </Field>

      {error && <div className="auth-error">{error}</div>}

      <div className="auth-actions">
        <Button variant="ghost" onClick={handleVerify} loading={busy} disabled={busy || !key}>
          {busy ? "Verifying…" : verified ? "✓ Verified" : "Verify key"}
        </Button>
        {/* Save is allowed even without server-side verify, since the api may be unreachable.
            Client-side regex check is enough to prevent obviously-broken keys. */}
        <Button variant="primary" onClick={handleSave} disabled={!key || !KEY_RX.test(key)}>
          Save & continue
        </Button>
      </div>

        <Card className="auth-callout">
          <strong>Where is the key stored?</strong>
          <p>
            Your key is kept in this browser's local storage and never sent to our servers. Quiet Ask requests go directly to{" "}
            <code>generativelanguage.googleapis.com</code>.
          </p>
        </Card>
      </div>
    </div>
  );
}
