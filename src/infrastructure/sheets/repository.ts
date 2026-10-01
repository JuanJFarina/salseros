import { createHmac } from "node:crypto";
import { parse } from "csv-parse/sync";

import type {
  EventRecord,
  EventRequestRecord,
  RsvpRecord,
  SourceRecord,
  SourceRequestRecord,
} from "@/domain/models";
import {
  retainEvents,
  retainEventRequests,
  retainReviews,
  retainRsvps,
  retainRuns,
} from "@/domain/retention";
import type {
  EventSubmissionCommit,
  SalseRosRepository,
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
  eventRequestFromRow,
  eventRequestToRow,
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

  async listEvents(): Promise<EventRecord[]> {
    return (await this.store.read("Events")).map(eventFromRow);
  }

  async listSources(): Promise<SourceRecord[]> {
    return (await this.listAllSources()).filter((source) => source.enabled);
  }

  async listAllSources(): Promise<SourceRecord[]> {
    return (await this.store.read("Sources")).map(sourceFromRow);
  }

  async listSourceRequests(): Promise<SourceRequestRecord[]> {
    return (await this.store.read("SourceRequests")).map(
      sourceRequestFromRow,
    );
  }

  async listEventRequests(): Promise<EventRequestRecord[]> {
    return (await this.store.read("EventRequests")).map(
      eventRequestFromRow,
    );
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

  async commitEventSubmission(
    commit: EventSubmissionCommit,
  ): Promise<void> {
    const [eventRows, sourceRows, sourceRequestRows, eventRequestRows] =
      await Promise.all([
        this.store.read("Events"),
        this.store.read("Sources"),
        this.store.read("SourceRequests"),
        this.store.read("EventRequests"),
      ]);
    const events = mergeEvents(
      eventRows.map(eventFromRow),
      commit.event ? [commit.event] : [],
    );
    const sources = mergeBy(
      sourceRows.map(sourceFromRow),
      commit.source ? [commit.source] : [],
      (source) => source.sourceId,
    );
    const sourceRequests = mergeBy(
      sourceRequestRows.map(sourceRequestFromRow),
      commit.sourceRequest ? [commit.sourceRequest] : [],
      (request) => request.requestId,
    ).filter(
      (request) =>
        !sources.some((source) => source.username === request.username),
    );
    const eventRequests = retainEventRequests(
      mergeBy(
        eventRequestRows.map(eventRequestFromRow),
        [commit.eventRequest],
        (request) => request.eventRequestId,
      ),
    );

    await this.store.replace({
      Events: events.map(eventToRow),
      Sources: sources.map(sourceToRow),
      SourceRequests: sourceRequests.map(sourceRequestToRow),
      EventRequests: eventRequests.map(eventRequestToRow),
    });
  }

  async commitSync(commit: SyncCommit): Promise<void> {
    const [
      eventRows,
      sourceRows,
      reviewRows,
      runRows,
      rsvpRows,
      sourceRequestRows,
      eventRequestRows,
    ] =
      await Promise.all([
      this.store.read("Events"),
      this.store.read("Sources"),
      this.store.read("ExtractionReviews"),
      this.store.read("SyncRuns"),
      this.store.read("RSVPs"),
      this.store.read("SourceRequests"),
      this.store.read("EventRequests"),
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
    const sourceRequests = sourceRequestRows
      .map(sourceRequestFromRow)
      .filter(
        (request) =>
          !sources.some((source) => source.username === request.username),
      );
    const eventRequests = retainEventRequests(
      mergeBy(
        eventRequestRows.map(eventRequestFromRow),
        commit.eventRequests ?? [],
        (request) => request.eventRequestId,
      ),
      now,
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
      SourceRequests: sourceRequests.map(sourceRequestToRow),
      EventRequests: eventRequests.map(eventRequestToRow),
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
