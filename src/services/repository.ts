import type {
  EventRecord,
  ExtractionReviewRecord,
  SourceRecord,
  SourceRequestRecord,
  SyncRunRecord,
} from "@/domain/models";

export type SourceRequestOutcome = "created" | "duplicate" | "already_active";

export type SyncCommit = {
  events: EventRecord[];
  reviews: ExtractionReviewRecord[];
  sources: SourceRecord[];
  runs: SyncRunRecord[];
};

export interface SalseRosRepository {
  listPublicEvents(): Promise<EventRecord[]>;
  listSources(): Promise<SourceRecord[]>;
  toggleRsvp(
    eventId: string,
    rsvpId: string,
    attending: boolean,
    now: Date,
  ): Promise<number>;
  requestSource(
    request: SourceRequestRecord,
  ): Promise<SourceRequestOutcome>;
  commitSync(commit: SyncCommit): Promise<void>;
}
