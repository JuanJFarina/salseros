import type { EventsResponse } from "@/domain/models";

type AttendanceResponse = {
  eventId: string;
  attending: boolean;
  attendants: number;
};

type EventRequestResponse = {
  outcome: "approved" | "pending" | "rejected" | "duplicate";
  eventId: string | null;
  socialName: string;
};

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) {
    const message =
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "No pudimos completar la operación.";
    throw new Error(message);
  }
  return payload as T;
}

export function fetchEvents(): Promise<EventsResponse> {
  return jsonRequest<EventsResponse>("/api/events", { cache: "no-store" });
}

export function updateAttendance(
  eventId: string,
  visitorToken: string,
  attending: boolean,
): Promise<AttendanceResponse> {
  return jsonRequest<AttendanceResponse>("/api/rsvps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, visitorToken, attending }),
  });
}

export function requestEvent(input: {
  date: string;
  time: string;
  place: string;
  username: string;
}): Promise<EventRequestResponse> {
  return jsonRequest<EventRequestResponse>("/api/event-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
