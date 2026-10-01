import type {
  EventRecord,
  EventRequestRecord,
  ExtractionReviewRecord,
  SourceRecord,
  SourceRequestRecord,
  SyncRunRecord,
} from "@/domain/models";

export type SyncCommit = {
  events: EventRecord[];
  reviews: ExtractionReviewRecord[];
  sources: SourceRecord[];
  runs: SyncRunRecord[];
  eventRequests?: EventRequestRecord[];
};

export type EventSubmissionCommit = {
  eventRequest: EventRequestRecord;
  event: EventRecord | null;
  source: SourceRecord | null;
  sourceRequest: SourceRequestRecord | null;
};

export interface SalseRosRepository {
  listPublicEvents(): Promise<EventRecord[]>;
  listEvents(): Promise<EventRecord[]>;
  listSources(): Promise<SourceRecord[]>;
  listAllSources(): Promise<SourceRecord[]>;
  listSourceRequests(): Promise<SourceRequestRecord[]>;
  listEventRequests(): Promise<EventRequestRecord[]>;
  toggleRsvp(
    eventId: string,
    rsvpId: string,
    attending: boolean,
    now: Date,
  ): Promise<number>;
  commitEventSubmission(commit: EventSubmissionCommit): Promise<void>;
  commitSync(commit: SyncCommit): Promise<void>;
}
