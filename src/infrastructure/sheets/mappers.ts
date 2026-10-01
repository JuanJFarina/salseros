import type {
  EventRecord,
  ExtractionReviewRecord,
  RsvpRecord,
  SourceRecord,
  SourceRequestRecord,
  SyncRunRecord,
} from "@/domain/models";

import type { SheetRow } from "./store";

function stringArray(value: string): string[] {
  if (!value) {
    return [];
  }
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("Spreadsheet array value is invalid");
  }
  return parsed;
}

function optional(value: string): string | null {
  return value || null;
}

function required(row: SheetRow, key: string): string {
  const value = row[key]?.trim();
  if (!value) {
    throw new Error(`${key} is missing`);
  }
  return value;
}

export function eventFromRow(row: SheetRow): EventRecord {
  const attendants = Number(row.attendants || 0);
  const extractionConfidence = Number(row.extraction_confidence || 0);
  if (!Number.isInteger(attendants) || attendants < 0) {
    throw new Error("attendants is invalid");
  }
  if (!Number.isFinite(extractionConfidence)) {
    throw new Error("extraction_confidence is invalid");
  }

  return {
    eventId: required(row, "event_id"),
    sourceId: required(row, "source_id"),
    instagramAccount: required(row, "instagram_account"),
    socialName: required(row, "social_name"),
    nextSocialDate: required(row, "next_social_date"),
    endsAt: optional(row.ends_at),
    address: required(row, "address"),
    status: row.status === "cancelled" ? "cancelled" : "active",
    attendants,
    timeApproximate: (row.time_approximate ?? "").toLowerCase() === "true",
    sourceMediaIds: stringArray(row.source_media_ids),
    sourcePermalinks: stringArray(row.source_permalinks),
    extractionConfidence,
    sourcePublishedAt: required(row, "source_published_at"),
    createdAt: required(row, "created_at"),
    updatedAt: required(row, "updated_at"),
  };
}

export function eventToRow(event: EventRecord): SheetRow {
  return {
    event_id: event.eventId,
    source_id: event.sourceId,
    instagram_account: event.instagramAccount,
    social_name: event.socialName,
    next_social_date: event.nextSocialDate,
    ends_at: event.endsAt ?? "",
    address: event.address,
    status: event.status,
    attendants: String(event.attendants),
    source_media_ids: JSON.stringify(event.sourceMediaIds),
    source_permalinks: JSON.stringify(event.sourcePermalinks),
    extraction_confidence: String(event.extractionConfidence),
    source_published_at: event.sourcePublishedAt,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
    time_approximate: String(event.timeApproximate),
  };
}

export function sourceFromRow(row: SheetRow): SourceRecord {
  return {
    sourceId: required(row, "source_id"),
    username: required(row, "username"),
    enabled: row.enabled.toLowerCase() === "true",
    lastSuccessfulWindow: optional(row.last_successful_window),
    lastCheckedAt: optional(row.last_checked_at),
    lastError: optional(row.last_error),
    createdAt: required(row, "created_at"),
    updatedAt: required(row, "updated_at"),
  };
}

export function sourceToRow(source: SourceRecord): SheetRow {
  return {
    source_id: source.sourceId,
    username: source.username,
    enabled: String(source.enabled),
    last_successful_window: source.lastSuccessfulWindow ?? "",
    last_checked_at: source.lastCheckedAt ?? "",
    last_error: source.lastError ?? "",
    created_at: source.createdAt,
    updated_at: source.updatedAt,
  };
}

export function rsvpFromRow(row: SheetRow): RsvpRecord {
  return {
    rsvpId: required(row, "rsvp_id"),
    eventId: required(row, "event_id"),
    attending: row.attending.toLowerCase() === "true",
    createdAt: required(row, "created_at"),
    updatedAt: required(row, "updated_at"),
  };
}

export function rsvpToRow(rsvp: RsvpRecord): SheetRow {
  return {
    rsvp_id: rsvp.rsvpId,
    event_id: rsvp.eventId,
    attending: String(rsvp.attending),
    created_at: rsvp.createdAt,
    updated_at: rsvp.updatedAt,
  };
}

export function sourceRequestFromRow(row: SheetRow): SourceRequestRecord {
  const status =
    row.status === "approved" || row.status === "rejected"
      ? row.status
      : "pending";
  return {
    requestId: required(row, "request_id"),
    username: required(row, "username"),
    status,
    requestedAt: required(row, "requested_at"),
    reviewedAt: optional(row.reviewed_at),
    reviewNote: optional(row.review_note),
  };
}

export function sourceRequestToRow(request: SourceRequestRecord): SheetRow {
  return {
    request_id: request.requestId,
    username: request.username,
    status: request.status,
    requested_at: request.requestedAt,
    reviewed_at: request.reviewedAt ?? "",
    review_note: request.reviewNote ?? "",
  };
}

export function reviewFromRow(row: SheetRow): ExtractionReviewRecord {
  const status =
    row.status === "resolved" || row.status === "ignored"
      ? row.status
      : "pending";
  return {
    reviewId: required(row, "review_id"),
    sourceId: required(row, "source_id"),
    mediaId: required(row, "media_id"),
    permalink: required(row, "permalink"),
    captionResultJson: required(row, "caption_result_json"),
    visionResultJson: required(row, "vision_result_json"),
    reason: required(row, "reason"),
    status,
    createdAt: required(row, "created_at"),
    resolvedAt: optional(row.resolved_at),
  };
}

export function reviewToRow(review: ExtractionReviewRecord): SheetRow {
  return {
    review_id: review.reviewId,
    source_id: review.sourceId,
    media_id: review.mediaId,
    permalink: review.permalink,
    caption_result_json: review.captionResultJson,
    vision_result_json: review.visionResultJson,
    reason: review.reason,
    status: review.status,
    created_at: review.createdAt,
    resolved_at: review.resolvedAt ?? "",
  };
}

export function runFromRow(row: SheetRow): SyncRunRecord {
  const status =
    row.status === "succeeded" ||
    row.status === "failed" ||
    row.status === "skipped"
      ? row.status
      : "running";
  return {
    syncRunId: required(row, "sync_run_id"),
    invocationId: required(row, "invocation_id"),
    sourceId: required(row, "source_id"),
    windowKey: required(row, "window_key"),
    status,
    publicationsChecked: Number(row.publications_checked || 0),
    startedAt: required(row, "started_at"),
    completedAt: optional(row.completed_at),
    errorCode: optional(row.error_code),
    errorMessage: optional(row.error_message),
  };
}

export function runToRow(run: SyncRunRecord): SheetRow {
  return {
    sync_run_id: run.syncRunId,
    invocation_id: run.invocationId,
    source_id: run.sourceId,
    window_key: run.windowKey,
    status: run.status,
    publications_checked: String(run.publicationsChecked),
    started_at: run.startedAt,
    completed_at: run.completedAt ?? "",
    error_code: run.errorCode ?? "",
    error_message: run.errorMessage ?? "",
  };
}
