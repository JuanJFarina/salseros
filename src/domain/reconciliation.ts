import { formatInTimeZone } from "date-fns-tz";

import {
  eventIdFor,
  normalizeEventText,
  reviewIdFor,
  ROSARIO_TIME_ZONE,
  sourceIdFor,
} from "./identity";
import type {
  EventRecord,
  ExtractionCandidate,
  ExtractionResult,
  ExtractionReviewRecord,
  InstagramPublication,
} from "./models";

type ReconciliationResult = {
  events: EventRecord[];
  review: ExtractionReviewRecord | null;
};

function localDate(value: string): string {
  return formatInTimeZone(
    new Date(value),
    ROSARIO_TIME_ZONE,
    "yyyy-MM-dd",
  );
}

function relatedText(left: string, right: string): boolean {
  const normalizedLeft = normalizeEventText(left);
  const normalizedRight = normalizeEventText(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

function matchingVisualCandidate(
  caption: ExtractionCandidate,
  vision: ExtractionCandidate[],
): ExtractionCandidate | null {
  const candidates = vision.filter(
    (candidate) => localDate(candidate.startsAt) === localDate(caption.startsAt),
  );
  return (
    candidates.find(
      (candidate) =>
        relatedText(candidate.name, caption.name) &&
        relatedText(candidate.address, caption.address) &&
        Math.abs(
          Date.parse(candidate.startsAt) - Date.parse(caption.startsAt),
        ) <=
          90 * 60 * 1000,
    ) ?? null
  );
}

function candidateIssue(
  candidate: ExtractionCandidate,
  now: Date,
): string | null {
  if (!candidate.name.trim() || !candidate.address.trim()) {
    return "missing required event fields";
  }
  if (Number.isNaN(Date.parse(candidate.startsAt))) {
    return "invalid event start";
  }
  if (candidate.endsAt && Number.isNaN(Date.parse(candidate.endsAt))) {
    return "invalid event end";
  }
  if (Date.parse(candidate.startsAt) <= now.getTime()) {
    return "event is not in the future";
  }
  return null;
}

export function reconcilePublication(
  username: string,
  publication: InstagramPublication,
  captionResult: ExtractionResult,
  visionResult: ExtractionResult,
  now = new Date(),
): ReconciliationResult {
  const sourceId = sourceIdFor(username);
  const events: EventRecord[] = [];
  const issues: string[] = [];

  if (captionResult.events.length === 0 && visionResult.events.length > 0) {
    issues.push("vision found an event that the caption did not confirm");
  }

  for (const candidate of captionResult.events) {
    const issue = candidateIssue(candidate, now);
    if (issue) {
      issues.push(issue);
      continue;
    }

    const visualMatch = matchingVisualCandidate(
      candidate,
      visionResult.events,
    );
    if (visionResult.events.length > 0 && !visualMatch) {
      issues.push(`caption and vision disagree for ${candidate.name}`);
      continue;
    }
    if (!visualMatch && candidate.confidence < 0.85) {
      issues.push(`caption confidence is too low for ${candidate.name}`);
      continue;
    }

    const confidence = visualMatch
      ? (candidate.confidence + visualMatch.confidence) / 2
      : candidate.confidence * 0.9;
    const timestamp = now.toISOString();
    events.push({
      eventId: eventIdFor(username, candidate.startsAt, candidate.name),
      sourceId,
      instagramAccount: username,
      socialName: candidate.name.trim(),
      nextSocialDate: candidate.startsAt,
      endsAt: candidate.endsAt,
      address: candidate.address.trim(),
      status: "active",
      attendants: 0,
      timeApproximate: false,
      sourceMediaIds: [publication.mediaId],
      sourcePermalinks: [publication.permalink],
      extractionConfidence: confidence,
      sourcePublishedAt: publication.publishedAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  const review =
    issues.length === 0
      ? null
      : {
          reviewId: reviewIdFor(sourceId, publication.mediaId),
          sourceId,
          mediaId: publication.mediaId,
          permalink: publication.permalink,
          captionResultJson: JSON.stringify(captionResult),
          visionResultJson: JSON.stringify(visionResult),
          reason: [...new Set(issues)].join("; "),
          status: "pending" as const,
          createdAt: now.toISOString(),
          resolvedAt: null,
        };

  return { events, review };
}

export function mergeDuplicateEvents(events: EventRecord[]): EventRecord[] {
  const merged = new Map<string, EventRecord>();

  for (const event of events) {
    const existing = merged.get(event.eventId);
    if (!existing) {
      merged.set(event.eventId, event);
      continue;
    }

    merged.set(event.eventId, {
      ...existing,
      sourceMediaIds: [
        ...new Set([...existing.sourceMediaIds, ...event.sourceMediaIds]),
      ],
      sourcePermalinks: [
        ...new Set([...existing.sourcePermalinks, ...event.sourcePermalinks]),
      ],
      extractionConfidence: Math.max(
        existing.extractionConfidence,
        event.extractionConfidence,
      ),
      sourcePublishedAt:
        existing.sourcePublishedAt > event.sourcePublishedAt
          ? existing.sourcePublishedAt
          : event.sourcePublishedAt,
    });
  }

  return [...merged.values()];
}
