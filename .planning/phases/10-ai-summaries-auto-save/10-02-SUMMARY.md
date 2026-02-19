---
phase: 10-ai-summaries-auto-save
plan: 02
subsystem: extension
tags: [chrome-extension, ai, summarization, groq, auto-save, panel-ui]

# Dependency graph
requires:
  - phase: 10-ai-summaries-auto-save/01
    provides: Backend summarize API (ultimately bypassed for direct Groq calls)
provides:
  - Tabbed panel UI (Transcript/Summary) with format toggle
  - Direct Groq API summarization from background service worker
  - Auto-save transcripts for signed-in users
  - Saved indicator in panel header
affects: [extension-ui, user-history]

# Tech tracking
tech-stack:
  added: ["Groq API (direct fetch from extension)"]
  patterns: ["Direct LLM API call from service worker", "Tabbed panel with state preservation", "Fire-and-forget auto-save"]

key-files:
  modified:
    - extension/utils/types.ts
    - extension/utils/messaging.ts
    - extension/entrypoints/background/index.ts
    - extension/entrypoints/youtube.content/panel.ts
    - extension/entrypoints/youtube.content/style.css
    - extension/wxt.config.ts
    - lib/summarize.ts
    - app/api/summarize/route.ts

key-decisions:
  - "Direct Groq API calls from extension background worker instead of proxying through backend — eliminates server round-trip and Vercel deployment complexity"
  - "Llama 3.3 70B Versatile on Groq for summarization — fast (sub-2s), free tier (14,400 RPD), high quality"
  - "Removed WXT storage.defineItem for summary caching — was causing background script hangs"
  - "Server-side /api/summarize endpoint retained for future web app use but not used by extension"
  - "Vercel CLI linked to transcriptgrab-vxgi project (the git-integrated one) for all future deploys"

patterns-established:
  - "Extension calls LLM APIs directly from service worker for latency-sensitive features"
  - "host_permissions must include all fetch target domains (api.groq.com)"
  - "Vercel project alias must match extension PROD_URL and Google OAuth redirect URIs"

requirements-completed: [AUTH-02, AI-01, AI-02, AI-03]

# Metrics
duration: ~45min (including debugging deployment/URL issues)
completed: 2026-02-19
---

# Phase 10 Plan 02: Extension AI Summaries + Auto-Save Summary

**Tabbed panel UI with direct Groq-powered summaries, format toggle, auto-save, and saved indicator**

## Performance

- **Duration:** ~45 min (significant debugging of deployment pipeline)
- **Started:** 2026-02-19
- **Completed:** 2026-02-19
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 8

## Accomplishments
- Two-tab panel (Transcript/Summary) with tab state preservation across panel toggle
- Summary generation via direct Groq API (Llama 3.3 70B) — sub-2 second responses
- Format toggle between bullet points and paragraph summaries
- Auto-save transcripts to user history on fetch (signed-in users, non-blocking)
- Saved indicator (green checkmark) in panel header after auto-save
- Sign-in prompt in Summary tab for unauthenticated users
- Copy button for summary content

## Task Commits

1. **Task 1: Messaging protocol + background handlers** - `cc7cb21` (feat)
2. **Task 2: Tabbed panel UI** - `48df072` (feat)
3. **Task 2b: Fix root tsconfig for Vercel** - `604d26e` (fix)
4. **Task 3: Human verification** - Approved after iterative fixes

## Deviations from Plan

- **Major: Switched from server-proxied Gemini to direct Groq calls.** Original plan had the extension calling `/api/summarize` on the backend, which proxied to Gemini. Gemini's free tier was unreliable (rate limits, thinking model slowness). Switched to Groq (Llama 3.3 70B) called directly from the extension's background service worker. The server-side endpoint is retained but unused by the extension.
- **Removed WXT storage caching.** The `storage.defineItem` API was causing the background script's summarize handler to hang silently. Removed in favor of server-side DB caching (for the backend) and no client-side cache (summaries are fast enough to regenerate).
- **Vercel deployment realignment.** Discovered CLI was deploying to a different Vercel project than the one the extension and Google OAuth were configured for. Fixed by relinking CLI to the correct `transcriptgrab-vxgi` project.

## Issues Encountered
- Gemini 2.5 Flash thinking model caused 30-60s response times; disabling thinking helped locally but free tier rate limits made it unreliable in production
- Two Vercel projects existed (CLI-created vs git-integrated); extension PROD_URL pointed to the git-integrated one while deploys went to the CLI one, causing OAuth and API failures
- WXT `storage.defineItem` caused silent hangs in the background service worker's summarize handler

## Self-Check: PASSED

All features verified manually: tab switching, summary generation, format toggle, copy, auto-save with saved indicator, sign-in prompt for unauthenticated users.

---
*Phase: 10-ai-summaries-auto-save*
*Completed: 2026-02-19*
