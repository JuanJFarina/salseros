import { createHmac } from "node:crypto";
import { parse } from "csv-parse/sync";

import type {
  EventRecord,
  RsvpRecord,
  SourceRecord,
  SourceRequestRecord,
} from "@/domain/models";
import {
  retainEvents,
  retainReviews,
  retainRsvps,
  retainRuns,
} from "@/domain/retention";
import type {
  SalseRosRepository,
  SourceRequestOutcome,
  SyncCommit,
} from "@/services/repository";
import { AppError } from "@/utils/errors";
import {
  getGoogleSheetsSettings,
  getRsvpSettings,
  isFixtureMode,
} from "@/utils/settings";

import { FixtureRepository } from "./fixture-repository";
import {
  eventFromRow,
  eventToRow,
  reviewFromRow,
  reviewToRow,
  rsvpFromRow,
  rsvpToRow,
  runFromRow,
  runToRow,
  sourceFromRow,
  sourceRequestFromRow,
  sourceRequestToRow,
  sourceToRow,
} from "./mappers";
import { GoogleSheetsStore, type SheetRow } from "./store";

class GoogleSheetsRepository implements SalseRosRepository {
  private readonly store = new GoogleSheetsStore();

  async listPublicEvents(): Promise<EventRecord[]> {
    const { eventsCsvUrl } = getGoogleSheetsSettings();
    const response = await fetch(eventsCsvUrl, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      console.warn(
        `Public Events CSV returned ${response.status}; using authenticated read`,
      );
      return (await this.store.read("Events")).map(eventFromRow);
    }

    const rows = parse(await response.text(), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as SheetRow[];
    const events: EventRecord[] = [];
    for (const row of rows) {
      try {
        events.push(eventFromRow(row));
      } catch (error) {
        console.error("Invalid Events row", error);
      }
    }
    return events;
  }

  async listSources(): Promise<SourceRecord[]> {
    return (await this.store.read("Sources"))
      .map(sourceFromRow)
      .filter((source) => source.enabled);
  }

  async toggleRsvp(
    eventId: string,
    rsvpId: string,
    attending: boolean,
    now: Date,
  ): Promise<number> {
    const [eventEntries, rsvpEntries] = await Promise.all([
      this.store.readEntries("Events"),
      this.store.readEntries("RSVPs"),
    ]);
    const eventEntry = eventEntries
      .map((entry) => ({ ...entry, event: eventFromRow(entry.row) }))
      .find((entry) => entry.event.eventId === eventId);
    if (!eventEntry || eventEntry.event.status !== "active") {
      throw new AppError("El evento ya no está disponible.", 404, "not_found");
    }

    const parsedRsvps = rsvpEntries.map((entry) => ({
      ...entry,
      rsvp: rsvpFromRow(entry.row),
    }));
    const existing = parsedRsvps.find(
      (entry) => entry.rsvp.rsvpId === rsvpId,
    );
    const timestamp = now.toISOString();
    let changedRsvp: RsvpRecord;
    if (existing) {
      changedRsvp = {
        ...existing.rsvp,
        attending,
        updatedAt: timestamp,
      };
      existing.rsvp = changedRsvp;
    } else {
      changedRsvp = {
        rsvpId,
        eventId,
        attending,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      parsedRsvps.push({
        rowNumber: 0,
        row: {},
        rsvp: changedRsvp,
      });
    }

    eventEntry.event.attendants = parsedRsvps.filter(
      (entry) =>
        entry.rsvp.eventId === eventId && entry.rsvp.attending,
    ).length;

    if (existing) {
      await this.store.updateRows([
        {
          name: "RSVPs",
          rowNumber: existing.rowNumber,
          row: rsvpToRow(changedRsvp),
        },
        {
          name: "Events",
          rowNumber: eventEntry.rowNumber,
          row: eventToRow(eventEntry.event),
        },
      ]);
    } else {
      await this.store.append("RSVPs", rsvpToRow(changedRsvp));
      await this.store.updateRows([
        {
          name: "Events",
          rowNumber: eventEntry.rowNumber,
          row: eventToRow(eventEntry.event),
        },
      ]);
    }
    return eventEntry.event.attendants;
  }

  async requestSource(
    request: SourceRequestRecord,
  ): Promise<SourceRequestOutcome> {
    const [sourceRows, requestRows] = await Promise.all([
      this.store.read("Sources"),
      this.store.read("SourceRequests"),
    ]);
    const sources = sourceRows.map(sourceFromRow);
    const requests = requestRows.map(sourceRequestFromRow);
    if (
      sources.some(
        (source) => source.enabled && source.username === request.username,
      )
    ) {
      return "already_active";
    }
    if (
      requests.some(
        (candidate) =>
          candidate.username === request.username &&
          candidate.status === "pending",
      )
    ) {
      return "duplicate";
    }

    await this.store.append("SourceRequests", sourceRequestToRow(request));
    return "created";
  }

  async commitSync(commit: SyncCommit): Promise<void> {
    const [eventRows, sourceRows, reviewRows, runRows, rsvpRows] =
      await Promise.all([
      this.store.read("Events"),
      this.store.read("Sources"),
      this.store.read("ExtractionReviews"),
      this.store.read("SyncRuns"),
      this.store.read("RSVPs"),
    ]);
    const now = new Date();
    const events = retainEvents(
      mergeEvents(eventRows.map(eventFromRow), commit.events),
      now,
    );
    const rsvps = retainRsvps(rsvpRows.map(rsvpFromRow), events);
    const sources = mergeBy(
      sourceRows.map(sourceFromRow),
      commit.sources,
      (source) => source.sourceId,
    );
    const reviews = retainReviews(
      mergeBy(
        reviewRows.map(reviewFromRow),
        commit.reviews,
        (review) => review.reviewId,
      ),
      now,
    );
    const runs = retainRuns(
      mergeBy(
        runRows.map(runFromRow),
        commit.runs,
        (run) => run.syncRunId,
      ),
      now,
    );

    await this.store.replace({
      Events: events.map(eventToRow),
      RSVPs: rsvps.map(rsvpToRow),
      Sources: sources.map(sourceToRow),
      ExtractionReviews: reviews.map(reviewToRow),
      SyncRuns: runs.map(runToRow),
    });
  }
}

function mergeBy<T>(
  existing: T[],
  incoming: T[],
  identity: (value: T) => string,
): T[] {
  const merged = new Map(existing.map((value) => [identity(value), value]));
  incoming.forEach((value) => merged.set(identity(value), value));
  return [...merged.values()];
}

function mergeEvents(
  existing: EventRecord[],
  incoming: EventRecord[],
): EventRecord[] {
  const merged = new Map(existing.map((event) => [event.eventId, event]));
  for (const candidate of incoming) {
    const current = merged.get(candidate.eventId);
    if (!current) {
      merged.set(candidate.eventId, candidate);
      continue;
    }

    const contentChanged =
      current.socialName !== candidate.socialName ||
      current.nextSocialDate !== candidate.nextSocialDate ||
      current.endsAt !== candidate.endsAt ||
      current.address !== candidate.address ||
      current.status !== candidate.status ||
      current.timeApproximate !== candidate.timeApproximate;
    merged.set(candidate.eventId, {
      ...candidate,
      attendants: current.attendants,
      createdAt: current.createdAt,
      updatedAt: contentChanged ? candidate.updatedAt : current.updatedAt,
      sourceMediaIds: [
        ...new Set([...current.sourceMediaIds, ...candidate.sourceMediaIds]),
      ],
      sourcePermalinks: [
        ...new Set([...current.sourcePermalinks, ...candidate.sourcePermalinks]),
      ],
    });
  }
  return [...merged.values()];
}

let repository: SalseRosRepository | null = null;

export function getRepository(): SalseRosRepository {
  if (!repository) {
    repository = isFixtureMode()
      ? new FixtureRepository()
      : new GoogleSheetsRepository();
  }
  return repository;
}

export function rsvpIdFor(eventId: string, visitorToken: string): string {
  const { hashSecret } = getRsvpSettings();
  return createHmac("sha256", hashSecret)
    .update(`${eventId}:${visitorToken}`)
    .digest("hex");
}
