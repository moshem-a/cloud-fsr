import type { Hint, SentimentSample, TranscriptLine } from "@scoach/types";
import {
  type DocumentData,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect } from "react";

import { getDb } from "../../../../lib/firestore.ts";
import { useLiveMeetingStore } from "../store.ts";

/**
 * Subscribes to the live-meeting Firestore subcollections via onSnapshot.
 * Uses Firebase's own WebSocket transport (always works behind Hosting).
 *
 *   meetings/{id}/transcript ordered by t (asc)
 *   meetings/{id}/hints      ordered by _at  (asc)
 *   meetings/{id}/sentiment  ordered by at (asc)
 *   meetings/{id}/followups/latest (single doc)
 */
export function useLiveMeeting(meetingId: string): void {
  const setConnection = useLiveMeetingStore((s) => s.setConnection);
  const setMeetingId = useLiveMeetingStore((s) => s.setMeetingId);
  const setStartedAt = useLiveMeetingStore((s) => s.setStartedAt);
  const setSttError = useLiveMeetingStore((s) => s.setSttError);
  const setLivePartial = useLiveMeetingStore((s) => s.setLivePartial);
  const apply = useLiveMeetingStore((s) => s.applyServerMessage);
  const reset = useLiveMeetingStore((s) => s.reset);

  useEffect(() => {
    let unsubs: Array<() => void> = [];
    setMeetingId(meetingId);
    setStartedAt(Date.now());
    setConnection(true);

    try {
      const db = getDb();
      const meetingRef = doc(db, "meetings", meetingId);

      const unsubTranscript = onSnapshot(
        query(collection(meetingRef, "transcript"), orderBy("t", "asc")),
        (snap) => {
          for (const change of snap.docChanges()) {
            if (change.type === "removed") continue;
            const line = change.doc.data() as TranscriptLine & DocumentData;
            apply({ type: "transcript-final", line });
          }
        },
        (err) => {
          console.warn("[live] transcript listener error", err);
        },
      );
      unsubs.push(unsubTranscript);

      const unsubHints = onSnapshot(
        query(collection(meetingRef, "hints"), orderBy("_at", "asc")),
        (snap) => {
          for (const change of snap.docChanges()) {
            if (change.type === "removed") continue;
            const hint = change.doc.data() as Hint & DocumentData;
            apply({ type: "hint", hint });
          }
        },
        (err) => {
          console.warn("[live] hints listener error", err);
        },
      );
      unsubs.push(unsubHints);

      const unsubSentiment = onSnapshot(
        query(collection(meetingRef, "sentiment"), orderBy("at", "asc")),
        (snap) => {
          for (const change of snap.docChanges()) {
            if (change.type === "removed") continue;
            const sample = change.doc.data() as SentimentSample & DocumentData;
            apply({ type: "sentiment", sample });
          }
        },
        (err) => {
          console.warn("[live] sentiment listener error", err);
        },
      );
      unsubs.push(unsubSentiment);

      const unsubFollowups = onSnapshot(
        doc(meetingRef, "followups", "latest"),
        (snap) => {
          const data = snap.data() as { items?: string[] } | undefined;
          if (data?.items) apply({ type: "followups", items: data.items });
        },
        (err) => {
          console.warn("[live] followups listener error", err);
        },
      );
      unsubs.push(unsubFollowups);

      const addNote = useLiveMeetingStore.getState().addNote;

      const unsubAutoNotes = onSnapshot(
        query(collection(meetingRef, "autoNotes"), orderBy("_at", "asc")),
        (snap) => {
          for (const change of snap.docChanges()) {
            if (change.type !== "added") continue;
            const data = change.doc.data() as { t: string; text: string; source?: string } & DocumentData;
            const current = useLiveMeetingStore.getState().notes;
            const exists = current.some((n) => n.text === data.text && n.t === data.t);
            if (!exists) {
              addNote({ t: data.t, text: data.text, source: "auto" });
            }
          }
        },
        (err) => {
          console.warn("[live] autoNotes listener error", err);
        },
      );
      unsubs.push(unsubAutoNotes);

      const unsubTips = onSnapshot(
        query(collection(meetingRef, "tips"), orderBy("_at", "desc")),
        (snap) => {
          for (const change of snap.docChanges()) {
            if (change.type === "removed") continue;
            const tip = change.doc.data() as { id: string; text: string; at: number } & DocumentData;
            apply({ type: "tip", tip });
          }
        },
        (err) => {
          console.warn("[live] tips listener error", err);
        },
      );
      unsubs.push(unsubTips);

      const unsubLive = onSnapshot(
        doc(meetingRef, "live", "state"),
        (snap) => {
          const data = snap.data() as { sttError?: string } | undefined;
          setSttError(data?.sttError ?? null);
        },
        (err) => {
          console.warn("[live] state listener error", err);
        },
      );
      unsubs.push(unsubLive);

      const unsubPartial = onSnapshot(
        doc(meetingRef, "live", "partial"),
        (snap) => {
          const data = snap.data() as { text?: string } | undefined;
          const text = (data?.text ?? "").trim();
          setLivePartial(text || null);
        },
        (err) => {
          console.warn("[live] partial listener error", err);
        },
      );
      unsubs.push(unsubPartial);
    } catch (err) {
      console.warn("[live] failed to attach Firestore listeners", err);
      setConnection(false);
    }

    return () => {
      for (const u of unsubs) u();
      unsubs = [];
      setConnection(false);
      reset();
    };
  }, [meetingId, apply, reset, setConnection, setMeetingId, setStartedAt, setSttError, setLivePartial]);
}
