# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core value:** Users can always find their previous transcripts without regenerating them
**Current focus:** Phase 4: History List

## Current Position

Phase: 4 of 7 (History List) -- COMPLETE
Plan: 2 of 2 in current phase (all plans complete)
Status: Phase 04 complete, ready for Phase 05
Last activity: 2026-02-18 -- Plan 04-02 transcript detail page complete

Progress: [████████░░] ~57%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 7 min
- Total execution time: 1.0 hours

**By Phase:**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01    | P01  | 5 min    | 2     | 9     |
| 01    | P02  | 3 min    | 3     | 5     |
| 02    | P01  | 2 min    | 2     | 5     |
| 02    | P02  | 40 min   | 2     | 3     |
| 03    | P01  | 2 min    | 2     | 7     |
| 03    | P02  | 2 min    | 2     | 6     |
| 04    | P01  | 2 min    | 2     | 5     |
| 04    | P02  | 1 min    | 1     | 1     |

**Recent Trend:**
- Last 5 plans: 40min, 2min, 2min, 2min, 1min
- Trend: Consistent fast execution, Phase 04 complete

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
- [Phase 03]: onConflictDoNothing for duplicate transcripts — skip silently, preserve original save date
- [Phase 03]: videoDuration nullable — Supadata fallback cannot provide duration
- [Phase 03]: Removed next-themes useTheme() from sonner.tsx — project uses custom .dark class, not ThemeProvider
- [Phase 03]: SaveTranscript uses window.location.href for history link — simpler than useRouter in renderless component
- [Phase 04]: Full row select including segments for MVP — optimize with column selection later if needed
- [Phase 04]: HistoryCard as client component — enables hover states and future interactivity
- [Phase 04]: TranscriptSegment[] type assertion on JSONB segments column for runtime safety

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 04-02-PLAN.md (Phase 04 complete)
Resume file: .planning/phases/04-history-list/04-02-SUMMARY.md
