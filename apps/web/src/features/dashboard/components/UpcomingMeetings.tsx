import type { CalendarEvent } from "@scoach/types";
import { Chev, Globe, Play, Users } from "@scoach/ui/icons";
import { useEffect, useState } from "react";

import { dashboardApi } from "../api.ts";

interface Props {
  onStartCoaching: (event: CalendarEvent) => void;
}

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "Started";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  const days = Math.round(hrs / 24);
  return `in ${days}d`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function externalAttendees(event: CalendarEvent): CalendarEvent["attendees"] {
  return event.attendees.filter(
    (a) => !a.self && !a.email.endsWith("@google.com") && !a.email.endsWith("@altostrat.com"),
  );
}

export function UpcomingMeetings({ onStartCoaching }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    dashboardApi
      .fetchCalendarEvents(7)
      .then((evts) => {
        setEvents(evts.filter((e) => new Date(e.start) > new Date()));
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="dash-upcoming">
        <div className="dash-upcoming-head">
          <h2 className="dash-h2">
            <Globe size={16} /> Upcoming meetings
          </h2>
        </div>
        <div className="upcoming-cards">
          {[1, 2, 3].map((i) => (
            <div key={i} className="upcoming-card upcoming-skeleton" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="dash-upcoming">
        <div className="dash-upcoming-head">
          <h2 className="dash-h2">
            <Globe size={16} /> Upcoming meetings
          </h2>
        </div>
        <div className="upcoming-empty">
          <p>Could not load calendar events. Sign in again to grant calendar access.</p>
        </div>
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <section className="dash-upcoming">
        <div className="dash-upcoming-head">
          <h2 className="dash-h2">
            <Globe size={16} /> Upcoming meetings
          </h2>
        </div>
        <div className="upcoming-empty">
          <p>No upcoming meetings this week.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="dash-upcoming">
      <div className="dash-upcoming-head">
        <h2 className="dash-h2">
          <Globe size={16} /> Upcoming meetings
        </h2>
        <span className="upcoming-count">{events.length} events</span>
      </div>
      <div className="upcoming-cards">
        {events.slice(0, 6).map((event) => {
          const ext = externalAttendees(event);
          const isNow = new Date(event.start).getTime() - Date.now() < 30 * 60_000;
          return (
            <div key={event.id} className={`upcoming-card${isNow ? " upcoming-soon" : ""}`}>
              <div className="upcoming-time-row">
                <span className="upcoming-date">{formatDate(event.start)}</span>
                <span className="upcoming-clock mono">{formatTime(event.start)}</span>
                <span className={`upcoming-rel${isNow ? " upcoming-rel-soon" : ""}`}>
                  {relativeTime(event.start)}
                </span>
              </div>
              <div className="upcoming-title">{event.summary}</div>
              {ext.length > 0 && (
                <div className="upcoming-attendees">
                  <Users size={12} />
                  <span>
                    {ext
                      .slice(0, 3)
                      .map((a) => a.displayName || a.email.split("@")[0])
                      .join(", ")}
                    {ext.length > 3 && ` +${ext.length - 3}`}
                  </span>
                </div>
              )}
              {event.meetLink && (
                <a
                  href={event.meetLink}
                  target="_blank"
                  rel="noreferrer"
                  className="upcoming-meet-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Chev size={10} /> Join Meet
                </a>
              )}
              <button
                type="button"
                className="pill-btn primary sm upcoming-coach-btn"
                onClick={() => onStartCoaching(event)}
              >
                <Play size={12} /> Start coaching
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
