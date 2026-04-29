import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { authApi } from "../features/auth/api.ts";
import { useAuthStore } from "../features/auth/store.ts";
import { ApiError } from "../lib/http.ts";

/**
 * Layout route that requires:
 *   1. User is signed in (firebaseUid set)
 *   2. Gemini API key is configured (geminiKey in localStorage)
 *
 * IMPORTANT: a failed `/users/me` fetch does NOT log the user out.
 * Network errors / 5xx / unreachable api just leave `user=null` and surface
 * a non-blocking banner. We only force-signout on a real 401 from the api,
 * because that means our auth credential is genuinely invalid.
 */
export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const initialized = useAuthStore((s) => s.initialized);
  const firebaseUid = useAuthStore((s) => s.firebaseUid);
  const geminiKey = useAuthStore((s) => s.geminiKey);
  const clear = useAuthStore((s) => s.clear);

  const [profileError, setProfileError] = useState<string | null>(null);

  // Sign-in gate — only redirects when we're sure the user is not signed in.
  useEffect(() => {
    if (!initialized) return;
    if (!firebaseUid) {
      nav({ to: "/signin" });
    }
  }, [initialized, firebaseUid, nav]);

  // Fetch /users/me once signed-in. Do NOT redirect to /signin on failure
  // unless the api specifically rejects the credential with 401.
  useEffect(() => {
    if (!firebaseUid || user) return;
    authApi
      .fetchMe()
      .then((u) => {
        setUser(u);
        setProfileError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          clear();
          nav({ to: "/signin" });
          return;
        }
        // Transient: network error / 5xx / api unreachable. Stay signed-in,
        // surface a banner. The user can still navigate around.
        const msg = err instanceof Error ? err.message : "Profile fetch failed";
        setProfileError(msg);
      });
  }, [firebaseUid, user, setUser, clear, nav]);

  // Gemini key gate — fires on Firebase sign-in, NOT on /users/me success.
  // This way even if the api is unreachable, signed-in users still get prompted.
  // The /apikey route is the destination, so don't redirect away from it.
  useEffect(() => {
    if (!firebaseUid) return;
    if (geminiKey) return;
    if (window.location.pathname === "/apikey") return;
    nav({ to: "/apikey" });
  }, [firebaseUid, geminiKey, nav]);

  return (
    <>
      {profileError && (
        <div
          style={{
            background: "var(--gc-yellow-50)",
            color: "#7A4C00",
            padding: "8px 16px",
            fontSize: 13,
            borderBottom: "1px solid var(--border-soft)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Couldn't reach the profile service: {profileError}. You stay signed in; some features may be limited.</span>
          <button
            type="button"
            onClick={() => setProfileError(null)}
            style={{ background: "transparent", border: 0, cursor: "pointer", color: "inherit" }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <Outlet />
    </>
  );
}
