import { addDays, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { eventIdFor, ROSARIO_TIME_ZONE, sourceIdFor } from "./identity";
import type { EventRecord } from "./models";

type RecurringEvent = {
  username: string;
  name: string;
  weekday: number;
  hour: number;
  address: string;
};

export const recurringEventSources: RecurringEvent[] = [
  {
    username: "sentimientotorito.rosario1",
    name: "Sentimiento Torito",
    weekday: 0,
    hour: 16,
    address: "Mitre y el Río",
  },
  {
    username: "salsipuedesrosario",
    name: "Salsipuedes",
    weekday: 5,
    hour: 21,
    address: "Mercado del Patio",
  },
];

export function upcomingRecurringEvents(
  now = new Date(),
  days = 14,
): EventRecord[] {
  const localToday = startOfDay(toZonedTime(now, ROSARIO_TIME_ZONE));
  const timestamp = now.toISOString();
  const events: EventRecord[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const localDate = addDays(localToday, offset);
    for (const template of recurringEventSources) {
      if (localDate.getDay() !== template.weekday) {
        continue;
      }
      const localStart = new Date(localDate);
      localStart.setHours(template.hour, 0, 0, 0);
      const startsAt = fromZonedTime(
        localStart,
        ROSARIO_TIME_ZONE,
      ).toISOString();
      if (Date.parse(startsAt) <= now.getTime()) {
        continue;
      }

      events.push({
        eventId: eventIdFor(template.username, startsAt, template.name),
        sourceId: sourceIdFor(template.username),
        instagramAccount: template.username,
        socialName: template.name,
        nextSocialDate: startsAt,
        endsAt: null,
        address: template.address,
        status: "active",
        attendants: 0,
        timeApproximate: true,
        sourceMediaIds: [`recurring:${template.username}`],
        sourcePermalinks: [
          `https://www.instagram.com/${template.username}/`,
        ],
        extractionConfidence: 1,
        sourcePublishedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }

  return events;
}
