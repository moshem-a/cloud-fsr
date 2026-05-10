import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  type User as FirebaseUser,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

let _app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  if (!firebaseConfig.apiKey) {
    throw new Error(
      "Firebase config missing. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID in apps/web/.env.local",
    );
  }
  _app = getApps()[0] ?? initializeApp(firebaseConfig);
  return _app;
}

/** Comma-separated domains allowed to sign in. Mirror of api ALLOWED_EMAIL_DOMAIN. */
export const ALLOWED_DOMAINS = ["google.com", "altostrat.com", "moshem.altostrat.com"] as const;
/** Backwards-compat label for screens that show "@google.com" copy. */
export const ALLOWED_DOMAIN = ALLOWED_DOMAINS[0];

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  return ALLOWED_DOMAINS.includes(
    email.slice(at + 1).toLowerCase() as (typeof ALLOWED_DOMAINS)[number],
  );
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const app = getFirebaseApp();
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const cred = await signInWithPopup(auth, provider);
  if (!isAllowedEmail(cred.user.email)) {
    await fbSignOut(auth);
    throw new Error(`Access is restricted to ${ALLOWED_DOMAINS.map((d) => `@${d}`).join(" or ")} accounts`);
  }
  return cred.user;
}

export async function signOut(): Promise<void> {
  const app = getFirebaseApp();
  await fbSignOut(getAuth(app));
}

export function onAuthChange(cb: (user: FirebaseUser | null) => void): () => void {
  const app = getFirebaseApp();
  return onAuthStateChanged(getAuth(app), cb);
}

// Resolves once Firebase has hydrated its auth state from IndexedDB. Until
// this fires, `auth.currentUser` is null even for already-signed-in users.
let _authReady: Promise<void> | null = null;
function authReady(): Promise<void> {
  if (_authReady) return _authReady;
  _authReady = new Promise<void>((resolve) => {
    const auth = getAuth(getFirebaseApp());
    const unsub = onAuthStateChanged(auth, () => {
      unsub();
      resolve();
    });
  });
  return _authReady;
}

export async function getIdToken(): Promise<string | null> {
  await authReady();
  const user = getAuth(getFirebaseApp()).currentUser;
  return user ? user.getIdToken() : null;
}
