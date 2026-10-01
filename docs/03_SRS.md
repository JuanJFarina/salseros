# Software Requirements Specification

## Introduction

SalseRos is a Spanish-first, single-page weekly agenda for salsa socials in Rosario. It obtains event announcements from configured public Instagram professional accounts, extracts structured event details from each account's latest three publications, cross-checks captions against poster images with Gemini, and stores accepted events in Google Sheets. Visitors can see events occurring today or during the following six days, indicate “¡Pa'llá voy!”, and request that another Instagram account be reviewed as a source.

The MVP intentionally uses lightweight validation, a public spreadsheet, and externally scheduled synchronization. It does not provide user accounts, verified attendance, or a web administration panel. Google Sheets is the operational interface and Next.js provides both the static page shell and server endpoints.

## Environment

### Real-world context

- Event organizers publish dates, times, venues, updates, and promotional posters on public Instagram professional accounts.
- One publication can announce multiple events, and several publications can promote the same event.
- Captions and posters may disagree, omit a year, use informal Spanish, or describe an event that crosses midnight.
- Instagram media URLs are temporary and must only be used during synchronization.
- Instagram Stories and personal accounts are unavailable to the selected official API.
- Visitors are anonymous and may clear browser storage or call public endpoints directly.
- Google Sheets is publicly readable, but only the application service account and human owner have write access.
- All calendar behavior uses `America/Argentina/Cordoba`.

### Actors

- **Visitor:** Reads the weekly agenda, toggles attendance intent, and requests an Instagram source.
- **Operator:** Maintains spreadsheet data, approves source requests, reviews extraction conflicts, manages credentials, and configures the external scheduler.
- **External scheduler:** Calls the protected synchronization endpoint on the operator's schedule.
- **Instagram organizer:** Publishes source content but does not interact directly with SalseRos.
- **Meta Graph API:** Supplies professional-account publications and media metadata.
- **Gemini API:** Produces structured caption and visual extraction results.
- **Google Sheets:** Stores operational and public application data.

## User Requirements

- **UR-01:** A visitor shall understand which socials occur during the next seven calendar days within seconds of opening the site.
- **UR-02:** Events shall appear in chronological day groups and chronological order within each day.
- **UR-03:** Days without events shall not occupy space.
- **UR-04:** An event shall clearly expose its name, local start time, address, attendance count, and original Instagram publication.
- **UR-05:** A visitor shall toggle “¡Pa'llá voy!” without registration or personal information.
- **UR-06:** The visitor's attendance selection shall survive a reload in the same browser when local storage remains available.
- **UR-07:** A visitor shall request review of a public Instagram account by submitting only its username.
- **UR-08:** Uncertain or contradictory extracted information shall not be presented as confirmed.
- **UR-09:** The operator shall manage source accounts, requests, reviews, and event corrections through Google Sheets.
- **UR-10:** The operator shall be able to invoke synchronization from an external scheduler with a configurable password.
- **UR-11:** A failure in one Instagram source shall not prevent successful sources from being refreshed.
- **UR-12:** The interface shall be usable on mobile and desktop, in Spanish, without authentication.

## System Specification

### Weekly agenda

- **FR-01:** The display window shall begin at the current local date and end after six additional local dates.
- **FR-02:** The system shall exclude cancelled events and events whose end time is in the past.
- **FR-03:** If an event has no end time, it shall remain current until six hours after its start time.
- **FR-04:** Events shall be grouped by local start date.
- **FR-05:** Day groups and their events shall be sorted by local start time.
- **FR-06:** Empty day groups shall be omitted.
- **FR-07:** If the complete window is empty, the page shall show one friendly empty-state message.
- **FR-08:** Multiple events on the same day shall share one responsive row. Cards may wrap on small screens without changing chronological order.
- **FR-09:** Every event card shall show:
  - Event name as its strongest visual element.
  - Local start time and optional end time, marking approximate times explicitly.
  - Address.
  - Current attendance count.
  - “¡Pa'llá voy!” toggle.
  - Link to a source Instagram publication.
- **FR-10:** The page shall display the last successful data update without implying that Instagram itself was checked at that exact moment.

### Event reads

- **FR-11:** `GET /api/events` shall derive the public Events CSV endpoint from `GOOGLE_SPREADSHEET_URL`.
- **FR-12:** The endpoint shall parse and validate spreadsheet rows before exposing typed JSON.
- **FR-13:** Invalid rows shall be excluded and logged without failing otherwise valid rows.
- **FR-14:** The endpoint shall apply the seven-day window and ordering rules server-side.
- **FR-15:** The endpoint may use short shared-cache freshness of at most 60 seconds and stale revalidation of at most five minutes.
- **FR-16:** The static page shell shall fetch event JSON after loading and expose loading, success, empty, and failure states.

