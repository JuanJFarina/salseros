import { describe, expect, it } from "vitest";

import { buildEventsResponse } from "@/domain/calendar";
import type { EventRecord } from "@/domain/models";

function event(
  eventId: string,
  startsAt: string,
  status: EventRecord["status"] = "active",
): EventRecord {
  return {
    eventId,
    sourceId: "source",
    instagramAccount: "source",
    socialName: eventId,
    nextSocialDate: startsAt,
    endsAt: null,
    address: "Lagos 1567",
    status,
    attendants: 0,
    timeApproximate: false,
    sourceMediaIds: [],
    sourcePermalinks: [],
    extractionConfidence: 1,
    sourcePublishedAt: "2026-09-30T12:00:00.000Z",
    createdAt: "2026-09-30T12:00:00.000Z",
    updatedAt: "2026-09-30T12:00:00.000Z",
  };
}

describe("buildEventsResponse", () => {
  it("groups and orders active events in the seven-day window", () => {
    const response = buildEventsResponse(
      [
        event("later", "2026-10-03T23:00:00-03:00"),
        event("today", "2026-10-01T22:00:00-03:00"),
        event("cancelled", "2026-10-02T22:00:00-03:00", "cancelled"),
        event("outside", "2026-10-09T22:00:00-03:00"),
      ],
      new Date("2026-10-01T15:00:00.000Z"),
    );

    expect(response.days.map((day) => day.date)).toEqual([
      "2026-10-01",
      "2026-10-03",
    ]);
    expect(response.days.flatMap((day) => day.events.map((item) => item.eventId)))
      .toEqual(["today", "later"]);
    expect(response.futureEvents.map((item) => item.eventId)).toEqual([
      "outside",
    ]);
  });

  it("returns no day rows when the period has no events", () => {
    const response = buildEventsResponse(
      [event("past", "2026-09-20T22:00:00-03:00")],
      new Date("2026-10-01T15:00:00.000Z"),
    );

    expect(response.days).toEqual([]);
    expect(response.futureEvents).toEqual([]);
  });

  it("excludes configured recurring events from the later list", () => {
    const recurring = {
      ...event("recurring", "2026-10-11T16:00:00-03:00"),
      sourceMediaIds: ["recurring:source"],
    };
    const response = buildEventsResponse(
      [
        recurring,
        event("announced", "2026-10-17T23:00:00-03:00"),
      ],
      new Date("2026-10-01T15:00:00.000Z"),
    );

    expect(response.futureEvents.map((item) => item.eventId)).toEqual([
      "announced",
    ]);
  });
});
