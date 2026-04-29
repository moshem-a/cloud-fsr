import { type Firestore, getFirestore } from "firebase/firestore";

import { getFirebaseApp } from "./firebase.ts";

let _db: Firestore | null = null;

export function getDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getFirebaseApp());
  return _db;
}
