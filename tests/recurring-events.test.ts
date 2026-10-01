import { describe, expect, it } from "vitest";

import { upcomingRecurringEvents } from "@/domain/recurring-events";

describe("upcomingRecurringEvents", () => {
  it("generates Friday and Sunday occurrences in Rosario time", () => {
    const events = upcomingRecurringEvents(
      new Date("2026-10-01T15:00:00.000Z"),
      7,
    );

    expect(
      events.map((event) => ({
        name: event.socialName,
        startsAt: event.nextSocialDate,
        approximate: event.timeApproximate,
      })),
    ).toEqual([
      {
        name: "Salsipuedes",
        startsAt: "2026-10-03T00:00:00.000Z",
        approximate: true,
      },
      {
        name: "Sentimiento Torito",
        startsAt: "2026-10-04T19:00:00.000Z",
        approximate: true,
      },
    ]);
  });

  it("does not regenerate an occurrence that already started", () => {
    const events = upcomingRecurringEvents(
      new Date("2026-10-03T01:00:00.000Z"),
      7,
    );

    expect(events.some((event) => event.socialName === "Salsipuedes")).toBe(
      false,
    );
  });
});
