import { buildEventsResponse } from "@/domain/calendar";
import {
  normalizeInstagramUsername,
  requestIdFor,
} from "@/domain/identity";
import type { EventsResponse } from "@/domain/models";
import {
  getRepository,
  rsvpIdFor,
} from "@/infrastructure/sheets/repository";
import { AppError } from "@/utils/errors";

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

export async function submitSourceRequest(
  rawUsername: string,
  now = new Date(),
) {
  let username: string;
  try {
    username = normalizeInstagramUsername(rawUsername);
  } catch {
    throw new AppError(
      "Ingresá un usuario de Instagram válido.",
      400,
      "invalid_username",
    );
  }

  const outcome = await getRepository().requestSource({
    requestId: requestIdFor(username),
    username,
    status: "pending",
    requestedAt: now.toISOString(),
    reviewedAt: null,
    reviewNote: null,
  });
  return { username, outcome };
}
