---
phase: 08-extension-foundation
plan: 02
subsystem: extension
tags: [content-script, shadow-dom, spa-navigation, popup, youtube-injection]

# Dependency graph
requires: [08-01]
provides:
  - YouTube content script with button injection via Shadow DOM
  - SPA navigation handling with yt-navigate-finish and MutationObserver
  - Toolbar popup with auth status display and web app link
  - DOM utility for waiting on elements via MutationObserver
affects: [09-transcript-panel, 10-ai-summaries]

# Tech tracking
tech-stack:
  added: []
  patterns: [createShadowRootUi injection, yt-navigate-finish SPA handling, MutationObserver resilient re-injection, YouTube theme detection]

key-files:
  created:
    - extension/entrypoints/youtube.content/index.ts
    - extension/entrypoints/youtube.content/button.ts
    - extension/entrypoints/youtube.content/style.css
    - extension/utils/dom.ts
    - extension/entrypoints/popup/index.html
    - extension/entrypoints/popup/main.ts
    - extension/entrypoints/popup/style.css
  modified:
    - extension/utils/constants.ts
    - extension/wxt.config.ts
    - extension/entrypoints/background/auth.ts
    - extension/entrypoints/background/index.ts

key-decisions:
  - "PROD_URL set to transcriptgrab-vxgi.vercel.app (actual Vercel deployment URL)"
  - "yt-navigate-finish event for SPA navigation timing (fires after YouTube renders, not at navigation start)"
  - "MutationObserver safety net re-injects button if YouTube destroys it during late DOM rebuilds"
  - "Production builds only check Vercel domain cookies; localhost check gated behind import.meta.env.DEV"
  - "No badge indicator when signed out (empty text) vs green badge when signed in"

patterns-established:
  - "YouTube content script pattern: yt-navigate-finish + MutationObserver for resilient DOM injection"
  - "Shadow DOM injection pattern: createShadowRootUi for CSS-isolated UI components on YouTube"
  - "Theme detection: document.documentElement.hasAttribute('dark') for YouTube dark/light mode"

requirements-completed: [EXT-02, EXT-03, AUTH-05]

# Metrics
duration: 12min
completed: 2026-02-19
---

# Phase 8 Plan 02: Content Script + Button Injection + Popup Summary

**YouTube content script with button injection, SPA navigation, and toolbar popup**

## Performance

- **Duration:** 12 min (including human verification checkpoint and 4 bug fix iterations)
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)

## Accomplishments
- Content script injects a YouTube-native pill-shaped "Transcript" button via Shadow DOM
- Button persists across SPA navigation using yt-navigate-finish event + MutationObserver safety net
- Button only appears on /watch pages (not home, search, or Shorts)
- Click triggers sendMessage('getTranscript') round trip to background service worker
- Toolbar popup shows auth status (Connected/Not connected), version, and link to web app
- Extension works without errors when user is not signed into transcriptgrab.com

## Task Commits

1. **Task 1: Content script with button injection, Shadow DOM styling, and SPA navigation** - `627fc2b` (feat)
2. **Task 2: Toolbar popup with auth status display and web app link** - `c8eafca` (feat)
3. **Task 3: Human verification checkpoint** - approved after 4 fix iterations

## Bug Fix Commits

4. **Fix SPA navigation, auth detection, and prod URL** - `d050ab4` (fix)
5. **Fix SPA navigation with yt-navigate-finish and MutationObserver** - `51dd9bd` (fix)
6. **Reduce button flicker from ~800ms to ~100ms** - `8f19f2f` (fix)
7. **Eliminate button flicker and fix auth false positive** - `0f868c4` (fix)

## Deviations from Plan

### Bug Fixes During Human Verification

**1. PROD_URL pointed to wrong domain**
- **Issue:** Constants used `transcriptgrab.com` but actual deployment is `transcriptgrab-vxgi.vercel.app`
- **Fix:** Updated PROD_URL and host_permissions to Vercel URL
- **Committed in:** d050ab4

**2. SPA navigation: button disappeared on video changes**
- **Issue:** wxt:locationchange fires at navigation START; button was injected into old DOM that YouTube then destroyed
- **Fix:** Switched to yt-navigate-finish (fires after render) + MutationObserver safety net for immediate re-injection
- **Committed in:** 51dd9bd, 8f19f2f, 0f868c4

**3. Auth showed "Connected" after sign-out**
- **Issue:** Production build checked localhost cookies; stale dev cookies caused false positives
- **Fix:** Gated localhost cookie check behind import.meta.env.DEV; production only checks Vercel domain
- **Committed in:** 0f868c4

**4. Cookie change listener didn't match localhost domain**
- **Issue:** Listener only matched `transcriptgrab.com` domain, missed localhost sign-out events
- **Fix:** Updated to match both `transcriptgrab` and `localhost` domains
- **Committed in:** d050ab4

## Self-Check: PASSED

All Phase 8 success criteria verified by human tester:
1. Extension installs and shows transcript button on YouTube video pages
2. Button persists across SPA navigation
3. Green badge when signed in, no badge when signed out
4. Button click triggers message-passing round trip (console log verified)
5. Extension works without errors when not signed in

---
*Phase: 08-extension-foundation*
*Completed: 2026-02-19*
