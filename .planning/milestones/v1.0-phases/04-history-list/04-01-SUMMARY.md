---
phase: 04-history-list
plan: 01
subsystem: ui, database
tags: [drizzle, next-image, server-components, history, auth-guard]

# Dependency graph
requires:
  - phase: 02-database-schema
    provides: transcripts table with schema and drizzle config
  - phase: 03-transcript-persistence
    provides: saveTranscript function and auto-save client flow
provides:
  - getUserTranscripts query function for fetching user history
  - getTranscriptById query function with ownership verification
  - /history page rendering saved transcripts as browsable cards
  - HistoryCard component with thumbnail, title, preview, date, duration
  - Navigation links between home and history
affects: [04-02-history-detail, future-search, future-pagination]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-component-auth-guard, drizzle-select-queries, client-card-component]

key-files:
  created:
    - components/HistoryCard.tsx
  modified:
    - lib/db/queries.ts
    - app/history/page.tsx
    - components/AuthButton.tsx
    - app/layout.tsx

key-decisions:
  - "Full row select including segments for MVP -- optimize with column selection later if needed"
  - "HistoryCard as client component for hover interactions and future interactivity"

patterns-established:
  - "Auth guard pattern: auth() check with redirect in server components"
  - "Card link pattern: wrapping Card in Link for clickable list items"
  - "Text preview pattern: join segments, slice to 150 chars, append ellipsis"

requirements-completed: [HIST-01, HIST-02, HIST-03, UIUX-01]

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 04 Plan 01: History List Summary

**Drizzle query functions for user transcripts with browsable card-based /history page, auth guard, and wired navigation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-18T08:58:07Z
- **Completed:** 2026-02-18T08:59:53Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added getUserTranscripts (sorted by savedAt desc) and getTranscriptById (with ownership check) query functions
- Built history page with auth guard, transcript card list, count badge, and empty state
- Created HistoryCard component with thumbnail, title, text preview, save date, and duration badge
- Enabled History link in avatar dropdown and made brand text link to home

## Task Commits

Each task was committed atomically:

1. **Task 1: Add query functions and wire navigation** - `09625f7` (feat)
2. **Task 2: Build history list page and HistoryCard component** - `29d8e0f` (feat)

## Files Created/Modified
- `lib/db/queries.ts` - Added getUserTranscripts and getTranscriptById query functions
- `components/HistoryCard.tsx` - Card component with thumbnail, title, text preview, date, duration
- `app/history/page.tsx` - History list page with auth guard, data fetching, empty state
- `components/AuthButton.tsx` - Enabled History link in dropdown menu
- `app/layout.tsx` - Brand text wrapped in Link to home page

## Decisions Made
- Full row select including segments for MVP: simpler query, optimize later if performance becomes an issue with large segment arrays
- HistoryCard as client component: enables hover states and prepares for future interactivity (delete, share)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- History list complete, ready for Plan 02 (history detail view at /history/[id])
- getUserTranscripts and getTranscriptById queries available for detail page
- Card links already point to /history/[id] routes

## Self-Check: PASSED

All files verified present. Commits 09625f7 and 29d8e0f confirmed in git log.

---
*Phase: 04-history-list*
*Completed: 2026-02-18*
