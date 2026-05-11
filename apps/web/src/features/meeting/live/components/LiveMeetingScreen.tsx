import type { Meeting, MeetingSummary } from "@scoach/types";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../../../../lib/http.ts";
import { preMeetingApi } from "../../../premeeting/api.ts";
import { useAudioCapture } from "../audio/useAudioCapture.ts";
import { useAudioUploader } from "../audio/useAudioUploader.ts";
import { useMicCapture } from "../audio/useMicCapture.ts";
import { useScreenCapture } from "../audio/useScreenCapture.ts";
import { buildSimulationPrompt } from "../gemini/buildSimulationPrompt.ts";
import { useGeminiLive } from "../gemini/useGeminiLive.ts";
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
  useLiveMeeting(meetingId);

  const setListening = useLiveMeetingStore((s) => s.setListening);
  const muted = useLiveMeetingStore((s) => s.muted);
  const nav = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [parentSummary, setParentSummary] = useState<MeetingSummary | null>(null);

  const isSimulation = meeting?.meetingType === "simulation";

  const tabUploader = useAudioUploader({ meetingId, source: "tab" });
  const micUploader = useAudioUploader({ meetingId, source: "mic" });

  // Build simulation prompt from parent meeting context
  const simPrompt = useMemo(() => {
    if (!isSimulation || !meeting) return "";
    return buildSimulationPrompt({
      clientName: meeting.account.name || "the client",
      contactName: meeting.participants.find((p) => p.side === "client")?.name,
      contactRole: meeting.participants.find((p) => p.side === "client")?.role,
      industry: meeting.account.industry,
      stage: meeting.stage,
      meetingGoal: meeting.goal,
      summary: parentSummary,
    });
  }, [isSimulation, meeting, parentSummary]);

  const geminiLive = useGeminiLive({
    meetingId,
    systemInstruction: simPrompt,
    enabled: isSimulation,
  });

  const handleTabFrame = useCallback(
    (frame: { pcm: Int16Array }) => {
      tabUploader.push(frame.pcm);
    },
    [tabUploader],
  );
  const handleMicFrame = useCallback(
    (frame: { pcm: Int16Array }) => {
      micUploader.push(frame.pcm);
      if (isSimulation) {
        geminiLive.sendAudio(frame.pcm);
      }
    },
    [micUploader, isSimulation, geminiLive],
  );

  const audio = useAudioCapture({ onFrame: handleTabFrame, paused: muted });
  const mic = useMicCapture({ onFrame: handleMicFrame, paused: muted });
  useScreenCapture({ stream: audio.stream, meetingId });

  const startWithPrompt = useCallback(async () => {
    if (isSimulation) {
      geminiLive.connect();
      void mic.start();
      return;
    }
    const wantShare = window.confirm(
      "Would you like to share your screen?\n\nThis captures the customer's audio from a shared Chrome tab.\n\nClick OK to share screen, or Cancel to start with mic only.",
    );
    if (wantShare) {
      void mic.start();
      void audio.start();
    } else {
      void mic.start();
    }
  }, [mic, audio, isSimulation, geminiLive]);

  const startScreenShare = useCallback(async () => {
    void audio.start();
  }, [audio]);

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
        if (m?.notes && m.notes.length > 0) {
          useLiveMeetingStore.getState().setNotes(m.notes);
        }
        // Load parent meeting summary for simulation context
        if (m?.meetingType === "simulation" && m.parentMeetingId) {
          api<{ summary: MeetingSummary }>(`/meetings/${m.parentMeetingId}/summary-data`)
            .then((r) => { if (!cancelled) setParentSummary(r.summary); })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setMeeting(null);
      });
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  useEffect(() => {
    const live = audio.capturing || mic.capturing;
    setListening(live);
    void api(`/meetings/${meetingId}/state`, {
      method: "PATCH",
      body: { listening: live },
    }).catch(() => {});
  }, [audio.capturing, mic.capturing, setListening, meetingId]);

  useEffect(() => {
    return () => {
      audio.stop();
      mic.stop();
    };
  }, [audio.stop, mic.stop]);

  async function handleEnd() {
    if (isSimulation) {
      geminiLive.disconnect();
    }
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
      <AppHeader
        meeting={meeting}
        onToggleListening={startWithPrompt}
        onEnd={handleEnd}
        isSimulation={isSimulation}
        simulationConnected={geminiLive.connected}
        simulationError={geminiLive.error}
      />
      <ResizableMain
        rail={
          <ContextRail
            meeting={meeting}
            isSimulation={isSimulation}
            stream={isSimulation ? null : audio.stream}
            rmsDb={isSimulation ? -Infinity : audio.rmsDb}
            error={isSimulation ? null : audio.error}
            onPickSource={isSimulation ? undefined : startScreenShare}
            onStopShare={isSimulation ? undefined : stopScreenShare}
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
