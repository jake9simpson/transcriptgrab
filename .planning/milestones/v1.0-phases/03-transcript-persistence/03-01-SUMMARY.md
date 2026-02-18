---
phase: 03-transcript-persistence
plan: 01
subsystem: api, database
tags: [drizzle, neon, innertube, auth.js, next.js-api-routes]

# Dependency graph
requires:
  - phase: 02-database-auth
    provides: Drizzle schema with transcripts table, Auth.js with JWT sessions, Neon database
provides:
  - saveTranscript() query with atomic duplicate detection
  - POST /api/transcript/save endpoint with auth gating
  - videoDuration column in transcripts table
  - videoDuration in TranscriptResult type and InnerTube extraction
affects: [03-02-auto-save-client, history-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [auth-wrapped-api-route, onConflictDoNothing-upsert]

key-files:
  created:
    - lib/db/queries.ts
    - app/api/transcript/save/route.ts
    - drizzle/0001_marvelous_cassandra_nova.sql
  modified:
    - lib/db/schema.ts
    - lib/types.ts
    - lib/youtube.ts

key-decisions:
  - "onConflictDoNothing for duplicate transcripts: skip silently, preserve original save date"
  - "videoDuration nullable: Supadata fallback cannot provide duration"

patterns-established:
  - "Auth-gated API routes: auth(async function POST(req) { ... }) pattern for protected endpoints"
  - "Query helpers in lib/db/queries.ts: centralized database operations separate from route handlers"

requirements-completed: [PERS-01, PERS-02, PERS-05]

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 3 Plan 1: Backend Persistence Summary

**Save API endpoint with auth gating, atomic duplicate detection via onConflictDoNothing, and videoDuration extraction from InnerTube player response**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-18T08:20:14Z
- **Completed:** 2026-02-18T08:22:20Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Schema migration adding nullable videoDuration column applied to Neon production database
- saveTranscript() query with atomic duplicate detection (userId+videoId unique index, onConflictDoNothing)
- POST /api/transcript/save endpoint with Auth.js session validation, field validation, and error handling
- InnerTube player response now extracts lengthSeconds as videoDuration in TranscriptResult

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + save query + types update** - `b86cc05` (feat)
2. **Task 2: Save API endpoint with auth gating** - `38eab73` (feat)

## Files Created/Modified
- `lib/db/schema.ts` - Added videoDuration integer column to transcripts table
- `lib/db/queries.ts` - New file: saveTranscript() with onConflictDoNothing duplicate detection
- `lib/types.ts` - Added videoDuration field to TranscriptResult interface
- `lib/youtube.ts` - Extract lengthSeconds from InnerTube, include videoDuration in results
- `app/api/transcript/save/route.ts` - New file: auth-gated save endpoint with validation
- `drizzle/0001_marvelous_cassandra_nova.sql` - Migration adding videoDuration column
- `drizzle/meta/0001_snapshot.json` - Updated Drizzle schema snapshot

## Decisions Made
- onConflictDoNothing for duplicate transcripts: when userId+videoId already exists, skip silently and preserve the original save date. No upsert, no error.
- videoDuration is nullable because the Supadata fallback path cannot provide video duration.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Save endpoint ready for client-side auto-save integration (Plan 02)
- Transcript API returns videoId and videoDuration for client consumption
- Schema migration applied to production database

## Self-Check: PASSED

All 6 files verified present. Both task commits (b86cc05, 38eab73) verified in git log.

---
*Phase: 03-transcript-persistence*
*Completed: 2026-02-18*
