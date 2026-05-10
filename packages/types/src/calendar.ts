export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  timeZone: string;
  attendees: CalendarAttendee[];
  organizer: { email: string; displayName?: string };
  status: "confirmed" | "tentative" | "cancelled";
  htmlLink: string;
  meetLink?: string;
}

export interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus: "accepted" | "declined" | "tentative" | "needsAction";
  organizer?: boolean;
  self?: boolean;
}
