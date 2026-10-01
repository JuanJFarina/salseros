import { describe, expect, it } from "vitest";

import type {
  EventRecord,
  ExtractionReviewRecord,
  RsvpRecord,
  SyncRunRecord,
} from "@/domain/models";
import {
  retainEvents,
  retainReviews,
  retainRsvps,
  retainRuns,
} from "@/domain/retention";

function event(eventId: string, startsAt: string): EventRecord {
  return {
    eventId,
    sourceId: "source",
    instagramAccount: "source",
    socialName: eventId,
    nextSocialDate: startsAt,
    endsAt: null,
    address: "Rosario",
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

describe("bounded retention", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");

  it("removes events more than 48 hours beyond their inferred end", () => {
    const retained = retainEvents(
      [
        event("expired", "2026-10-06T12:00:00.000Z"),
        event("recent", "2026-10-08T12:00:00.000Z"),
        event("future", "2026-11-20T12:00:00.000Z"),
      ],
      now,
    );

    expect(retained.map((item) => item.eventId)).toEqual([
      "recent",
      "future",
    ]);
  });

  it("removes RSVP rows whose event no longer exists", () => {
    const rsvps: RsvpRecord[] = [
      {
        rsvpId: "kept",
        eventId: "active",
        attending: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        rsvpId: "removed",
        eventId: "expired",
        attending: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ];

    expect(
      retainRsvps(rsvps, [event("active", "2026-10-11T12:00:00.000Z")]),
    ).toHaveLength(1);
  });

  it("keeps only reviews from the rolling 30-day window", () => {
    const review = (reviewId: string, createdAt: string) =>
      ({
        reviewId,
        sourceId: "source",
        mediaId: reviewId,
        permalink: "https://www.instagram.com/p/example/",
        captionResultJson: "{}",
        visionResultJson: "{}",
        reason: "test",
        status: "pending",
        createdAt,
        resolvedAt: null,
      }) satisfies ExtractionReviewRecord;

    expect(
      retainReviews(
        [
          review("old", "2026-08-01T12:00:00.000Z"),
          review("current", "2026-10-01T12:00:00.000Z"),
        ],
        now,
      ).map((item) => item.reviewId),
    ).toEqual(["current"]);
  });

  it("keeps only synchronization runs from the rolling 30-day window", () => {
    const run = (syncRunId: string, startedAt: string) =>
      ({
        syncRunId,
        invocationId: syncRunId,
        sourceId: "source",
        windowKey: "window",
        status: "succeeded",
        publicationsChecked: 3,
        startedAt,
        completedAt: startedAt,
        errorCode: null,
        errorMessage: null,
      }) satisfies SyncRunRecord;

    expect(
      retainRuns(
        [
          run("old", "2026-08-01T12:00:00.000Z"),
          run("current", "2026-10-01T12:00:00.000Z"),
        ],
        now,
      ).map((item) => item.syncRunId),
    ).toEqual(["current"]);
  });
});
