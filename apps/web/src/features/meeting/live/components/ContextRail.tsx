import type { Meeting } from "@scoach/types";

import { NotesPanel } from "./NotesPanel.tsx";
import { ScreenSharePreview, type ScreenSharePreviewProps } from "./ScreenSharePreview.tsx";
import { SentimentDual } from "./SentimentDual.tsx";

export interface ContextRailProps extends ScreenSharePreviewProps {
  meeting: Meeting;
}

/**
 * Left-rail layout:
 *   1. ScreenSharePreview  — start/switch/stop screen share, mic indicator
 *   2. My notes            — always-visible private notes (manual + auto)
 */
export function ContextRail({
  meeting,
  stream,
  rmsDb,
  error,
  onPickSource,
  onStopShare,
  micCapturing,
  micError,
}: ContextRailProps) {
  return (
    <aside className="rail">
      <ScreenSharePreview
        stream={stream}
        rmsDb={rmsDb}
        error={error}
        onPickSource={onPickSource}
        onStopShare={onStopShare}
        micCapturing={micCapturing}
        micError={micError}
      />

      <SentimentDual />

      <NotesPanel meetingId={meeting.id} />
    </aside>
  );
}