### Attendance intent

- **FR-17:** The browser shall create one random visitor token and store it under a versioned local-storage key.
- **FR-18:** The browser shall store selected event IDs locally and render the corresponding buttons as selected after reload.
- **FR-19:** Selecting or deselecting “¡Pa'llá voy!” shall call `POST /api/rsvps` with the event ID, visitor token, and desired boolean state.
- **FR-20:** The server shall never persist the raw visitor token.
- **FR-21:** The server shall derive an RSVP identifier with HMAC over the event ID and visitor token using `RSVP_HASH_SECRET`.
- **FR-22:** One derived RSVP identifier shall represent at most one current state for an event.
- **FR-23:** The handler shall update the RSVP state and recalculate the event's denormalized `attendants` count.
- **FR-24:** Counts shall never be returned below zero.
- **FR-25:** The client may update optimistically but shall restore the prior state when persistence fails.
- **FR-26:** The button shall be disabled while its request is in flight.
- **FR-27:** Attendance is explicitly best-effort. Clearing local storage, using another browser, or calling the endpoint manually can create another intent.

### Source requests

- **FR-28:** The bottom of the page shall contain a compact source-request form with one Instagram username input.
- **FR-29:** `POST /api/source-requests` shall normalize input by trimming whitespace, removing one leading `@`, and converting to lowercase.
- **FR-30:** A valid username shall contain only Instagram-supported letters, digits, periods, and underscores and shall not exceed 30 characters.
- **FR-31:** The endpoint shall reject empty or malformed usernames.
- **FR-32:** An already active source or pending request shall not create a duplicate row.
- **FR-33:** A valid new request shall be appended to `SourceRequests` with `pending` status and a server timestamp.
- **FR-34:** A submitted request shall never become an active source automatically.
- **FR-35:** Approval consists of the operator adding the username to `Sources` and updating the request status in the spreadsheet.
- **FR-36:** The UI shall not claim that submission guarantees inclusion.

### Synchronization endpoint

- **FR-37:** Synchronization shall be exposed as `GET /api/sync?key=<password>`.
- **FR-38:** The endpoint shall compare the supplied key with `SYNC_PASSWORD` and return `401` when it is absent or invalid.
- **FR-39:** The endpoint shall set `Cache-Control: no-store`.
- **FR-40:** Application logs and response bodies shall not contain the supplied key.
- **FR-41:** Use of a state-changing GET and a query-string secret is an accepted MVP risk for scheduler compatibility.
- **FR-42:** The endpoint shall load enabled rows from `Sources`.
- **FR-43:** Synchronization shall derive one of two Rosario-time window keys:
  - Monday 00:00 through Wednesday 00:00.
  - Wednesday 00:00 through the following Monday 00:00.
- **FR-44:** A source already completed successfully in the active window shall be skipped.
- **FR-45:** A retry shall process sources that failed or were not attempted in the active window.
- **FR-46:** Source inspections shall run concurrently through a configurable bounded pool.
- **FR-47:** The orchestrator shall wait for every source to settle before entering the persistence phase.
- **FR-48:** No extraction result shall be written while source inspection remains in progress.
- **FR-49:** Successful source results, reviews, source state, and run state shall be persisted in a final batched phase.
- **FR-50:** Existing events for a failed source shall remain unchanged.
- **FR-51:** A complete success shall return `200`; partial success shall return `207`; total processing or persistence failure shall return `500`.
- **FR-52:** The response shall include the window key, timing, and per-source success, skipped, or failure summaries without secrets or media URLs.

### Manual recurring events

- **FR-52a:** Synchronization shall generate the next 14 days of configured recurring occurrences independently of Meta.
- **FR-52b:** `sentimientotorito.rosario1` shall generate Sundays at approximately 16:00 at Mitre and the river.
- **FR-52c:** `salsipuedesrosario` shall generate Fridays at approximately 21:00 at Mercado del Patio.
- **FR-52d:** Both recurring sources shall remain disabled for Meta scanning.
- **FR-52e:** Generated occurrences shall use deterministic event IDs so attendance survives repeated synchronization.

### Instagram retrieval

- **FR-53:** Each source shall be queried through Meta Graph API v26 or a compatible later version using Business Discovery.
- **FR-54:** The querying professional-account ID shall be configured by `META_IG_USER_ID`.
- **FR-55:** The server shall fetch exactly the latest three available publications per source.
- **FR-56:** Requested publication fields shall include identifiers, caption, media type, permalink, publication timestamp, visual URL or thumbnail when available, and carousel children when applicable.
- **FR-57:** IMAGE publications shall use their image; CAROUSEL_ALBUM publications shall use available children; VIDEO or Reel publications shall use an available thumbnail.
- **FR-58:** Media bytes shall be downloaded only in memory, subject to content-type and size limits, and discarded after extraction.
- **FR-59:** The application shall not scrape Instagram or fall back to undocumented web endpoints.
- **FR-60:** Inaccessible, personal, age-gated, or malformed sources shall fail independently and record an operator-readable error.

