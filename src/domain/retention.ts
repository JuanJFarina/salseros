import { addHours, subDays } from "date-fns";

import type {
  EventRecord,
  EventRequestRecord,
  ExtractionReviewRecord,
  RsvpRecord,
  SyncRunRecord,
} from "./models";

function effectiveEventEnd(event: EventRecord): number {
  if (event.endsAt) {
    return Date.parse(event.endsAt);
  }
  return addHours(new Date(event.nextSocialDate), 6).getTime();
}

export function retainEvents(
  events: EventRecord[],
  now = new Date(),
): EventRecord[] {
  const cutoff = now.getTime() - 48 * 60 * 60 * 1000;
  return events.filter((event) => {
    const end = effectiveEventEnd(event);
    return Number.isFinite(end) && end >= cutoff;
  });
}

export function retainRsvps(
  rsvps: RsvpRecord[],
  events: EventRecord[],
): RsvpRecord[] {
  const eventIds = new Set(events.map((event) => event.eventId));
  return rsvps.filter((rsvp) => eventIds.has(rsvp.eventId));
}

export function retainReviews(
  reviews: ExtractionReviewRecord[],
  now = new Date(),
): ExtractionReviewRecord[] {
  const cutoff = subDays(now, 30).getTime();
  return reviews.filter((review) => {
    const timestamp = Date.parse(review.resolvedAt ?? review.createdAt);
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
}

export function retainRuns(
  runs: SyncRunRecord[],
  now = new Date(),
): SyncRunRecord[] {
  const cutoff = subDays(now, 30).getTime();
  return runs.filter((run) => {
    const timestamp = Date.parse(run.startedAt);
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
}

export function retainEventRequests(
  requests: EventRequestRecord[],
  now = new Date(),
): EventRequestRecord[] {
  const cutoff = subDays(now, 30).getTime();
  return requests.filter((request) => {
    if (request.status === "pending") {
      return true;
    }
    const timestamp = Date.parse(request.reviewedAt ?? request.requestedAt);
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
}
