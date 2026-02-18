---
phase: 02-database-infrastructure
plan: 01
subsystem: database
tags: [drizzle-orm, neon, postgres, schema, auth-adapter, jsonb]

# Dependency graph
requires:
  - phase: 01-auth-foundation
    provides: "Auth.js v5 config and session management"
provides:
  - "Database schema: users, accounts, transcripts tables"
  - "Drizzle ORM client connected via Neon HTTP driver"
  - "Migration config (drizzle.config.ts) for drizzle-kit"
  - "TranscriptSegment JSONB storage for format switching"
affects: [02-02-PLAN, 03-transcript-persistence, 04-history-list]

# Tech tracking
tech-stack:
  added: [drizzle-orm, "@neondatabase/serverless", "@auth/drizzle-adapter", drizzle-kit, dotenv]
  patterns: [pgTable schema definitions, Neon pooled/unpooled URL split, JSONB typed columns]

key-files:
  created: [lib/db/schema.ts, lib/db/index.ts, drizzle.config.ts]
  modified: [package.json, package-lock.json]

key-decisions:
  - "JSONB segments column stores raw TranscriptSegment[] for client-side format switching"
  - "Separate pooled (app) vs unpooled (migrations) DATABASE_URL endpoints"
  - "Unique index on userId+videoId for duplicate transcript detection"
  - "text PKs with crypto.randomUUID() default instead of serial IDs"

patterns-established:
  - "Schema pattern: pgTable definitions in lib/db/schema.ts with typed JSONB columns"
  - "DB client pattern: Neon HTTP driver in lib/db/index.ts with schema import for typed queries"
  - "Migration config pattern: drizzle.config.ts at project root with dotenv/config import"

requirements-completed: [PERS-02, PERS-04, PERS-05, HIST-01, HIST-02, HIST-03, HIST-04, HIST-06, HIST-07, HIST-08, HIST-09, HIST-10]

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 2 Plan 01: Schema & Tooling Summary

**Drizzle ORM schema with Auth.js adapter tables (users, accounts) and transcripts table using JSONB segments, Neon HTTP driver client, and migration config**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-18T06:53:05Z
- **Completed:** 2026-02-18T06:54:54Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Defined users table matching Auth.js adapter format with text PK and crypto.randomUUID()
- Defined accounts table with compound primary key on provider+providerAccountId
- Defined transcripts table with JSONB segments column typed as TranscriptSegment[] and unique userId+videoId index
- Created Drizzle client using Neon HTTP driver with typed schema
- Created drizzle.config.ts using unpooled connection for DDL-safe migrations

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create database schema** - `923a181` (feat)
2. **Task 2: Create Drizzle client and migration config** - `2d91589` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `lib/db/schema.ts` - Auth.js adapter tables (users, accounts) and application transcripts table with JSONB segments
- `lib/db/index.ts` - Drizzle client instance connected via Neon HTTP driver with typed schema
- `drizzle.config.ts` - Drizzle Kit migration config pointing to schema, uses unpooled connection
- `package.json` - Added drizzle-orm, @neondatabase/serverless, @auth/drizzle-adapter, drizzle-kit, dotenv
- `package-lock.json` - Updated lockfile with new dependencies

## Decisions Made
- **JSONB for segments:** Storing raw TranscriptSegment[] enables Phase 6 format switching without re-fetching. ~160KB per transcript is negligible for Neon's 512MB free tier.
- **Extracted videoId column:** YouTube videos have many URL forms but one 11-char videoId. Using extracted ID for the unique constraint prevents false-negative duplicate detection.
- **Pooled vs unpooled URLs:** Application queries use DATABASE_URL (PgBouncer pooled, optimal for serverless). Migrations use DATABASE_URL_UNPOOLED (direct connection, required for DDL statements).
- **Text PKs with crypto.randomUUID():** Matches Auth.js adapter expectations and avoids serial ID collision across distributed environments.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

External services require manual configuration before Plan 02 can run migrations. From the plan's user_setup section:

- **Neon Postgres:** Create database via Vercel Dashboard > Storage > Create Database > Neon Postgres
- **DATABASE_URL** and **DATABASE_URL_UNPOOLED** are auto-injected by the Neon integration
- Pull env vars locally: `npx vercel env pull .env.local`

## Next Phase Readiness
- Schema and tooling ready for Plan 02 to wire the Auth.js DrizzleAdapter and run migrations
- Plan 02 will need the Neon database provisioned (user setup above) before migration generation
- All table definitions match what Auth.js DrizzleAdapter expects

## Self-Check: PASSED

All created files verified on disk. All task commits verified in git log.

---
*Phase: 02-database-infrastructure*
*Completed: 2026-02-18*