### Structured extraction and reconciliation

- **FR-61:** Caption extraction shall be the primary evidence path.
- **FR-62:** Gemini caption extraction shall receive caption text and publication timestamp but no visual bytes.
- **FR-63:** Gemini vision extraction shall receive visual bytes and a narrow extraction prompt without the caption, preserving independence as a cross-check.
- **FR-64:** Both paths shall return schema-validated arrays because one publication can announce zero, one, or multiple events.
- **FR-65:** Candidate fields shall include event name, local start, optional end, address, evidence, and extraction confidence.
- **FR-66:** Gemini shall use native structured JSON output when supported; arbitrary prose or invalid JSON shall not be accepted.
- **FR-67:** The resolver shall normalize whitespace, casing, dates, times, and common address abbreviations before comparison.
- **FR-68:** A missing year shall be inferred as the nearest plausible non-past occurrence relative to the publication timestamp and Rosario timezone.
- **FR-69:** Day-of-week text shall agree with the resolved date when both are present.
- **FR-70:** A candidate requires a name, future local start, and address before automatic publication.
- **FR-71:** Caption and vision agreement on event identity, date, and venue shall produce a high-confidence candidate.
- **FR-72:** A complete and deterministic caption result may remain high confidence when the visual path has no relevant evidence, provided the visual path does not contradict it.
- **FR-73:** Direct disagreement, missing required data, impossible dates, or invalid schema shall create or update an `ExtractionReviews` row and shall not publish the candidate.
- **FR-74:** Detected cancellation or material rescheduling shall require review rather than automatically removing or moving a published event.
- **FR-75:** The Gemini model shall be configurable through `GEMINI_MODEL`.

### Event identity and lifecycle

- **FR-76:** One event shall be stored once even when several of the latest publications advertise it.
- **FR-77:** A deterministic event identity shall be based on normalized source account, local event date, and normalized event name.
- **FR-78:** Time, address, description, and source-publication collections shall remain updateable attributes rather than identity components.
- **FR-79:** The accepted event shall retain all supporting publication IDs and permalinks found during the run.
- **FR-80:** A newly accepted candidate shall insert an event; a matching candidate shall update mutable fields and `updated_at`.
- **FR-81:** An unchanged event shall not receive a misleading content-update timestamp.
- **FR-82:** Past events shall be retained in Sheets for audit but excluded from the public endpoint.
- **FR-83:** The `attendants` value shall be preserved when synchronization updates event details.

### Google Sheets persistence

- **FR-84:** The spreadsheet shall remain publicly readable but not publicly editable.
- **FR-85:** Public event reads shall prefer the derived CSV URL and fall back to an authenticated Sheets API read when public access is unavailable.
- **FR-86:** Server writes and operational reads shall use the Google Sheets API with a service account that has editor access.
- **FR-87:** Service-account JSON shall be supplied as base64 through `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`.
- **FR-88:** The spreadsheet URL shall be supplied through `GOOGLE_SPREADSHEET_URL`; the application may derive its ID.
- **FR-89:** Persistence shall use stable column headers and validate required tabs at startup or first use.
- **FR-90:** Batch writes shall be idempotent by event, RSVP, request, source, review, and run identifiers.
- **FR-91:** A spreadsheet write failure shall fail the persistence phase and leave the run retryable.
- **FR-92:** The public spreadsheet shall contain no raw browser identifiers, access tokens, API keys, or requester contact information.
- **FR-92a:** Synchronization shall remove events 48 hours after their explicit end, or 48 hours after the six-hour inferred end used when no end is known.
- **FR-92b:** Removing an event shall remove all of its RSVP rows.
- **FR-92c:** Extraction reviews and synchronization runs shall be retained for at most 30 days.
- **FR-92d:** Sources and source-request decisions shall remain persistent.
- **FR-92e:** RSVP toggles shall update or append the affected RSVP row and update only the affected event row.

### Non-functional requirements

