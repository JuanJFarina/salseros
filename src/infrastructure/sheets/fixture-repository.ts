import { addDays, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import {
  eventIdFor,
  ROSARIO_TIME_ZONE,
  sourceIdFor,
} from "@/domain/identity";
import type {
  EventRecord,
  ExtractionReviewRecord,
  RsvpRecord,
  SourceRecord,
  SourceRequestRecord,
  SyncRunRecord,
} from "@/domain/models";
import type {
  SalseRosRepository,
  SourceRequestOutcome,
  SyncCommit,
} from "@/services/repository";
import { AppError } from "@/utils/errors";

const usernames = [
  "azukita.sb",
  "lamalicia.salsaybachata",
  "siempre.mister",
  "la_fest_sb",
  "echamelaculpa.bs",
  "elite.danceclub",
  "la_clave_rio",
  "rumbavanaok",
  "asereok",
  "patipami.d7",
  "salsa.vana_",
];

function futureDate(days: number, hour: number, minute: number): string {
  const local = addDays(
    startOfDay(toZonedTime(new Date(), ROSARIO_TIME_ZONE)),
    days,
  );
  local.setHours(hour, minute, 0, 0);
  return fromZonedTime(local, ROSARIO_TIME_ZONE).toISOString();
}

function fixtureEvent(
  username: string,
  name: string,
  days: number,
  hour: number,
  address: string,
  attendants: number,
): EventRecord {
  const startsAt = futureDate(days, hour, 0);
  const timestamp = new Date().toISOString();
  return {
    eventId: eventIdFor(username, startsAt, name),
    sourceId: sourceIdFor(username),
    instagramAccount: username,
    socialName: name,
    nextSocialDate: startsAt,
    endsAt: null,
    address,
    status: "active",
    attendants,
    timeApproximate: false,
    sourceMediaIds: [],
    sourcePermalinks: [`https://www.instagram.com/${username}/`],
    extractionConfidence: 1,
    sourcePublishedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const createdAt = new Date().toISOString();
let events = [
  fixtureEvent("rumbavanaok", "Rumba", 1, 23, "Lagos 1567", 18),
  fixtureEvent("azukita.sb", "Azukita Social", 3, 22, "Salta 2829", 9),
  fixtureEvent(
    "lamalicia.salsaybachata",
    "La Malicia",
    3,
    23,
    "Güemes 2808",
    14,
  ),
];
let sources: SourceRecord[] = usernames.map((username) => ({
  sourceId: sourceIdFor(username),
  username,
  enabled: true,
  lastSuccessfulWindow: null,
  lastCheckedAt: null,
  lastError: null,
  createdAt,
  updatedAt: createdAt,
}));
const rsvps: RsvpRecord[] = [];
const requests: SourceRequestRecord[] = [];
let reviews: ExtractionReviewRecord[] = [];
let runs: SyncRunRecord[] = [];

export class FixtureRepository implements SalseRosRepository {
  async listPublicEvents(): Promise<EventRecord[]> {
    return structuredClone(events);
  }

  async listSources(): Promise<SourceRecord[]> {
    return structuredClone(sources);
  }

  async toggleRsvp(
    eventId: string,
    rsvpId: string,
    attending: boolean,
    now: Date,
  ): Promise<number> {
    const event = events.find((candidate) => candidate.eventId === eventId);
    if (!event) {
      throw new AppError("El evento ya no está disponible.", 404, "not_found");
    }

    const existing = rsvps.find((rsvp) => rsvp.rsvpId === rsvpId);
    if (existing) {
      existing.attending = attending;
      existing.updatedAt = now.toISOString();
    } else {
      rsvps.push({
        rsvpId,
        eventId,
        attending,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    }
    event.attendants = rsvps.filter(
      (rsvp) => rsvp.eventId === eventId && rsvp.attending,
    ).length;
    return event.attendants;
  }

  async requestSource(
    request: SourceRequestRecord,
  ): Promise<SourceRequestOutcome> {
    if (sources.some((source) => source.username === request.username)) {
      return "already_active";
    }
    if (requests.some((candidate) => candidate.username === request.username)) {
      return "duplicate";
    }
    requests.push(request);
    return "created";
  }

  async commitSync(commit: SyncCommit): Promise<void> {
    events = mergeBy(events, commit.events, (event) => event.eventId);
    sources = mergeBy(sources, commit.sources, (source) => source.sourceId);
    reviews = mergeBy(
      reviews,
      commit.reviews,
      (review) => review.reviewId,
    );
    runs = mergeBy(runs, commit.runs, (run) => run.syncRunId);
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
