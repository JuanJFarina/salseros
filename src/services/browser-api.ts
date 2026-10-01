import type { EventsResponse } from "@/domain/models";

type AttendanceResponse = {
  eventId: string;
  attending: boolean;
  attendants: number;
};

type SourceRequestResponse = {
  username: string;
  outcome: "created" | "duplicate" | "already_active";
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

export function requestSource(
  username: string,
): Promise<SourceRequestResponse> {
  return jsonRequest<SourceRequestResponse>("/api/source-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
}
