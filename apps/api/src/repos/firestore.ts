import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { type Firestore, getFirestore } from "firebase-admin/firestore";

let _db: Firestore | null = null;
let _enabled: boolean | null = null;

/**
 * Returns true when a real Firestore project is configured.
 * In dev without GCP_PROJECT_ID set, falls through to in-memory repos.
 */
export function isFirestoreEnabled(): boolean {
  if (_enabled !== null) return _enabled;
  _enabled = Boolean(process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID);
  return _enabled;
}

export function getDb(): Firestore {
  if (_db) return _db;
  if (!isFirestoreEnabled()) {
    throw new Error("Firestore not configured (set GCP_PROJECT_ID)");
  }
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  _db = getFirestore();
  // Allow `undefined` field values (TS shapes often include optional fields).
  // Firestore otherwise throws on the first undefined property.
  _db.settings({ ignoreUndefinedProperties: true });
  return _db;
}
