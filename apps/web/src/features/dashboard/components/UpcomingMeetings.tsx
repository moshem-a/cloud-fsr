import type { CalendarEvent } from "@scoach/types";
import { Chev, Globe, Play, Users } from "@scoach/ui/icons";
import { useMemo } from "react";

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

function buildDemoEvents(): CalendarEvent[] {
  const now = Date.now();
  const min = (n: number) => n * 60_000;
  const hr = (n: number) => n * 3_600_000;
  const day = (n: number) => n * 86_400_000;

  return [
    {
      id: "gcal-1",
      summary: "Vertex AI Discussion — Aviv Capital",
      start: new Date(now + min(18)).toISOString(),
      end: new Date(now + min(78)).toISOString(),
      timeZone: "Asia/Jerusalem",
      attendees: [
        { email: "yael@avivcapital.com", displayName: "Yael Ben-David", responseStatus: "accepted" },
        { email: "ran@avivcapital.com", displayName: "Ran Shamir", responseStatus: "tentative" },
        { email: "noalevi@google.com", displayName: "Noa Levi", responseStatus: "accepted", self: true },
      ],
      organizer: { email: "noalevi@google.com", displayName: "Noa Levi" },
      status: "confirmed",
      htmlLink: "#",
      meetLink: "https://meet.google.com/abc-defg-hij",
    },
    {
      id: "gcal-2",
      summary: "Q3 Pipeline Review",
      start: new Date(now + hr(3)).toISOString(),
      end: new Date(now + hr(4)).toISOString(),
      timeZone: "Asia/Jerusalem",
      attendees: [
        { email: "dana@google.com", displayName: "Dana Cohen", responseStatus: "accepted" },
        { email: "noalevi@google.com", displayName: "Noa Levi", responseStatus: "accepted", self: true },
      ],
      organizer: { email: "dana@google.com", displayName: "Dana Cohen" },
      status: "confirmed",
      htmlLink: "#",
      meetLink: "https://meet.google.com/xyz-uvwx-rst",
    },
    {
      id: "gcal-3",
      summary: "Model Garden Demo — Leumi Bank",
      start: new Date(now + day(1) + hr(2)).toISOString(),
      end: new Date(now + day(1) + hr(3)).toISOString(),
      timeZone: "Asia/Jerusalem",
      attendees: [
        { email: "shira@leumi.co.il", displayName: "Shira Katz", responseStatus: "accepted" },
        { email: "avi@leumi.co.il", displayName: "Avi Rosen", responseStatus: "needsAction" },
        { email: "noalevi@google.com", displayName: "Noa Levi", responseStatus: "accepted", self: true },
      ],
      organizer: { email: "noalevi@google.com", displayName: "Noa Levi" },
      status: "confirmed",
      htmlLink: "#",
      meetLink: "https://meet.google.com/lmn-opqr-stu",
    },
    {
      id: "gcal-4",
      summary: "BigQuery Migration Kickoff — Wix",
      start: new Date(now + day(2) + hr(1)).toISOString(),
      end: new Date(now + day(2) + hr(2)).toISOString(),
      timeZone: "Asia/Jerusalem",
      attendees: [
        { email: "tom@wix.com", displayName: "Tom Hadar", responseStatus: "accepted" },
        { email: "noalevi@google.com", displayName: "Noa Levi", responseStatus: "accepted", self: true },
      ],
      organizer: { email: "tom@wix.com", displayName: "Tom Hadar" },
      status: "confirmed",
      htmlLink: "#",
    },
    {
      id: "gcal-5",
      summary: "Security Posture Review — Check Point",
      start: new Date(now + day(3)).toISOString(),
      end: new Date(now + day(3) + min(45)).toISOString(),
      timeZone: "Asia/Jerusalem",
      attendees: [
        { email: "maya@checkpoint.com", displayName: "Maya Stern", responseStatus: "accepted" },
        { email: "erez@checkpoint.com", displayName: "Erez Navon", responseStatus: "accepted" },
        { email: "noalevi@google.com", displayName: "Noa Levi", responseStatus: "accepted", self: true },
      ],
      organizer: { email: "maya@checkpoint.com", displayName: "Maya Stern" },
      status: "confirmed",
      htmlLink: "#",
      meetLink: "https://meet.google.com/vwx-yzab-cde",
    },
  ];
}

export function UpcomingMeetings({ onStartCoaching }: Props) {
  const events = useMemo(() => buildDemoEvents(), []);

  return (
    <section className="dash-upcoming">
      <div className="dash-upcoming-head">
        <h2 className="dash-h2">
          <Globe size={16} /> Upcoming meetings
        </h2>
        <span className="upcoming-count">{events.length} events</span>
      </div>
      <div className="upcoming-cards">
        {events.map((event) => {
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
