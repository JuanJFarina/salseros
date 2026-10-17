import { describe, expect, it } from "vitest";

import type {
  ExtractedEventType,
  ExtractionResult,
  InstagramPublication,
} from "@/domain/models";
import {
  mergeDuplicateEvents,
  reconcilePublication,
} from "@/domain/reconciliation";

const publication: InstagramPublication = {
  mediaId: "media-1",
  caption: "Rumba, sábado 3",
  mediaType: "IMAGE",
  permalink: "https://www.instagram.com/p/example/",
  publishedAt: "2026-09-28T18:08:58.000Z",
  visualUrls: [],
};

function extraction(
  address = "Lagos 1567",
  confidence = 0.95,
  name = "Rumba",
  eventType: ExtractedEventType = "social",
  hasSocialDancing = true,
): ExtractionResult {
  return {
    events: [
      {
        name,
        startsAt: "2026-10-03T23:15:00-03:00",
        endsAt: "2026-10-04T04:00:00-03:00",
        address,
        evidence: "Sábado 3, Lagos 1567",
        eventType,
        hasSocialDancing,
        confidence,
      },
    ],
  };
}

describe("reconcilePublication", () => {
  it("publishes an event when caption and vision agree", () => {
    const result = reconcilePublication(
      "rumbavanaok",
      publication,
      extraction(),
      extraction("Ov. Lagos 1567", 0.95, "Tus Martes a puro Baile"),
      new Date("2026-10-01T12:00:00.000Z"),
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0].socialName).toBe("Rumba");
    expect(result.review).toBeNull();
  });

  it("queues a review when visual evidence disagrees", () => {
    const result = reconcilePublication(
      "rumbavanaok",
      publication,
      extraction(),
      extraction("Güemes 2808"),
      new Date("2026-10-01T12:00:00.000Z"),
    );

    expect(result.events).toEqual([]);
    expect(result.review?.reason).toContain("disagree");

    const competition = reconcilePublication(
      "rumbavanaok",
      publication,
      extraction("Lagos 1567", 1, "El Mundial", "competition", false),
      { events: [] },
      new Date("2026-10-01T12:00:00.000Z"),
    );
    expect(competition.events).toEqual([]);
    expect(competition.review?.reason).toContain("not a participatory social");
  });

  it("accepts complete high-confidence evidence from either path", () => {
    const captionOnly = reconcilePublication(
      "rumbavanaok",
      publication,
      extraction(),
      { events: [] },
      new Date("2026-10-01T12:00:00.000Z"),
    );
    const visionOnly = reconcilePublication(
      "rumbavanaok",
      publication,
      { events: [] },
      extraction(),
      new Date("2026-10-01T12:00:00.000Z"),
    );

    expect(captionOnly.events).toHaveLength(1);
    expect(captionOnly.events[0].extractionConfidence).toBeCloseTo(0.855);
    expect(visionOnly.events).toHaveLength(1);
    expect(visionOnly.events[0].extractionConfidence).toBe(0.95);
  });
});

describe("mergeDuplicateEvents", () => {
  it("merges publication provenance for the same event", () => {
    const first = reconcilePublication(
      "rumbavanaok",
      publication,
      extraction(),
      extraction(),
      new Date("2026-10-01T12:00:00.000Z"),
    ).events[0];
    const second = {
      ...first,
      sourceMediaIds: ["media-2"],
      sourcePermalinks: ["https://www.instagram.com/p/second/"],
    };

    const merged = mergeDuplicateEvents([first, second]);

    expect(merged).toHaveLength(1);
    expect(merged[0].sourceMediaIds).toEqual(["media-1", "media-2"]);
  });

  it("merges events from the same Instagram account on the same local date", () => {
    const first = reconcilePublication(
      "rumbavanaok",
      publication,
      extraction(),
      extraction(),
      new Date("2026-10-01T12:00:00.000Z"),
    ).events[0];
    const second = {
      ...first,
      eventId: "different-event-id",
      nextSocialDate: "2026-10-03T22:00:00-03:00",
      sourceMediaIds: ["media-2"],
      sourcePermalinks: ["https://www.instagram.com/p/second/"],
    };

    const merged = mergeDuplicateEvents([first, second]);

    expect(merged).toHaveLength(1);
    expect(merged[0].sourceMediaIds).toEqual(["media-1", "media-2"]);
  });

  it("keeps events from the same account on different local dates separate", () => {
    const first = reconcilePublication(
      "rumbavanaok",
      publication,
      extraction(),
      extraction(),
      new Date("2026-10-01T12:00:00.000Z"),
    ).events[0];
    const nextNight = {
      ...first,
      eventId: "next-night",
      nextSocialDate: "2026-10-04T22:00:00-03:00",
    };

    expect(mergeDuplicateEvents([first, nextNight])).toHaveLength(2);
  });
});
