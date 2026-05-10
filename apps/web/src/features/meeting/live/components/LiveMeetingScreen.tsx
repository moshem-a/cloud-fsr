import type { Meeting } from "@scoach/types";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { api } from "../../../../lib/http.ts";
import { preMeetingApi } from "../../../premeeting/api.ts";
import { useAudioCapture } from "../audio/useAudioCapture.ts";
import { useAudioUploader } from "../audio/useAudioUploader.ts";
import { useMicCapture } from "../audio/useMicCapture.ts";
import { useScreenCapture } from "../audio/useScreenCapture.ts";
import { useLiveMeeting } from "../hooks/useLiveMeeting.ts";
import { useLiveMeetingStore } from "../store.ts";
import { AppHeader } from "./AppHeader.tsx";
import { CoachColumn } from "./CoachColumn.tsx";
import { ContextRail } from "./ContextRail.tsx";
import { ResizableMain } from "./ResizableMain.tsx";
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

  // Two parallel uploader instances — tab audio is the customer side
  // (labeled "Client"), mic audio is the rep side (labeled "You"). Both
  // POST to the same endpoint with a ?source= query so the server routes
  // to the correct STT stream.
  const tabUploader = useAudioUploader({ meetingId, source: "tab" });
  const micUploader = useAudioUploader({ meetingId, source: "mic" });

  const handleTabFrame = useCallback(
    (frame: { pcm: Int16Array }) => {
      tabUploader.push(frame.pcm);
    },
    [tabUploader],
  );
  const handleMicFrame = useCallback(
    (frame: { pcm: Int16Array }) => {
      micUploader.push(frame.pcm);
    },
    [micUploader],
  );

  const audio = useAudioCapture({ onFrame: handleTabFrame, paused: muted });
  const mic = useMicCapture({ onFrame: handleMicFrame, paused: muted });
  useScreenCapture({ stream: audio.stream, meetingId });

  const startWithPrompt = useCallback(async () => {
    const wantShare = window.confirm(
      "Would you like to share your screen?\n\nThis captures the customer's audio from a shared Chrome tab.\n\nClick OK to share screen, or Cancel to start with mic only.",
    );
    if (wantShare) {
      void mic.start();
      void audio.start();
    } else {
      void mic.start();
    }
  }, [mic, audio]);

  // Adds (or switches) the screen share. Used by the share preview's Enable /
  // Switch button. Independent of the mic — won't stop or restart the mic.
  const startScreenShare = useCallback(async () => {
    void audio.start();
  }, [audio]);

  // Stops just the screen share (rep can keep talking via mic).
  const stopScreenShare = useCallback(() => {
    audio.stop();
  }, [audio]);

  useEffect(() => {
    let cancelled = false;
    preMeetingApi
      .fetchMeeting(meetingId)
      .then((m) => {
        if (cancelled) return;
        setMeeting(m);
        // Hydrate notes from the persisted meeting doc so closing the tab and
        // returning doesn't lose the rep's private notes.
        if (m?.notes && m.notes.length > 0) {
          useLiveMeetingStore.getState().setNotes(m.notes);
        }
      })
      .catch(() => {
        if (!cancelled) setMeeting(null);
      });
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  // Listening reflects EITHER mic OR audio (screen) capture state — the meeting
  // is "live" as long as some stream is active.
  useEffect(() => {
    const live = audio.capturing || mic.capturing;
    setListening(live);
    void api(`/meetings/${meetingId}/state`, {
      method: "PATCH",
      body: { listening: live },
    }).catch(() => {});
  }, [audio.capturing, mic.capturing, setListening, meetingId]);

  // Stop both captures on unmount.
  useEffect(() => {
    return () => {
      audio.stop();
      mic.stop();
    };
  }, [audio.stop, mic.stop]);

  async function handleEnd() {
    audio.stop();
    mic.stop();
    await Promise.all([tabUploader.flush(), micUploader.flush()]);
    void api(`/meetings/${meetingId}/end`, { method: "POST", body: {} }).catch(() => {});
    nav({ to: "/meetings/$id/summary", params: { id: meetingId } });
  }

  if (!meeting) {
    return <div style={{ padding: 32, color: "var(--text-3)" }}>Loading meeting…</div>;
  }

  return (
    <div className="app">
      <AppHeader meeting={meeting} onToggleListening={startWithPrompt} onEnd={handleEnd} />
      <ResizableMain
        rail={
          <ContextRail
            meeting={meeting}
            stream={audio.stream}
            rmsDb={audio.rmsDb}
            error={audio.error}
            onPickSource={startScreenShare}
            onStopShare={stopScreenShare}
            micCapturing={mic.capturing}
            micError={mic.error}
          />
        }
        coach={<CoachColumn meetingId={meetingId} />}
        transcript={<TranscriptPanel meetingId={meetingId} />}
      />
    </div>
  );
}
