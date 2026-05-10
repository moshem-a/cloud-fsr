import { Button, Card, Spinner, useToast } from "@scoach/ui";
import { Bolt, Lock, Monitor, Spark } from "@scoach/ui/icons";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { preMeetingApi } from "../api.ts";
import { usePreMeetingStore } from "../store.ts";

export interface Step4ReadyProps {
  meetingId: string;
}

export function Step4Ready({ meetingId }: Step4ReadyProps) {
  const s = usePreMeetingStore();
  const nav = useNavigate();
  const toast = useToast();
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    if (s.tips.length === 0 && !s.loadingTips) {
      s.setLoadingTips(true);
      preMeetingApi
        .fetchTips(meetingId)
        .then((r) => {
          s.setTips(r.tips);
        })
        .catch(() => {})
        .finally(() => s.setLoadingTips(false));
    }
  }, [meetingId]);

  async function handleSchedule() {
    if (!scheduleDate || !scheduleTime) {
      toast.push({ tone: "error", message: "Please select a date and time." });
      return;
    }
    setScheduling(true);
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      await preMeetingApi.scheduleMeeting(meetingId, scheduledAt);
      toast.push({ tone: "success", message: "Meeting scheduled. You can start it from the dashboard when ready." });
      nav({ to: "/dashboard" });
    } catch (err) {
      toast.push({ tone: "error", message: (err as Error).message });
    } finally {
      setScheduling(false);
    }
  }

  return (
    <div className="setup-step">
      <h2 className="setup-step-title">Ready to go</h2>

      <Card className="ready-summary-card">
        <div className="kicker" style={{ marginBottom: 12 }}>Meeting summary</div>
        <div className="ready-row"><span>Client</span><strong>{s.client || "Unspecified"}</strong></div>
        <div className="ready-row"><span>Title</span><strong>{s.title || "Untitled"}</strong></div>
        <div className="ready-row"><span>Stage</span><strong>{s.stage}</strong></div>
        <div className="ready-row">
          <span>Language</span>
          <strong>{s.language === "auto" ? "Auto-detect" : s.language === "he" ? "Hebrew" : "English"}</strong>
        </div>
        {s.website && (
          <div className="ready-row"><span>Website</span><strong>{s.website}</strong></div>
        )}
        <div className="ready-row">
          <span>Context</span>
          <strong>
            {s.contextFiles.length} document{s.contextFiles.length === 1 ? "" : "s"} indexed
            {s.insights ? ` · ${s.insights.entities.length} entities` : ""}
          </strong>
        </div>
      </Card>

      <Card className="tips-card">
        <div className="tips-head">
          <Spark size={16} />
          <span className="tips-title">Meeting tips</span>
          {s.loadingTips && <Spinner size={14} />}
        </div>
        {s.loadingTips && s.tips.length === 0 ? (
          <div className="tips-loading">Generating tips based on your meeting setup...</div>
        ) : s.tips.length > 0 ? (
          <ul className="tips-list">
            {s.tips.map((tip, i) => (
              <li key={i}>
                <Bolt size={12} />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="tips-loading">No tips available — complete the previous steps for personalized advice.</div>
        )}
      </Card>

      <Card className="ready-silent">
        <Lock size={18} />
        <div>
          <div className="ready-silent-title">Silent mode active</div>
          <div className="ready-silent-sub">
            Nothing is being captured until you press Start listening.
          </div>
        </div>
      </Card>

      <Card className="ready-share">
        <div className="ready-share-head">
          <Monitor size={18} />
          <span>Screen share</span>
        </div>
        <div className="ready-share-placeholder">
          When you start the meeting, you'll be asked if you want to share your screen.
          You can also add screen share later from the live meeting panel.
        </div>
      </Card>

      <div className="ready-actions">
        <Button variant="primary" className="lg" onClick={() => nav({ to: "/meetings/$id/live", params: { id: meetingId } })}>
          Start meeting now
        </Button>

        {!scheduleMode ? (
          <Button variant="ghost" onClick={() => setScheduleMode(true)}>
            Schedule for later
          </Button>
        ) : (
          <Card className="schedule-card">
            <div className="schedule-head">Schedule this meeting</div>
            <div className="schedule-row">
              <input
                type="date"
                className="setup-input"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
              <input
                type="time"
                className="setup-input"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
            <div className="schedule-actions">
              <Button variant="primary" onClick={handleSchedule} loading={scheduling} disabled={scheduling}>
                Confirm schedule
              </Button>
              <Button variant="ghost" onClick={() => setScheduleMode(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        )}
      </div>

      <div className="ready-return-note">
        You can always return to this screen from the dashboard before starting the meeting.
      </div>
    </div>
  );
}
