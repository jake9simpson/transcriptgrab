---
phase: 03-transcript-persistence
plan: 02
subsystem: ui, components
tags: [sonner, toast, auto-save, sign-in-nudge, next-auth, react]

# Dependency graph
requires:
  - phase: 03-transcript-persistence
    plan: 01
    provides: POST /api/transcript/save endpoint, videoId and videoDuration in TranscriptResult
provides:
  - SaveTranscript renderless auto-save component with delayed fire and toast feedback
  - SignInNudge contextual sign-in banner with session-based dismiss
  - Sonner toast infrastructure in root layout
  - Full client-side auto-save flow wired into main page
affects: [history-page, deploy]

# Tech tracking
tech-stack:
  added: [sonner]
  patterns: [renderless-component-pattern, session-storage-dismiss]

key-files:
  created:
    - components/SaveTranscript.tsx
    - components/SignInNudge.tsx
    - components/ui/sonner.tsx
  modified:
    - app/layout.tsx
    - app/page.tsx
  deleted:
    - components/SignInHint.tsx

key-decisions:
  - "Removed next-themes useTheme() from sonner.tsx: project uses custom .dark class, not next-themes ThemeProvider"
  - "SaveTranscript uses window.location.href for history link: avoids useRouter dependency in renderless component"

patterns-established:
  - "Renderless auto-save: component returns null, fires side effect via useEffect with cleanup"
  - "Session-based dismiss: sessionStorage for per-visit state, no localStorage persistence"

requirements-completed: [PERS-01, PERS-02, PERS-03, PERS-05]

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 3 Plan 2: Client Auto-Save Summary

**Sonner toast infrastructure, renderless SaveTranscript auto-save with 2.5s delay and toast feedback, contextual SignInNudge banner replacing SignInHint**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-18T08:26:38Z
- **Completed:** 2026-02-18T08:29:32Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 2 modified, 1 deleted)

## Accomplishments
- Sonner toast library installed via shadcn CLI with Toaster component in root layout
- SaveTranscript renderless component auto-saves transcript 2.5s after display for signed-in users with toast feedback ("Transcript saved to history" / "Already in your history")
- SignInNudge contextual banner replaces always-visible SignInHint, appears only after transcript loads for unauthenticated users with session-based dismiss
- Full integration into main page with videoId and videoDuration state management

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Sonner + SaveTranscript + SignInNudge components** - `918b8d2` (feat)
2. **Task 2: Wire SaveTranscript + SignInNudge into page, remove SignInHint** - `f4ab05e` (feat)

## Files Created/Modified
- `components/ui/sonner.tsx` - Sonner Toaster wrapper (shadcn CLI generated, modified to remove next-themes dependency)
- `components/SaveTranscript.tsx` - Renderless auto-save component with 2.5s delay, toast feedback, duplicate prevention via ref
- `components/SignInNudge.tsx` - Contextual sign-in banner with session-based dismiss
- `app/layout.tsx` - Added Toaster component import and placement inside Providers
- `app/page.tsx` - Integrated SaveTranscript and SignInNudge, added videoId/videoDuration state, removed SignInHint
- `components/SignInHint.tsx` - Deleted (replaced by SignInNudge)

## Decisions Made
- Removed next-themes useTheme() from generated sonner.tsx because the project uses a custom `.dark` class toggle on `<html>`, not a next-themes ThemeProvider. Used `theme="system"` instead, which lets Sonner auto-detect via prefers-color-scheme.
- SaveTranscript uses `window.location.href = "/history"` for the toast action button instead of Next.js router, keeping the renderless component simple with no additional hooks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed sonner.tsx next-themes dependency**
- **Found during:** Task 1 (Sonner installation)
- **Issue:** shadcn CLI generated sonner.tsx with `useTheme()` from next-themes, but the project has no ThemeProvider -- would crash at runtime
- **Fix:** Replaced `useTheme()` hook with static `theme="system"` prop, removed next-themes import
- **Files modified:** components/ui/sonner.tsx
- **Verification:** npm run build passes
- **Committed in:** 918b8d2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for runtime correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete client-side auto-save flow ready for production
- Toast notifications provide user feedback for save actions
- Sign-in nudge contextually encourages authentication
- Phase 3 fully complete -- backend persistence (Plan 01) and client integration (Plan 02) both done
- Next: Phase 4 (history page) can consume saved transcripts

## Self-Check: PASSED

All 5 created/modified files verified present. SignInHint.tsx confirmed deleted. Both task commits (918b8d2, f4ab05e) verified in git log.

---
*Phase: 03-transcript-persistence*
*Completed: 2026-02-18*
