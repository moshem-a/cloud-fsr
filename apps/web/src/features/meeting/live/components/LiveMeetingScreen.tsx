import type { Meeting } from "@scoach/types";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { api } from "../../../../lib/http.ts";
import { preMeetingApi } from "../../../premeeting/api.ts";
import { useAudioCapture } from "../audio/useAudioCapture.ts";
import { useAudioUploader } from "../audio/useAudioUploader.ts";
import { useLiveMeeting } from "../hooks/useLiveMeeting.ts";
import { useLiveMeetingStore } from "../store.ts";
import { AppHeader } from "./AppHeader.tsx";
import { CoachColumn } from "./CoachColumn.tsx";
import { ContextRail } from "./ContextRail.tsx";
import { TranscriptPanel } from "./TranscriptPanel.tsx";

export interface LiveMeetingScreenProps {
  meetingId: string;
}

export function LiveMeetingScreen({ meetingId }: LiveMeetingScreenProps) {
  // Subscribe to Firestore live subcollections (transcript / hints / sentiment).
  useLiveMeeting(meetingId);

  const setListening = useLiveMeetingStore((s) => s.setListening);
  const muted = useLiveMeetingStore((s) => s.muted);
  const nav = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);

  // HTTP audio uploader (replaces WS sendAudio).
  const uploader = useAudioUploader({ meetingId });

  // PCM frames from the worklet → uploader buffer.
  const handleFrame = useCallback(
    (frame: { pcm: Int16Array }) => {
      uploader.push(frame.pcm);
    },
    [uploader],
  );

  const audio = useAudioCapture({ onFrame: handleFrame, paused: muted });

  useEffect(() => {
    let cancelled = false;
    preMeetingApi
      .fetchMeeting(meetingId)
      .then((m) => {
        if (!cancelled) setMeeting(m);
      })
      .catch(() => {
        if (!cancelled) setMeeting(null);
      });
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  // Listening reflects audio capture state, mirrored to backend state doc.
  useEffect(() => {
    setListening(audio.capturing);
    void api(`/meetings/${meetingId}/state`, {
      method: "PATCH",
      body: { listening: audio.capturing },
    }).catch(() => {});
  }, [audio.capturing, setListening, meetingId]);

  // Stop capture on unmount.
  useEffect(() => {
    return () => audio.stop();
  }, [audio.stop]);

  async function handleEnd() {
    audio.stop();
    await uploader.flush();
    void api(`/meetings/${meetingId}/end`, { method: "POST", body: {} }).catch(() => {});
    nav({ to: "/meetings/$id/summary", params: { id: meetingId } });
  }

  if (!meeting) {
    return <div style={{ padding: 32, color: "var(--text-3)" }}>Loading meeting…</div>;
  }

  return (
    <div className="app">
      <AppHeader meeting={meeting} onToggleListening={audio.start} onEnd={handleEnd} />
      <main className="main">
        <ContextRail
          meeting={meeting}
          stream={audio.stream}
          rmsDb={audio.rmsDb}
          error={audio.error}
          onPickSource={audio.start}
        />
        <TranscriptPanel meetingId={meetingId} />
        <CoachColumn meetingId={meetingId} />
      </main>
    </div>
  );
}
