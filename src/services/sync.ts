import { randomUUID } from "node:crypto";
import pLimit from "p-limit";

import {
  mergeDuplicateEvents,
  reconcilePublication,
} from "@/domain/reconciliation";
import {
  eventFromRequest,
  findDuplicateEvent,
  submissionStart,
} from "@/domain/event-submissions";
import { sourceIdFor, syncRunIdFor } from "@/domain/identity";
import { upcomingRecurringEvents } from "@/domain/recurring-events";
import type {
  EventRecord,
  EventRequestRecord,
  ExtractionReviewRecord,
  SourceRecord,
  SyncRunRecord,
} from "@/domain/models";
import { syncWindowKey } from "@/domain/sync-window";
import {
  extractCaptionEvents,
  extractVisionEvents,
} from "@/infrastructure/gemini/client";
import {
  fetchRecentPublications,
  inspectMetaToken,
} from "@/infrastructure/meta/client";
import { downloadVisualAssets } from "@/infrastructure/meta/media";
import { getRepository } from "@/infrastructure/sheets/repository";
import { getGeminiSettings, getSyncSettings } from "@/utils/settings";

type SourceSyncResult = {
  source: SourceRecord;
  events: EventRecord[];
  reviews: ExtractionReviewRecord[];
  run: SyncRunRecord;
  outcome: {
    username: string;
    status: "succeeded" | "failed" | "skipped";
    publicationsChecked: number;
    error: string | null;
  };
};

export type SyncResponse = {
  invocationId: string;
  windowKey: string;
  startedAt: string;
  completedAt: string;
  tokenWarning: string | null;
  sources: SourceSyncResult["outcome"][];
};

type ApprovedPromotions = {
  events: EventRecord[];
  sources: SourceRecord[];
  requests: EventRequestRecord[];
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown synchronization error";
}

