import type { Meeting } from "@scoach/types";
import { Brain } from "@scoach/ui/icons";

import { NotesPanel } from "./NotesPanel.tsx";
import { ScreenSharePreview, type ScreenSharePreviewProps } from "./ScreenSharePreview.tsx";
import { SentimentDual } from "./SentimentDual.tsx";

export interface ContextRailProps extends Partial<ScreenSharePreviewProps> {
  meeting: Meeting;
  isSimulation?: boolean;
}

function SimulationCard({ meeting }: { meeting: Meeting }) {
  const contact = meeting.participants.find((p) => p.side === "client");
  return (
    <section className="share-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Brain size={16} />
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>Simulation Mode</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
        <div>
          <strong>Client:</strong> {meeting.account.name || "Unknown"}
          {meeting.account.industry && ` (${meeting.account.industry})`}
        </div>
        {contact && (
          <div>
            <strong>Contact:</strong> {contact.name}
            {contact.role && ` — ${contact.role}`}
          </div>
        )}
        <div><strong>Stage:</strong> {meeting.stage}</div>
        {meeting.goal && <div><strong>Goal:</strong> {meeting.goal}</div>}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-4)" }}>
        Gemini Live is roleplaying as the client. Speak naturally — hints and coaching are live.
      </div>
    </section>
  );
}

export function ContextRail({
  meeting,
  isSimulation,
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
      {isSimulation ? (
        <SimulationCard meeting={meeting} />
      ) : (
        <ScreenSharePreview
          stream={stream ?? null}
          rmsDb={rmsDb ?? -Infinity}
          error={error ?? null}
          onPickSource={onPickSource ?? (() => {})}
          onStopShare={onStopShare}
          micCapturing={micCapturing}
          micError={micError}
        />
      )}

      <SentimentDual />

      <NotesPanel meetingId={meeting.id} />
    </aside>
  );
}
