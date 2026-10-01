import { addDays, addHours, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

import type { EventDay, EventRecord, EventsResponse } from "./models";
import { ROSARIO_TIME_ZONE } from "./identity";

export type EventWindow = {
  startsAt: Date;
  endsAt: Date;
};

export function eventWindow(now: Date): EventWindow {
  const localStart = startOfDay(toZonedTime(now, ROSARIO_TIME_ZONE));
  return {
    startsAt: fromZonedTime(localStart, ROSARIO_TIME_ZONE),
    endsAt: fromZonedTime(addDays(localStart, 7), ROSARIO_TIME_ZONE),
  };
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function dayFor(date: Date, events: EventRecord[]): EventDay {
  return {
    date: formatInTimeZone(date, ROSARIO_TIME_ZONE, "yyyy-MM-dd"),
    weekday: capitalize(
      new Intl.DateTimeFormat("es-AR", {
        weekday: "long",
        timeZone: ROSARIO_TIME_ZONE,
      }).format(date),
    ),
    fullDate: new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "long",
      timeZone: ROSARIO_TIME_ZONE,
    }).format(date),
    events,
  };
}

function effectiveEnd(event: EventRecord): Date {
  if (event.endsAt) {
    return new Date(event.endsAt);
  }
  return addHours(new Date(event.nextSocialDate), 6);
}

export function buildEventsResponse(
  events: EventRecord[],
  now = new Date(),
): EventsResponse {
  const window = eventWindow(now);
  const visibleEvents = events
    .filter((event) => event.status === "active")
    .filter((event) => {
      const startsAt = new Date(event.nextSocialDate);
      return (
        startsAt >= window.startsAt &&
        startsAt < window.endsAt &&
        effectiveEnd(event) > now
      );
    })
    .sort(
      (left, right) =>
        Date.parse(left.nextSocialDate) - Date.parse(right.nextSocialDate),
    );

  const grouped = new Map<string, EventRecord[]>();
  for (const event of visibleEvents) {
    const key = formatInTimeZone(
      new Date(event.nextSocialDate),
      ROSARIO_TIME_ZONE,
      "yyyy-MM-dd",
    );
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  const days = [...grouped.entries()].map(([, dayEvents]) =>
    dayFor(new Date(dayEvents[0].nextSocialDate), dayEvents),
  );
  const updatedAt =
    events
      .map((event) => event.updatedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  return {
    generatedAt: now.toISOString(),
    updatedAt,
    window: {
      startsAt: window.startsAt.toISOString(),
      endsAt: window.endsAt.toISOString(),
    },
    days,
  };
}
