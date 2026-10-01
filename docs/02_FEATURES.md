# Features

## MVP

- **Seven-day agenda:** Show events occurring today or during the following six calendar days in Rosario time.
- **Chronological day rows:** Group events by day, order days and events chronologically, and omit days without events.
- **Multiple events per day:** Present events from the same day in one responsive row, wrapping or stacking on narrow screens.
- **Focused event cards:** Show the event name prominently, followed by start time, address, attendance count, and source link.
- **Lightweight attendance:** Let a visitor toggle “¡Pa'llá voy!” without registering. Store the visitor's selection locally and update the shared count.
- **Empty state:** Show a friendly message when the complete seven-day period has no events.
- **Source request form:** Let a visitor submit one Instagram username at the bottom of the page. Store valid, non-duplicate requests as pending for manual review.
- **Spanish-first interface:** Use concise Argentine Spanish and Rosario's local timezone.

## Event discovery

- **Configured Instagram sources:** Read enabled professional-account usernames from a Google Sheets `Sources` tab. Validate initial candidates through Business Discovery before enabling them.
- **Recent-publication inspection:** Retrieve the latest three publications for every enabled source through Meta Business Discovery.
- **Caption extraction:** Convert publication captions into structured candidate events.
- **Vision cross-check:** Use Gemini to independently extract event details from images, carousel images, or available video thumbnails.
- **Confidence gate:** Automatically publish candidates whose caption and visual evidence agree and pass deterministic validation.
- **Review queue:** Store disagreements, incomplete candidates, and invalid candidates in Google Sheets without publishing them.
- **Duplicate consolidation:** Merge repeated announcements of the same account, local date, and event rather than creating duplicate events.
- **Source provenance:** Retain publication IDs, permalinks, publication timestamps, and extraction freshness for every published event.

### Initial validated sources

- `@azukita.sb`
- `@lamalicia.salsaybachata`
- `@siempre.mister`
- `@la_fest_sb`
- `@echamelaculpa.bs`
- `@elite.danceclub`
- `@la_clave_rio`
- `@rumbavanaok`
- `@asereok`
- `@patipami.d7`
- `@salsa.vana_`

### Initial unavailable candidates

- `@lahori.sb`
- `@la_latina_syb`
- `@lacasadela.bachata`
- `@rosariosalsaybachata`
- `@salvaje_salsa.bachata`

Business Discovery returned `Invalid user id` for the unavailable candidates on October 1, 2026. They remain disabled unless a later validation succeeds. The `Sources` tab stores all usernames in lowercase without the leading `@`.

### Manual recurring sources

- `@sentimientotorito.rosario1`: Sundays at approximately 16:00, at Mitre and the river.
- `@salsipuedesrosario`: Fridays at approximately 21:00, at Mercado del Patio.

These occurrences are generated from application configuration and never scanned through Meta. Their cards identify the time as approximate.

## Synchronization and operations

- **Protected synchronization endpoint:** Provide `GET /api/sync?key=…`, with the expected key configured through an environment variable.
- **Externally scheduled execution:** Allow a separate scheduler to call the endpoint; scheduling is not owned by SalseRos.
- **Two synchronization windows:** Treat Monday-to-Wednesday and Wednesday-to-Monday as distinct idempotency windows in Rosario time.
- **Parallel source processing:** Inspect source accounts concurrently with a configurable limit and wait for all results before writing.
- **Partial success:** Persist successful accounts in a final batched write while preserving existing data for failed accounts.
- **Spreadsheet administration:** Use a public Google spreadsheet as the operational interface for sources, events, pending requests, reviews, and run history.
- **Freshness tracking:** Record event `updated_at` values and per-source/per-run synchronization state.
- **Meta token monitoring:** Use an exchanged long-lived Facebook User token and surface an operator warning before it expires.
- **Bounded retention:** Remove expired events and their RSVPs after 48 hours, and keep extraction reviews and synchronization runs for at most 30 days.
- **Targeted voting writes:** Update or append only the affected RSVP row and event count instead of rewriting complete tabs.

## Intentionally out of scope for MVP

- User accounts, profiles, or verified attendance.
- A web administration panel.
- Instagram scraping, personal accounts, or Stories.
- Ticket sales, reservations, payments, or venue capacity.
- Comments, chat, follows, notifications, or other social-network features.
- Maps, routing, event search, and city expansion beyond Rosario.
- Strong anti-fraud guarantees for attendance counts.
- Automatic activation of requested Instagram accounts.
- Indefinite event, RSVP, extraction-review, or synchronization history.

## Possible later features

- Additional dance styles or nearby cities.
- Calendar export and shareable event pages.
- Venue maps and transportation links.
- Notifications for newly published or changed events.
- A protected review interface that replaces spreadsheet administration.
