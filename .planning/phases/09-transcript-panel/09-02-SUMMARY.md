---
phase: 09-transcript-panel
plan: 02
subsystem: extension
tags: [wxt, chrome-extension, shadow-dom, transcript-panel, vanilla-ts, clipboard-api]

# Dependency graph
requires:
  - phase: 09-transcript-panel
    plan: 01
    provides: "TranscriptSegment/VideoMetadata types, formatTranscriptText utility, getTranscript message handler"
  - phase: 08-extension-foundation
    provides: "WXT scaffold, Shadow DOM injection, SPA navigation, ContentScriptContext"
provides:
  - "Transcript panel UI with loading, error, and success states"
  - "Copy-to-clipboard and download-as-txt functionality"
  - "Timestamp toggle affecting copy/download output"
  - "Dismissible sign-in banner persisted via WXT storage"
  - "YouTube dark/light theme detection and dynamic switching"
  - "Panel lifecycle management (show/hide/destroy) tied to SPA navigation"
affects: [10-ai-summaries, chrome-web-store-listing]

# Tech tracking
tech-stack:
  added: []
  patterns: [shadow-dom-panel-ui, visibility-toggle-over-destroy, css-import-for-wxt-shadow-root]

key-files:
  created:
    - extension/entrypoints/youtube.content/panel.ts
  modified:
    - extension/entrypoints/youtube.content/style.css
    - extension/entrypoints/youtube.content/button.ts
    - extension/entrypoints/youtube.content/index.ts

key-decisions:
  - "Shadow DOM provides CSS isolation; inline style.all=initial was redundant and broke class-based styles"
  - "Explicit import './style.css' required in content script for WXT to inject CSS into shadow root"
  - "Toggle panel visibility instead of destroying shadow root -- reuses cached transcript for same video"
  - "Separate destroyPanel for SPA navigation cleanup vs hidePanel for user toggle"

patterns-established:
  - "WXT shadow root CSS: must import style.css explicitly in content script entry for CSS injection to work"
  - "Panel lifecycle: hidePanel (visibility toggle, preserves DOM) vs destroyPanel (full teardown for navigation)"

requirements-completed: [PANEL-01, PANEL-03, PANEL-04, AUTH-04]

# Metrics
duration: ~15min
completed: 2026-02-19
---

# Phase 9 Plan 02: Transcript Panel UI Summary

**Shadow DOM transcript panel with copy/download actions, timestamp toggle, sign-in banner, and YouTube theme matching**

## Performance

- **Duration:** ~15 min (across multiple sessions with checkpoint verification)
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 4

## Accomplishments
- Full transcript panel renders inside Shadow DOM below YouTube description with loading, error, and success states
- Copy-to-clipboard and download-as-txt both respect timestamp toggle state
- Sign-in banner for unauthenticated users persists dismissal permanently via WXT storage
- Panel integrates with SPA navigation cleanup so stale transcripts are never shown
- YouTube dark/light theme detected and applied dynamically via MutationObserver

## Task Commits

Each task was committed atomically:

1. **Task 1: Create panel module with transcript rendering, actions, and sign-in banner** - `c988660` (feat)
2. **Task 2: Wire button click to panel toggle and SPA navigation cleanup** - `77a4c4e` (feat)
3. **Task 3: Verify transcript panel on YouTube** - N/A (checkpoint: human-verify, approved)

Post-checkpoint fix commits:
- `4bf9caf` - fix: remove style.all=initial that broke panel CSS
- `c09e17c` - fix: add CSS import and improve panel lifecycle

## Files Created/Modified
- `extension/entrypoints/youtube.content/panel.ts` - Core panel module: DOM rendering, transcript fetch, copy, download, toast, sign-in banner, theme detection
- `extension/entrypoints/youtube.content/style.css` - Panel CSS with dark/light theme, loading spinner, toast, banner animations
- `extension/entrypoints/youtube.content/button.ts` - Updated click handler to toggle panel open/close via showPanel/hidePanel
- `extension/entrypoints/youtube.content/index.ts` - Added panel cleanup on SPA navigation, explicit CSS import for shadow root

## Decisions Made
- Removed `style.all = 'initial'` on panel container -- Shadow DOM already isolates CSS, and the inline reset was overriding all class-based styles applied to child elements
- Added explicit `import './style.css'` to content script entry -- WXT requires this import to generate and inject the CSS file into the shadow root at build time
- Changed hidePanel to toggle visibility instead of destroying the shadow root -- reopening the panel for the same video reuses the cached transcript without re-fetching from the API
- Added separate destroyPanel function for SPA navigation cleanup (full teardown) vs hidePanel for user toggle (visibility only)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed style.all=initial breaking panel CSS**
- **Found during:** Task 3 checkpoint (user reported blank panel)
- **Issue:** `style.all = 'initial'` on the panel container reset all CSS properties including class-based styles, making the panel render blank
- **Fix:** Removed the inline reset; Shadow DOM already provides CSS isolation
- **Files modified:** extension/entrypoints/youtube.content/panel.ts
- **Committed in:** `4bf9caf`

**2. [Rule 3 - Blocking] Added CSS import for WXT shadow root injection**
- **Found during:** Task 3 checkpoint (styles not loading in shadow root)
- **Issue:** WXT requires an explicit `import './style.css'` in the content script entry to generate the CSS file for shadow root injection; without it, no styles were applied
- **Fix:** Added the import and also improved panel lifecycle (hidePanel for toggle vs destroyPanel for navigation)
- **Files modified:** extension/entrypoints/youtube.content/index.ts, extension/entrypoints/youtube.content/panel.ts
- **Committed in:** `c09e17c`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were necessary for the panel to render correctly. No scope creep.

## Issues Encountered
- Minor visual misalignment: transcript button slightly offset from YouTube's native Ask/Save buttons (shadow root host vertical alignment). Not blocking; cosmetic fix deferred.

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- Phase 9 complete: transcript panel fully functional on YouTube video pages
- Ready for Phase 10: AI summaries button can be added to the panel actions row
- Auto-save for signed-in users can hook into the existing transcript fetch flow in panel.ts

## Self-Check: PASSED

All 4 created/modified files verified on disk. All 4 task commits (c988660, 77a4c4e, 4bf9caf, c09e17c) verified in git log.

---
*Phase: 09-transcript-panel*
*Completed: 2026-02-19*
