import type { User } from "@scoach/types";
import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";

import { onAuthChange } from "../../lib/firebase.ts";

export interface AuthState {
  /** Bootstrapping flag — true once we've checked Firebase / hydrated from storage. */
  initialized: boolean;
  /** Firebase user info we care about. Persisted so reloads don't sign-out. */
  firebaseUid: string | null;
  email: string | null;
  /** Server profile (from /users/me). NOT persisted — refetched on reload. */
  user: User | null;
  /** User's Gemini API key (browser-local; only used for Quiet Ask). Persisted. */
  geminiKey: string | null;
  /** Google OAuth access token for Calendar API. Persisted. */
  googleAccessToken: string | null;

  setFirebaseUser: (uid: string | null, email: string | null) => void;
  setUser: (user: User | null) => void;
  setGeminiKey: (key: string | null) => void;
  setGoogleAccessToken: (token: string | null) => void;
  clear: () => void;
  /** Mark bootstrap done (after hydrate or onAuthChange first-fire). */
  markInitialized: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    subscribeWithSelector((set) => ({
      initialized: false,
      firebaseUid: null,
      email: null,
      user: null,
      geminiKey: null,
      googleAccessToken: null,

      setFirebaseUser: (uid, email) =>
        set({ firebaseUid: uid, email, initialized: true }),
      setUser: (user) => set({ user }),
      setGeminiKey: (key) => set({ geminiKey: key }),
      setGoogleAccessToken: (token) => set({ googleAccessToken: token }),
      clear: () =>
        set({
          firebaseUid: null,
          email: null,
          user: null,
          googleAccessToken: null,
          initialized: true,
        }),
      markInitialized: () => set({ initialized: true }),
    })),
    {
      name: "scoach.auth",
      // Only persist the bits we want to survive a page reload.
      partialize: (s) => ({
        firebaseUid: s.firebaseUid,
        email: s.email,
        geminiKey: s.geminiKey,
        googleAccessToken: s.googleAccessToken,
      }),
    },
  ),
);

/**
 * Wires up Firebase auth state subscription. Call once at app bootstrap.
 *
 * Behavior:
 * - If Firebase IS configured (env vars set), trust Firebase's onAuthStateChanged
 *   as the source of truth — overwrite the persisted store with whatever Firebase
 *   reports.
 * - If Firebase is NOT configured (dev with no .env.local), keep whatever was
 *   persisted to localStorage and just mark initialized=true.
 */
export function bootstrapAuth(): () => void {
  try {
    return onAuthChange((u) => {
      useAuthStore.getState().setFirebaseUser(u?.uid ?? null, u?.email ?? null);
    });
  } catch {
    // No Firebase config available — keep whatever's persisted, just mark
    // initialized so the route guards proceed.
    useAuthStore.getState().markInitialized();
    return () => {};
  }
}
