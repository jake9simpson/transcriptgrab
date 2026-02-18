# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core value:** Users can always find their previous transcripts without regenerating them
**Current focus:** Phase 2: Database Infrastructure

## Current Position

Phase: 2 of 7 (Database Infrastructure)
Plan: 2 of 2 in current phase
Status: Phase 02 complete
Last activity: 2026-02-18 — Plan 02-02 executed (adapter integration)

Progress: [████░░░░░░] ~28%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 12.5 min
- Total execution time: 0.83 hours

**By Phase:**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01    | P01  | 5 min    | 2     | 9     |
| 01    | P02  | 3 min    | 3     | 5     |
| 02    | P01  | 2 min    | 2     | 5     |
| 02    | P02  | 40 min   | 2     | 3     |

**Recent Trend:**
- Last 5 plans: 5min, 3min, 2min, 40min
- Trend: Plan 02-02 included human checkpoint for database provisioning

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Google OAuth only (no email/password) — Simplicity, no password management needed
- Vercel Postgres for storage — Native Vercel integration, zero config
- Auto-save transcripts (no save button) — Frictionless UX, users expect it to just work
- Open access for unauthenticated users — No friction for new users, auth adds value not gates it
- [Phase 01]: Used Next.js 16 proxy.ts instead of middleware.ts for session handling
- [Phase 01]: JWT-only sessions with 30-day maxAge, no database adapter for Phase 1
- [Phase 01]: Pre-installed shadcn avatar and dropdown-menu components for Plan 02
- [Phase 01]: SignInHint placed outside success block for persistent visibility to signed-out users
- [Phase 01]: Avatar fallback uses getInitials helper for first+last name initials
- [Phase 02]: JSONB segments column stores raw TranscriptSegment[] for client-side format switching
- [Phase 02]: Separate pooled (app) vs unpooled (migrations) DATABASE_URL endpoints
- [Phase 02]: Unique index on userId+videoId for duplicate transcript detection
- [Phase 02]: Text PKs with crypto.randomUUID() matching Auth.js adapter expectations
- [Phase 02]: Explicit JWT strategy with adapter — Auth.js defaults to DB sessions when adapter present, explicit override preserves cookie sessions
- [Phase 02]: DrizzleAdapter custom table config — usersTable/accountsTable point to schema, no sessions/verificationToken tables needed

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 02-02-PLAN.md (adapter integration) — Phase 02 complete
Resume file: .planning/phases/02-database-infrastructure/02-02-SUMMARY.md
