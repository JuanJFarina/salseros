import { z } from "zod";

export const eventStatusSchema = z.enum(["active", "cancelled"]);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export type EventRecord = {
  eventId: string;
  sourceId: string;
  instagramAccount: string;
  socialName: string;
  nextSocialDate: string;
  endsAt: string | null;
  address: string;
  status: EventStatus;
  attendants: number;
  timeApproximate: boolean;
  sourceMediaIds: string[];
  sourcePermalinks: string[];
  extractionConfidence: number;
  sourcePublishedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type EventDay = {
  date: string;
  weekday: string;
  fullDate: string;
  events: EventRecord[];
};

export type EventsResponse = {
  generatedAt: string;
  updatedAt: string | null;
  window: {
    startsAt: string;
    endsAt: string;
  };
  days: EventDay[];
};

export type SourceRecord = {
  sourceId: string;
  username: string;
  enabled: boolean;
  lastSuccessfulWindow: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InstagramPublication = {
  mediaId: string;
  caption: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  permalink: string;
  publishedAt: string;
  visualUrls: string[];
};

export type RsvpRecord = {
  rsvpId: string;
  eventId: string;
  attending: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SourceRequestStatus = "pending" | "approved" | "rejected";

export type SourceRequestRecord = {
  requestId: string;
  username: string;
  status: SourceRequestStatus;
  requestedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type ExtractionCandidate = {
  name: string;
  startsAt: string;
  endsAt: string | null;
  address: string;
  evidence: string;
  confidence: number;
};

export type ExtractionResult = {
  events: ExtractionCandidate[];
};

export type ExtractionReviewRecord = {
  reviewId: string;
  sourceId: string;
  mediaId: string;
  permalink: string;
  captionResultJson: string;
  visionResultJson: string;
  reason: string;
  status: "pending" | "resolved" | "ignored";
  createdAt: string;
  resolvedAt: string | null;
};

export type SyncRunStatus = "running" | "succeeded" | "failed" | "skipped";

export type SyncRunRecord = {
  syncRunId: string;
  invocationId: string;
  sourceId: string;
  windowKey: string;
  status: SyncRunStatus;
  publicationsChecked: number;
  startedAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export const rsvpInputSchema = z.object({
  eventId: z.string().min(1).max(128),
  visitorToken: z.uuid(),
  attending: z.boolean(),
});

export const sourceRequestInputSchema = z.object({
  username: z.string().trim().min(1).max(64),
});