- **NFR-01:** The application shall use strict TypeScript and fail fast when required configuration is absent.
- **NFR-02:** The public page shall be mobile-first and usable at widths from 320 pixels upward.
- **NFR-03:** Interactive elements shall have visible focus, accessible labels, keyboard operation, and minimum comfortable touch targets.
- **NFR-04:** Color shall not be the only indication of RSVP selection or errors.
- **NFR-05:** The initial shell shall remain lightweight and shall not require third-party client scripts.
- **NFR-06:** Warm public event reads should normally complete within one second, excluding Google availability.
- **NFR-07:** Synchronization shall tolerate individual Meta, media-download, and Gemini failures without abandoning successful sources.
- **NFR-08:** External calls shall have explicit timeouts and bounded retries with jitter.
- **NFR-09:** Source and Gemini concurrency shall be bounded to respect provider quotas.
- **NFR-10:** Structured logs shall include request/run IDs and source usernames but no secrets or temporary media URLs.
- **NFR-11:** The application shall collect no names, email addresses, precise locations, or authentication identities from visitors.
- **NFR-12:** Essential automated tests shall cover date grouping, extraction reconciliation/deduplication, partial synchronization, and RSVP toggling. Tests shall mock Meta, Gemini, and Sheets.
- **NFR-13:** Production shall use HTTPS.
- **NFR-14:** Meta and Gemini tokens shall be server-only and rotatable without a code change.
- **NFR-15:** The UI shall display recoverable errors without discarding locally selected RSVP state.

## Program

### Architectural shape

SalseRos shall be one Next.js App Router application deployed as a hybrid static/serverless project:

- A statically renderable page shell and client event interaction component.
- Route Handlers for event reads, RSVP writes, source requests, and synchronization.
- Pure domain functions for calendar windows, normalization, reconciliation, identity, and grouping.
- Server-only adapters for Meta, Gemini, public CSV reads, and authenticated Google Sheets writes.
- Runtime validation at every external boundary.

The application shall not introduce a separate backend for the MVP.

### Suggested modules

- `app/page.tsx`: public shell and metadata.
- `app/api/events/route.ts`: validated public event feed.
- `app/api/rsvps/route.ts`: attendance toggle.
- `app/api/source-requests/route.ts`: pending source request.
- `app/api/sync/route.ts`: protected orchestration endpoint.
- `components/`: weekly agenda, event card, RSVP button, request form, states.
- `domain/`: event models, date windows, identities, reconciliation, grouping.
- `infrastructure/meta/`: Business Discovery client.
- `infrastructure/gemini/`: text and vision extraction.
- `infrastructure/sheets/`: public CSV reader and service-account writer.
- `utils/`: settings, logging, hashing, and external-error taxonomy.

### Endpoint summaries

- `GET /api/events`
  - Public.
  - Returns `{ generatedAt, window, days }`.
- `POST /api/rsvps`
  - Public.
  - Accepts `{ eventId, visitorToken, attending }`.
  - Returns `{ eventId, attending, attendants }`.
- `POST /api/source-requests`
  - Public.
  - Accepts `{ username }`.
  - Returns a created, duplicate, or already-active outcome.
- `GET /api/sync?key=…`
  - Protected by `SYNC_PASSWORD`.
  - Returns run and per-source outcomes.

## Machine

### Runtime and hosting

- Vercel shall host the Next.js application.
- Route Handlers that use Google authentication, Gemini, or media bytes shall run in the Node.js runtime, not Edge runtime.
- The external scheduler is outside this repository and calls the deployed synchronization URL.
- Scheduling time is intentionally not specified by SalseRos.

### External services

- Meta Graph API with Facebook Login for Business Discovery.
- Gemini API for structured text and visual extraction.
- Google Sheets public CSV publication for event reads.
- Google Sheets API service account for operational reads and all writes.

### Required environment variables

- `META_ACCESS_TOKEN`
- `META_IG_USER_ID`
- `META_APP_ID`
- `META_APP_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GOOGLE_SPREADSHEET_URL`
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`
- `SYNC_PASSWORD`
- `RSVP_HASH_SECRET`

Optional operational variables may include `META_GRAPH_VERSION`, `SYNC_MAX_CONCURRENCY`, `GEMINI_MAX_CONCURRENCY`, `EXTERNAL_REQUEST_TIMEOUT_MS`, and `MAX_MEDIA_BYTES`.

### Credential operations

- Business Discovery shall use a Facebook User access token. An Instagram Login token is not interchangeable for this endpoint.
- A server-only maintenance command shall exchange a valid short-lived Facebook User token for a long-lived token by using `META_APP_ID` and `META_APP_SECRET`.
- The application shall inspect token metadata through Meta's token-debug endpoint and report validity and expiration without logging the token.
- Synchronization shall include an operator warning when the token expires within seven days and fail clearly when it is invalid.
- Meta does not issue a refresh token for long-lived Facebook User tokens. The operator must complete Facebook Login again before expiry and rerun the exchange command.
- A Business Manager system-user token may replace this process only after a production-equivalent Business Discovery request proves that Meta accepts it for the configured assets and permissions.
- The Gemini key may use the same Google project as the existing Harle integration but shall be configured independently in SalseRos.
- The service account shall receive editor access only to the SalseRos spreadsheet.
- `.env` files and service-account material shall never be committed.
- The synchronization query password shall be rotated if it appears in logs or is disclosed.
