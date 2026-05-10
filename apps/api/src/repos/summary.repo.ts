import type { MeetingSummary } from "@scoach/types";

import { getDb, isFirestoreEnabled } from "./firestore.ts";

/**
 * Persistence for generated MeetingSummary documents.
 *
 * Firestore layout: meetings/{id}/summary/latest (single doc).
 *
 * Why a subcollection instead of a field on the meeting doc?
 *   1. Long transcripts + summaries can push past Firestore's 1 MiB doc limit.
 *   2. Subcollection writes don't churn the parent meeting doc, so existing
 *      onSnapshot listeners on Meeting don't refire on every email edit.
 *
 * The route layer keeps an in-memory `summaryCache` in front of this repo so
 * cold-start latency on /summary stays low. The cache is only authoritative
 * within a single Cloud Run instance — Firestore is the source of truth for
 * cross-instance and cross-restart durability.
 */
export const summaryRepo = {
  async get(meetingId: string): Promise<MeetingSummary | null> {
    if (!isFirestoreEnabled()) return null;
    const snap = await getDb()
      .collection("meetings")
      .doc(meetingId)
      .collection("summary")
      .doc("latest")
      .get();
    if (!snap.exists) return null;
    return snap.data() as MeetingSummary;
  },

  async write(meetingId: string, summary: MeetingSummary): Promise<void> {
    if (!isFirestoreEnabled()) return;
    await getDb()
      .collection("meetings")
      .doc(meetingId)
      .collection("summary")
      .doc("latest")
      .set({ ...summary, _at: Date.now() });
  },
};
