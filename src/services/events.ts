import { buildEventsResponse } from "@/domain/calendar";
import type { EventsResponse } from "@/domain/models";
import {
  getRepository,
  rsvpIdFor,
} from "@/infrastructure/sheets/repository";

export async function getWeeklyEvents(
  now = new Date(),
): Promise<EventsResponse> {
  const events = await getRepository().listPublicEvents();
  return buildEventsResponse(events, now);
}

export async function setAttendance(
  eventId: string,
  visitorToken: string,
  attending: boolean,
  now = new Date(),
) {
  const attendees = await getRepository().toggleRsvp(
    eventId,
    rsvpIdFor(eventId, visitorToken),
    attending,
    now,
  );
  return { eventId, attending, attendants: attendees };
}
