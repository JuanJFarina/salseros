# Project Management Plan

## Scope

The MVP delivers one Spanish-first SalseRos page, anonymous attendance toggles, Instagram source requests, and an externally invoked synchronization pipeline. It covers public professional Instagram accounts supplied by the operator and stores operational state in one publicly readable Google spreadsheet.

The project is complete when a visitor can reliably discover events during the next seven days and the operator can maintain sources and resolve uncertain extraction through Sheets without a dedicated admin application.

User accounts, verified attendance, Stories, scraping, ticketing, maps, notifications, and a web admin panel are outside the MVP.

## Technology decisions

- **Application:** Current stable Next.js App Router, React, strict TypeScript, and Node.js Route Handlers.
- **Hosting:** Vercel.
- **Styling:** Small global stylesheet with design tokens; no UI framework is required.
- **Instagram:** Meta Graph Business Discovery only; latest three publications per source.
- **Recurring exceptions:** Generate Torito and Salsipuedes from explicit weekly configuration and omit them from Meta scans.
- **Meta token:** Exchange short-lived Facebook User tokens for approximately 60-day tokens and monitor expiry; do not assume unattended refresh is available.
- **Extraction:** Gemini structured output with separate caption and visual evidence paths.
- **Persistence:** Public Google Sheets CSV for event reads and Google Sheets API service-account access for writes.
- **Scheduling:** An operator-owned external service calls `GET /api/sync?key=…`.
- **Administration:** Google Sheets.
- **Testing:** Small, high-value automated suite with fake external adapters.

The public-read pattern from `personal-finance-analytics` is appropriate for the event feed but cannot support writes. The service-account pattern already used by `harle-backend` supplies the required write access while the spreadsheet remains publicly readable.

## Data model

The spreadsheet contains:

- `Sources`: approved Instagram accounts and synchronization state.
- `Events`: normalized event records and denormalized attendance counts.
- `RSVPs`: one pseudonymous current state per event/browser combination.
- `SourceRequests`: pending visitor suggestions.
- `ExtractionReviews`: conflicting or incomplete extraction evidence.
- `SyncRuns`: idempotency windows and run outcomes.

`Events` is the only tab required by the public website feed. Other tabs are operational and must contain no secrets or direct visitor identity.

Persistence is intentionally bounded: expired events and their RSVPs are removed after 48 hours, while extraction reviews and synchronization runs use a rolling 30-day window. Sources and source-request decisions remain persistent.

## Non-functional targets

- Mobile-first and keyboard accessible.
- No visitor registration or personal-data collection.
- Warm event-feed response normally below one second.
- Bounded provider concurrency, explicit timeouts, and partial-source tolerance.
- Server-only credentials and structured logs without secrets.
- Deterministic timezone behavior in `America/Argentina/Cordoba`.
- No live external APIs in automated tests.

## Infrastructure and cost

The intended initial footprint is compatible with low-volume or free-tier usage:

- One Vercel project.
- One Google spreadsheet.
- One Google service account with access only to that spreadsheet.
- Meta Graph API calls for three publications per enabled source per synchronization window.
- Up to two Gemini extraction calls per relevant publication.
- An external scheduler owned by the operator.

Provider quotas, Gemini image usage, and Vercel execution duration must be measured before increasing the source list. Concurrency limits are configuration, not assumptions of unlimited capacity.

## Phases and exit criteria

### Phase 1: Foundation

Deliver:

- Next.js project with strict TypeScript, linting, environment validation, and ignored local secrets.
- Spreadsheet tabs and stable headers.
- Fake Meta, Gemini, and Sheets adapters for local development.
- Business Discovery validation and `Sources` seeding for the initial candidates listed in [Features](./02_FEATURES.md).
- Server-only Meta token exchange command, expiration inspection, and a feasibility test for a Business Manager system-user token.

Done when the application builds, configuration fails fast, spreadsheet connectivity is verified without exposing credentials, every enabled initial source has passed Meta validation, and production has a documented token-renewal path.

### Phase 2: Public agenda

Deliver:

- Public CSV event reader and runtime validation.
- Seven-day Rosario calendar window.
- Day grouping, chronological ordering, responsive event cards, and empty/error states.
- Source links and freshness display.

Done when seeded events render correctly across desktop and mobile and invalid spreadsheet rows do not break the feed.

### Phase 3: Community interactions

Deliver:

- Local browser identity and “¡Pa'llá voy!” toggle.
- RSVP persistence and attendance count update.
- Instagram source-request form with normalization and deduplication.

Done when attendance can be selected and undone after reload, and pending source requests appear once in Sheets.

### Phase 4: Synchronization

Deliver:

- Meta Business Discovery client for the last three publications.
- Caption and Gemini vision extraction with structured schemas.
- Reconciliation, validation, event identity, and duplicate consolidation.
- Parallel per-source orchestration, two sync windows, partial success, and final batched persistence.
- Extraction review and sync-run records.

Done when `rumbavanaok` can be synchronized end to end, repeated announcements consolidate, disagreements remain unpublished, and a failed source does not block successful sources.

### Phase 5: Deployment and release

Deliver:

- Vercel environment configuration and production deployment.
- External scheduler integration owned by the operator.
- Credential rotation notes, production logging, and essential automated checks.
- Manual mobile, accessibility, and failure-state verification.

Done when production events can be read, interactions persist, the protected endpoint is callable by the scheduler, secrets remain server-side, and a failed run can be diagnosed from its response and Sheets.

## Risk management

- **Meta token expiry or permission change:** Use a long-lived token, inspect its expiration, warn seven days ahead, and reauthorize before expiry. Business Discovery documents a Facebook User token and Meta provides no refresh token for it.
- **Unsupported source account:** Validate through Business Discovery before adding a source; personal, inaccessible, and age-gated accounts remain unsupported.
- **Latest-three limitation:** Operators may miss an event after several unrelated posts. Keep the limit explicit and reconsider only with observed evidence.
- **Stories-only announcements:** Document that SalseRos cannot discover them.
- **Extraction error:** Require structured output, independent visual checks, deterministic validation, and a review queue.
- **Duplicate announcements:** Use deterministic event identity and merge publication provenance.
- **Gemini or Meta quota:** Bound concurrency, retry transient failures, and preserve prior events for failed sources.
- **Google Sheets race conditions:** Disable duplicate client requests, use idempotent identifiers, update only affected RSVP/event rows, and accept best-effort attendance accuracy for the MVP.
- **Public spreadsheet exposure:** Store no secrets, raw browser tokens, or requester identity.
- **Query-string sync password:** Redact it from application logs, use HTTPS, rotate it when exposed, and treat stronger authentication as a later hardening item.
- **Serverless duration:** Measure synchronization duration; split or queue work later if the account list outgrows one Vercel invocation.

## Key technical decisions summary

- Show today plus six days and omit empty days.
- Use “¡Pa'llá voy!” as a reversible anonymous intent.
- Keep Instagram account requests pending until manual approval.
- Publish only high-confidence events; route disagreements to Sheets.
- Process sources concurrently and persist successful outcomes after all inspections settle.
- Preserve failed sources' existing data.
- Keep the spreadsheet public for reads but use a service account for writes.
- Keep scheduling outside SalseRos.
