import { differenceInMinutes, differenceInDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import {
  eventIdFor,
  normalizeEventText,
  normalizeInstagramUsername,
  ROSARIO_TIME_ZONE,
  sourceIdFor,
} from "./identity";
import type { EventRecord, EventRequestRecord } from "./models";
import { AppError } from "@/utils/errors";

export function submissionStart(
  date: string,
  time: string,
  now = new Date(),
): Date {
  const startsAt = fromZonedTime(
    `${date}T${time}:00`,
    ROSARIO_TIME_ZONE,
  );
  const roundTrip = formatInTimeZone(
    startsAt,
    ROSARIO_TIME_ZONE,
    "yyyy-MM-dd HH:mm",
  );
  if (roundTrip !== `${date} ${time}`) {
    throw new AppError(
      "La fecha u hora no es válida.",
      400,
      "invalid_schedule",
    );
  }
  if (startsAt <= now) {
    throw new AppError(
      "El social debe ocurrir en el futuro.",
      400,
      "past_event",
    );
  }
  if (differenceInDays(startsAt, now) > 180) {
    throw new AppError(
      "El social no puede cargarse con más de 180 días de anticipación.",
      400,
      "event_too_far",
    );
  }
  return startsAt;
}

function relatedPlaces(left: string, right: string): boolean {
  const normalizedLeft = normalizeEventText(left);
  const normalizedRight = normalizeEventText(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  if (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return true;
  }

  const leftTokens = new Set(normalizedLeft.split(" "));
  const rightTokens = new Set(normalizedRight.split(" "));
  const intersection = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union > 0 && intersection / union >= 0.6;
}

export function findDuplicateEvent(
  events: EventRecord[],
  username: string,
  startsAt: Date,
  place: string,
): EventRecord | null {
  const normalizedUsername = normalizeInstagramUsername(username);
  const localDate = formatInTimeZone(
    startsAt,
    ROSARIO_TIME_ZONE,
    "yyyy-MM-dd",
  );

  return (
    events.find((event) => {
      if (event.status !== "active") {
        return false;
      }
      const eventStart = new Date(event.nextSocialDate);
      if (
        formatInTimeZone(eventStart, ROSARIO_TIME_ZONE, "yyyy-MM-dd") !==
        localDate
      ) {
        return false;
      }
      const minutes = Math.abs(differenceInMinutes(eventStart, startsAt));
      const sameSource =
        normalizeInstagramUsername(event.instagramAccount) ===
        normalizedUsername;
      return (
        (sameSource && minutes <= 180) ||
        (minutes <= 120 && relatedPlaces(event.address, place))
      );
    }) ?? null
  );
}

export function eventFromRequest(
  request: EventRequestRecord,
  now = new Date(),
): EventRecord {
  const startsAt = submissionStart(
    request.eventDate,
    request.eventTime,
    new Date(request.requestedAt),
  ).toISOString();
  const timestamp = now.toISOString();
  return {
    eventId: eventIdFor(request.username, startsAt, request.socialName),
    sourceId: sourceIdFor(request.username),
    instagramAccount: request.username,
    socialName: request.socialName,
    nextSocialDate: startsAt,
    endsAt: null,
    address: request.place,
    status: "active",
    attendants: 0,
    timeApproximate: false,
    sourceMediaIds: [`submission:${request.eventRequestId}`],
    sourcePermalinks: [
      `https://www.instagram.com/${request.username}/`,
    ],
    extractionConfidence: 1,
    sourcePublishedAt: request.requestedAt,
    createdAt: request.requestedAt,
    updatedAt: timestamp,
  };
}
