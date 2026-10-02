import {
  eventFromRequest,
  findDuplicateEvent,
  submissionStart,
} from "@/domain/event-submissions";
import {
  eventRequestIdFor,
  normalizeInstagramUsername,
  requestIdFor,
  sourceIdFor,
} from "@/domain/identity";
import type {
  EventRequestRecord,
  SourceRecord,
  SourceRequestRecord,
} from "@/domain/models";
import { classifyDanceSource } from "@/infrastructure/gemini/client";
import { fetchSourceProfile } from "@/infrastructure/meta/client";
import { getRepository } from "@/infrastructure/sheets/repository";
import { AppError } from "@/utils/errors";

type EventSubmissionInput = {
  date: string;
  time: string;
  place: string;
  username: string;
};

function sourceRequest(
  username: string,
  status: SourceRequestRecord["status"],
  note: string,
  now: Date,
  existing?: SourceRequestRecord,
): SourceRequestRecord {
  return {
    requestId: existing?.requestId ?? requestIdFor(username),
    username,
    status,
    requestedAt: existing?.requestedAt ?? now.toISOString(),
    reviewedAt: status === "pending" ? null : now.toISOString(),
    reviewNote: note,
  };
}

function eventRequest(
  input: EventSubmissionInput,
  username: string,
  socialName: string,
  status: EventRequestRecord["status"],
  now: Date,
  eventId: string | null,
  note: string | null,
): EventRequestRecord {
  return {
    eventRequestId: eventRequestIdFor(
      username,
      input.date,
      input.time,
      input.place,
    ),
    username,
    socialName,
    eventDate: input.date,
    eventTime: input.time,
    place: input.place.trim(),
    status,
    eventId,
    requestedAt: now.toISOString(),
    reviewedAt: status === "pending" ? null : now.toISOString(),
    reviewNote: note,
  };
}

export async function submitCommunityEvent(
  input: EventSubmissionInput,
  now = new Date(),
) {
  let username: string;
  try {
    username = normalizeInstagramUsername(input.username);
  } catch {
    throw new AppError(
      "Ingresá un usuario de Instagram válido.",
      400,
      "invalid_username",
    );
  }
  const startsAt = submissionStart(input.date, input.time, now);
  const repository = getRepository();
  const [events, sources, sourceRequests, eventRequests] = await Promise.all([
    repository.listEvents(),
    repository.listAllSources(),
    repository.listSourceRequests(),
    repository.listEventRequests(),
  ]);
  const eventRequestId = eventRequestIdFor(
    username,
    input.date,
    input.time,
    input.place,
  );
  const repeatedRequest = eventRequests.find(
    (request) => request.eventRequestId === eventRequestId,
  );
  if (repeatedRequest && repeatedRequest.status !== "rejected") {
    return {
      outcome: repeatedRequest.status,
      eventId: repeatedRequest.eventId,
      socialName: repeatedRequest.socialName,
    };
  }

  const duplicate = findDuplicateEvent(
    events,
    username,
    startsAt,
    input.place,
  );
  if (duplicate) {
    await repository.commitEventSubmission({
      eventRequest: eventRequest(
        input,
        username,
        duplicate.socialName,
        "duplicate",
        now,
        duplicate.eventId,
        "El evento ya estaba publicado.",
      ),
      event: null,
      source: null,
      sourceRequest: null,
    });
    return {
      outcome: "duplicate" as const,
      eventId: duplicate.eventId,
      socialName: duplicate.socialName,
    };
  }

  const knownSource = sources.find((source) => source.username === username);
  if (knownSource) {
    const profile = knownSource.enabled
      ? await fetchSourceProfile(username).catch(() => null)
      : null;
    const knownName =
      profile?.name ??
      events.find((event) => event.instagramAccount === username)?.socialName ??
      input.place.trim();
    const request = eventRequest(
      input,
      username,
      knownName,
      "approved",
      now,
      null,
      "Fuente conocida.",
    );
    const event = eventFromRequest(request, now);
    request.eventId = event.eventId;
    await repository.commitEventSubmission({
      eventRequest: request,
      event,
      source: null,
      sourceRequest: null,
    });
    return {
      outcome: "approved" as const,
      eventId: event.eventId,
      socialName: event.socialName,
    };
  }

  const profile = await fetchSourceProfile(username);
  const existingSourceRequest = sourceRequests.find(
    (request) => request.username === username,
  );
  if (!profile) {
    const request = eventRequest(
      input,
      username,
      input.place.trim(),
      "pending",
      now,
      null,
      "Meta no permite validar esta cuenta; requiere revisión manual.",
    );
    await repository.commitEventSubmission({
      eventRequest: request,
      event: null,
      source: null,
      sourceRequest: sourceRequest(
        username,
        "pending",
        "Meta Business Discovery no permite acceder a esta cuenta.",
        now,
        existingSourceRequest,
      ),
    });
    return {
      outcome: "pending" as const,
      eventId: null,
      socialName: request.socialName,
    };
  }

  const classification = await classifyDanceSource(profile);
  if (
    (classification.relevant || classification.danceSchool) &&
    classification.confidence >= 0.8
  ) {
    const timestamp = now.toISOString();
    const source: SourceRecord = {
      sourceId: sourceIdFor(username),
      username,
      enabled: true,
      lastSuccessfulWindow: null,
      lastCheckedAt: null,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const request = eventRequest(
      input,
      username,
      profile.name,
      "approved",
      now,
      null,
      classification.reason,
    );
    const event = eventFromRequest(request, now);
    request.eventId = event.eventId;
    await repository.commitEventSubmission({
      eventRequest: request,
      event,
      source,
      sourceRequest: null,
    });
    return {
      outcome: "approved" as const,
      eventId: event.eventId,
      socialName: event.socialName,
    };
  }

  const rejected =
    !classification.relevant &&
    !classification.danceSchool &&
    classification.confidence >= 0.8;
  const status = rejected ? "rejected" : "pending";
  const request = eventRequest(
    input,
    username,
    profile.name,
    status,
    now,
    null,
    classification.reason,
  );
  await repository.commitEventSubmission({
    eventRequest: request,
    event: null,
    source: null,
    sourceRequest: sourceRequest(
      username,
      status,
      classification.reason,
      now,
      existingSourceRequest,
    ),
  });
  return {
    outcome: status,
    eventId: null,
    socialName: request.socialName,
  };
}
