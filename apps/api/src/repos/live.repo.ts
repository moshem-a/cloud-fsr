import type { Hint, SentimentSample, TranscriptLine } from "@scoach/types";

import { getDb, isFirestoreEnabled } from "./firestore.ts";

/**
 * Writers for the live-meeting subcollections that the FE listens to via
 * Firestore onSnapshot. Server uses admin SDK so it bypasses security rules.
 *
 * Subcollection layout:
 *   meetings/{id}/transcript/{lineId}    ← TranscriptLine
 *   meetings/{id}/hints/{hintId}         ← Hint
 *   meetings/{id}/sentiment/{at}         ← SentimentSample
 *   meetings/{id}/followups/{idx}        ← { items: string[], at: number }
 *   meetings/{id}/live/state             ← { listening, muted, lastUpdate }
 */

export const liveRepo = {
  async writeTranscript(meetingId: string, line: TranscriptLine): Promise<void> {
    if (!isFirestoreEnabled()) return;
    await getDb()
      .collection("meetings")
      .doc(meetingId)
      .collection("transcript")
      .doc(line.id)
      .set({ ...line, _at: Date.now() });
  },

  async writeHint(meetingId: string, hint: Hint): Promise<void> {
    if (!isFirestoreEnabled()) return;
    await getDb()
      .collection("meetings")
      .doc(meetingId)
      .collection("hints")
      .doc(hint.id)
      .set({ ...hint, _at: Date.now() });
  },

  async writeSentiment(meetingId: string, sample: SentimentSample): Promise<void> {
    if (!isFirestoreEnabled()) return;
    await getDb()
      .collection("meetings")
      .doc(meetingId)
      .collection("sentiment")
      .doc(String(sample.at))
      .set({ ...sample, _at: Date.now() });
  },

  async writeFollowups(meetingId: string, items: string[]): Promise<void> {
    if (!isFirestoreEnabled()) return;
    await getDb()
      .collection("meetings")
      .doc(meetingId)
      .collection("followups")
      .doc("latest")
      .set({ items, _at: Date.now() });
  },

  async writeLiveState(
    meetingId: string,
    state: { listening?: boolean; muted?: boolean; latencyMs?: number; sttError?: string },
  ): Promise<void> {
    if (!isFirestoreEnabled()) return;
    await getDb()
      .collection("meetings")
      .doc(meetingId)
      .collection("live")
      .doc("state")
      .set({ ...state, _at: Date.now() }, { merge: true });
  },

  async clearLive(meetingId: string): Promise<void> {
    if (!isFirestoreEnabled()) return;
    const db = getDb();
    const subs = ["transcript", "hints", "sentiment", "followups", "live"];
    for (const sub of subs) {
      const snap = await db.collection("meetings").doc(meetingId).collection(sub).get();
      const batch = db.batch();
      for (const doc of snap.docs) batch.delete(doc.ref);
      if (!snap.empty) await batch.commit();
    }
  },
};
