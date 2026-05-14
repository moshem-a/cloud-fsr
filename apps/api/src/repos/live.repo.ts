import type { Hint, Infographic, InfographicImage, RepNote, SentimentSample, TranscriptLine } from "@scoach/types";
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";

import { getDb, isFirestoreEnabled } from "./firestore.ts";

const BUCKET = "scoach-infographics";
let _storage: Storage | null = null;
function gcs(): Storage {
  if (_storage) return _storage;
  _storage = new Storage();
  return _storage;
}

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

  /**
   * Live partial: a single doc at meetings/{id}/live/partial that overwrites
   * itself as the speaker keeps talking. The FE renders this below the last
   * final transcript so the user sees the full speculative text in real time —
   * Chirp often revises the partial when finalizing and drops words, so showing
   * just the final loses information.
   */
  async writePartial(meetingId: string, line: TranscriptLine): Promise<void> {
    if (!isFirestoreEnabled()) return;
    await getDb()
      .collection("meetings")
      .doc(meetingId)
      .collection("live")
      .doc("partial")
      .set({ ...line, _at: Date.now() });
  },

  async clearPartial(meetingId: string): Promise<void> {
    if (!isFirestoreEnabled()) return;
    await getDb()
      .collection("meetings")
      .doc(meetingId)
      .collection("live")
      .doc("partial")
      .set({ text: "", _at: Date.now() });
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
    // Doc ID includes speaker so per-speaker samples at the same time-index
    // don't overwrite each other. Legacy combined samples used just `${at}`;
    // we preserve that for "all" so the existing FE keeps reading them.
    const docId = sample.speaker && sample.speaker !== "all"
      ? `${sample.at}_${sample.speaker}`
      : String(sample.at);
    await getDb()
      .collection("meetings")
      .doc(meetingId)
      .collection("sentiment")
      .doc(docId)
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

  async writeAutoNote(meetingId: string, note: RepNote): Promise<void> {
    if (!isFirestoreEnabled()) return;
    const id = randomUUID();
    await getDb()
      .collection("meetings")
      .doc(meetingId)
      .collection("autoNotes")
      .doc(id)
      .set({ ...note, id, _at: Date.now() });
  },

  async writeInfographic(meetingId: string, ig: Infographic): Promise<void> {
    if (!isFirestoreEnabled()) return;
    await getDb()
      .collection("meetings")
      .doc(meetingId)
      .collection("infographics")
      .doc(ig.id)
      .set({ ...ig, _at: Date.now() });
  },

  async writeInfographicImage(meetingId: string, img: InfographicImage): Promise<void> {
    if (!isFirestoreEnabled()) return;
    const ext = img.mimeType === "image/jpeg" ? "jpg" : "png";
    const fileName = `${meetingId}/${img.id}.${ext}`;
    const bucket = gcs().bucket(BUCKET);
    const file = bucket.file(fileName);
    const buf = Buffer.from(img.imageBase64!, "base64");
    await file.save(buf, { contentType: img.mimeType, resumable: false });

    const url = `/meetings/${meetingId}/infographic-images/${img.id}.${ext}`;

    await getDb()
      .collection("meetings")
      .doc(meetingId)
      .collection("infographicImages")
      .doc(img.id)
      .set({
        id: img.id,
        imageUrl: url,
        mimeType: img.mimeType,
        prompt: img.prompt,
        generatedAt: img.generatedAt,
      });
  },

  async readInfographicImage(fileName: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const file = gcs().bucket(BUCKET).file(fileName);
      const [buf] = await file.download();
      const [meta] = await file.getMetadata();
      return { buffer: buf, contentType: (meta.contentType as string) ?? "image/png" };
    } catch {
      return null;
    }
  },

  async writeTip(meetingId: string, tip: { id: string; text: string; at: number }): Promise<void> {
    if (!isFirestoreEnabled()) return;
    await getDb()
      .collection("meetings")
      .doc(meetingId)
      .collection("tips")
      .doc(tip.id)
      .set({ ...tip, _at: Date.now() });
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
    const subs = ["transcript", "hints", "sentiment", "followups", "tips", "autoNotes", "infographics", "infographicImages", "live"];
    for (const sub of subs) {
      const snap = await db.collection("meetings").doc(meetingId).collection(sub).get();
      const batch = db.batch();
      for (const doc of snap.docs) batch.delete(doc.ref);
      if (!snap.empty) await batch.commit();
    }
  },
};
