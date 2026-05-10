import type { CalendarEvent, CalendarAttendee } from "@scoach/types";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
    self?: boolean;
  }>;
  organizer?: { email: string; displayName?: string };
  status?: string;
  htmlLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ uri: string; entryPointType: string }>;
  };
}

function mapAttendee(a: GCalEvent["attendees"] extends Array<infer T> ? T : never): CalendarAttendee {
  return {
    email: a.email,
    displayName: a.displayName,
    responseStatus: (a.responseStatus as CalendarAttendee["responseStatus"]) ?? "needsAction",
    organizer: a.organizer,
    self: a.self,
  };
}

function mapEvent(e: GCalEvent): CalendarEvent | null {
  const startStr = e.start?.dateTime ?? e.start?.date;
  const endStr = e.end?.dateTime ?? e.end?.date;
  if (!startStr || !endStr) return null;

  const meetEntry = e.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === "video",
  );

  return {
    id: e.id,
    summary: e.summary ?? "(No title)",
    description: e.description,
    start: startStr,
    end: endStr,
    timeZone: e.start?.timeZone ?? "UTC",
    attendees: (e.attendees ?? []).map(mapAttendee),
    organizer: e.organizer ?? { email: "" },
    status: (e.status as CalendarEvent["status"]) ?? "confirmed",
    htmlLink: e.htmlLink ?? "",
    meetLink: meetEntry?.uri,
  };
}

export async function listUpcomingEvents(
  accessToken: string,
  days = 7,
  maxResults = 20,
): Promise<CalendarEvent[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 86_400_000).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    maxResults: String(maxResults),
    singleEvents: "true",
    orderBy: "startTime",
    fields: "items(id,summary,description,start,end,attendees,organizer,status,htmlLink,conferenceData)",
  });

  const res = await fetch(
    `${CALENDAR_API}/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar API ${res.status}: ${text.slice(0, 200)}`);
  }

  const body = (await res.json()) as { items?: GCalEvent[] };
  return (body.items ?? [])
    .map(mapEvent)
    .filter((e): e is CalendarEvent => e !== null && e.status !== "cancelled");
}
