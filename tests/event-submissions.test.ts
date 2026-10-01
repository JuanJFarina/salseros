import { describe, expect, it } from "vitest";

import {
  findDuplicateEvent,
  submissionStart,
} from "@/domain/event-submissions";
import type { EventRecord } from "@/domain/models";

function event(
  username: string,
  startsAt: string,
  address: string,
): EventRecord {
  return {
    eventId: `${username}-${startsAt}`,
    sourceId: username,
    instagramAccount: username,
    socialName: "Social",
    nextSocialDate: startsAt,
    endsAt: null,
    address,
    status: "active",
    attendants: 0,
    timeApproximate: false,
    sourceMediaIds: [],
    sourcePermalinks: [],
    extractionConfidence: 1,
    sourcePublishedAt: startsAt,
    createdAt: startsAt,
    updatedAt: startsAt,
  };
}

describe("submissionStart", () => {
  it("resolves a Rosario date and time to the correct instant", () => {
    expect(
      submissionStart(
        "2026-10-17",
        "23:00",
        new Date("2026-10-01T12:00:00.000Z"),
      ).toISOString(),
    ).toBe("2026-10-18T02:00:00.000Z");
  });
});

describe("findDuplicateEvent", () => {
  const existing = event(
    "first.source",
    "2026-10-18T02:00:00.000Z",
    "San Nicolás 1940, Rosario",
  );

  it("matches the same event submitted by another source", () => {
    expect(
      findDuplicateEvent(
        [existing],
        "second.source",
        new Date("2026-10-18T02:30:00.000Z"),
        "San Nicolas 1940",
      )?.eventId,
    ).toBe(existing.eventId);
  });

  it("keeps sufficiently different events separate", () => {
    expect(
      findDuplicateEvent(
        [existing],
        "second.source",
        new Date("2026-10-18T05:30:00.000Z"),
        "Mercado del Patio",
      ),
    ).toBeNull();
  });
});