function promoteApprovedRequests(
  requests: EventRequestRecord[],
  knownSources: SourceRecord[],
  knownEvents: EventRecord[],
  now: Date,
): ApprovedPromotions {
  const events: EventRecord[] = [];
  const sources: SourceRecord[] = [];
  const updates: EventRequestRecord[] = [];
  const sourceNames = new Set(knownSources.map((source) => source.username));
  const comparedEvents = [...knownEvents];

  for (const request of requests) {
    if (request.status !== "approved" || request.eventId) {
      continue;
    }
    try {
      const startsAt = submissionStart(
        request.eventDate,
        request.eventTime,
        now,
      );
      const duplicate = findDuplicateEvent(
        comparedEvents,
        request.username,
        startsAt,
        request.place,
      );
      if (duplicate) {
        updates.push({
          ...request,
          status: "duplicate",
          eventId: duplicate.eventId,
          reviewedAt: now.toISOString(),
          reviewNote: "El evento ya estaba publicado.",
        });
        continue;
      }

      const event = eventFromRequest(request, now);
      events.push(event);
      comparedEvents.push(event);
      updates.push({
        ...request,
        eventId: event.eventId,
        reviewedAt: now.toISOString(),
      });
      if (!sourceNames.has(request.username)) {
        const timestamp = now.toISOString();
        sources.push({
          sourceId: sourceIdFor(request.username),
          username: request.username,
          enabled: false,
          lastSuccessfulWindow: null,
          lastCheckedAt: null,
          lastError:
            "Fuente aprobada manualmente; escaneo de Meta deshabilitado.",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        sourceNames.add(request.username);
      }
    } catch (error) {
      updates.push({
        ...request,
        status: "rejected",
        reviewedAt: now.toISOString(),
        reviewNote: errorMessage(error),
      });
    }
  }

  return { events, sources, requests: updates };
}

async function syncSource(
  source: SourceRecord,
  windowKey: string,
  invocationId: string,
  geminiLimit: ReturnType<typeof pLimit>,
  now: Date,
): Promise<SourceSyncResult> {
  const startedAt = new Date().toISOString();
  const syncRunId = syncRunIdFor(source.sourceId, windowKey, invocationId);

  if (source.lastSuccessfulWindow === windowKey) {
    return {
      source,
      events: [],
      reviews: [],
      run: {
        syncRunId,
        invocationId,
        sourceId: source.sourceId,
        windowKey,
        status: "skipped",
        publicationsChecked: 0,
        startedAt,
        completedAt: new Date().toISOString(),
        errorCode: null,
        errorMessage: null,
      },
      outcome: {
        username: source.username,
        status: "skipped",
        publicationsChecked: 0,
        error: null,
      },
    };
  }

  try {
    const publications = await fetchRecentPublications(source.username);
    const reconciled = await Promise.all(
      publications.map(async (publication) => {
        const captionPromise = geminiLimit(() =>
          extractCaptionEvents(publication.caption, publication.publishedAt),
        );
        const visionPromise = downloadVisualAssets(
          publication.visualUrls,
        ).then((assets) =>
          geminiLimit(() =>
            extractVisionEvents(assets, publication.publishedAt),
          ),
        );
        const [caption, vision] = await Promise.all([
          captionPromise,
          visionPromise,
        ]);
        return reconcilePublication(
          source.username,
          publication,
          caption,
          vision,
          now,
        );
      }),
    );
    const completedAt = new Date().toISOString();
    const events = mergeDuplicateEvents(
      reconciled.flatMap((result) => result.events),
    );
    const reviews = reconciled
      .map((result) => result.review)
      .filter((review): review is ExtractionReviewRecord => review !== null);
    const updatedSource: SourceRecord = {
      ...source,
      lastSuccessfulWindow: windowKey,
      lastCheckedAt: completedAt,
      lastError: null,
      updatedAt: completedAt,
    };
    return {
      source: updatedSource,
      events,
      reviews,
      run: {
        syncRunId,
        invocationId,
        sourceId: source.sourceId,
        windowKey,
        status: "succeeded",
        publicationsChecked: publications.length,
        startedAt,
        completedAt,
        errorCode: null,
        errorMessage: null,
      },
      outcome: {
        username: source.username,
        status: "succeeded",
        publicationsChecked: publications.length,
        error: null,
      },
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = errorMessage(error);
    return {
      source: {
        ...source,
        lastCheckedAt: completedAt,
        lastError: message,
        updatedAt: completedAt,
      },
      events: [],
      reviews: [],
      run: {
        syncRunId,
        invocationId,
        sourceId: source.sourceId,
        windowKey,
        status: "failed",
        publicationsChecked: 0,
        startedAt,
        completedAt,
        errorCode: "source_sync_failed",
        errorMessage: message,
      },
      outcome: {
        username: source.username,
        status: "failed",
        publicationsChecked: 0,
        error: message,
      },
    };
  }
}

export async function synchronizeSources(
  now = new Date(),
): Promise<{ response: SyncResponse; status: number }> {
  const startedAt = now.toISOString();
  const invocationId = randomUUID();
  const windowKey = syncWindowKey(now);
  const token = await inspectMetaToken(now);
  if (!token.valid) {
    throw new Error("Meta access token is invalid");
  }

  const repository = getRepository();
  const [sources, allSources, eventRequests, existingEvents] =
    await Promise.all([
      repository.listSources(),
      repository.listAllSources(),
      repository.listEventRequests(),
      repository.listEvents(),
    ]);
  const promotions = promoteApprovedRequests(
    eventRequests,
    allSources,
    existingEvents,
    now,
  );
  const sourceLimit = pLimit(getSyncSettings().maxConcurrency);
  const geminiLimit = pLimit(getGeminiSettings().maxConcurrency);
  const results = await Promise.all(
    sources.map((source) =>
      sourceLimit(() =>
        syncSource(source, windowKey, invocationId, geminiLimit, now),
      ),
    ),
  );

  await repository.commitSync({
    events: [
      ...results.flatMap((result) => result.events),
      ...promotions.events,
      ...upcomingRecurringEvents(now),
    ],
    reviews: results.flatMap((result) => result.reviews),
    sources: [
      ...results.map((result) => result.source),
      ...promotions.sources,
    ],
    runs: results.map((result) => result.run),
    eventRequests: promotions.requests,
  });

  const outcomes = results.map((result) => result.outcome);
  const failures = outcomes.filter(
    (outcome) => outcome.status === "failed",
  ).length;
  const successes = outcomes.filter(
    (outcome) => outcome.status === "succeeded",
  ).length;
  const status =
    failures === 0 ? 200 : successes === 0 ? 500 : 207;

  return {
    status,
    response: {
      invocationId,
      windowKey,
      startedAt,
      completedAt: new Date().toISOString(),
      tokenWarning: token.warning,
      sources: outcomes,
    },
  };
}
