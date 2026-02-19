---
phase: 10-ai-summaries-auto-save
plan: 01
subsystem: api
tags: [gemini, ai, summarization, postgres, drizzle, caching]

# Dependency graph
requires:
  - phase: 09-transcript-panel
    provides: Extension panel and message-passing architecture
provides:
  - Summaries DB table with global videoId cache
  - getSummaryByVideoId and saveSummary query helpers
  - Gemini SDK integration with chunked fallback (lib/summarize.ts)
  - Auth-gated POST /api/summarize endpoint
affects: [10-02-PLAN, extension-summary-tab, extension-auto-save]

# Tech tracking
tech-stack:
  added: ["@google/genai ^1.41.0"]
  patterns: ["Global summary cache by videoId", "Gemini system instruction with delimiter-based response parsing", "Chunked map-reduce for long transcripts"]

key-files:
  created:
    - app/api/summarize/route.ts
    - lib/summarize.ts
    - drizzle/0002_conscious_sister_grimm.sql
  modified:
    - lib/db/schema.ts
    - lib/db/queries.ts
    - package.json

key-decisions:
  - "Global cache scope (no userId column) -- summaries are deterministic per video"
  - "Gemini 2.5 Flash model for quality-cost balance with 65K output limit"
  - "900K token threshold for chunked summarization (leaves margin from 1M limit)"
  - "onConflictDoNothing on summaries to handle race conditions"

patterns-established:
  - "Gemini SDK server-side only: @google/genai imported only in lib/summarize.ts, never in extension"
  - "Delimiter-based LLM response parsing with multi-level fallback (BULLETS:/PARAGRAPH: delimiters, then line-prefix detection, then full-text fallback)"
  - "DB-first cache check before AI API call in route handler"

requirements-completed: [AI-01, AI-02, AI-03, AI-04, AI-05]

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 10 Plan 01: Summarization Backend Summary

**Gemini 2.5 Flash summarization backend with global DB cache, chunked fallback, and auth-gated /api/summarize endpoint**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T08:29:56Z
- **Completed:** 2026-02-19T08:33:32Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Summaries table with unique videoId index deployed to production Neon database
- Gemini SDK integration with token counting, chunked map-reduce for edge-case long transcripts, and resilient response parsing
- Auth-gated POST /api/summarize endpoint with DB cache check, Gemini call on miss, and 429 rate limit handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Add summaries table and query helpers** - `f389d5a` (feat)
2. **Task 2: Create Gemini summarization module and API route** - `4df6dce` (feat)

## Files Created/Modified
- `lib/db/schema.ts` - Added summaries table definition with videoId unique index
- `lib/db/queries.ts` - Added getSummaryByVideoId and saveSummary query helpers
- `drizzle/0002_conscious_sister_grimm.sql` - Migration SQL for summaries table
- `drizzle/meta/_journal.json` - Updated migration journal
- `drizzle/meta/0002_snapshot.json` - Updated schema snapshot
- `lib/summarize.ts` - Gemini SDK integration with parseSummaryResponse and generateSummary
- `app/api/summarize/route.ts` - Auth-gated POST endpoint with cache and error handling
- `package.json` - Added @google/genai dependency

## Decisions Made
- Global cache scope (no userId column) for summaries since they are deterministic per video transcript
- Gemini 2.5 Flash chosen for quality-cost balance (better reasoning than 2.0, 65K output tokens)
- 900K token threshold for chunked summarization leaves safe margin from 1M context limit
- onConflictDoNothing on summaries insert handles race conditions where two users summarize the same video simultaneously

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing build error in `extension/entrypoints/background/auth.ts` (WXT `@/utils/constants` alias not resolved by Next.js TypeScript check). This is unrelated to Phase 10 changes and was logged to `deferred-items.md`. The extension builds separately via WXT.

## User Setup Required

**External services require manual configuration.** The Gemini API key must be configured:
- **Environment variable:** `GEMINI_API_KEY`
- **Source:** Google AI Studio (https://aistudio.google.com/apikey) -> Create API key
- **Deployment:** Add to Vercel via `npx vercel env add GEMINI_API_KEY`

## Next Phase Readiness
- Summarize API is ready to receive requests from the Chrome extension (Plan 02)
- Extension needs to add summarize message type, summary tab UI, and auto-save integration
- GEMINI_API_KEY must be configured on Vercel before the endpoint will work in production

## Self-Check: PASSED

All 5 created/modified files verified present. Both task commits (f389d5a, 4df6dce) verified in git log.

---
*Phase: 10-ai-summaries-auto-save*
*Completed: 2026-02-19*
