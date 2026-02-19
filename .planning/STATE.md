# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Users can always find their previous transcripts without regenerating them
**Current focus:** Phase 10 in progress (AI Summaries + Auto-Save)

## Current Position

Milestone: v2.0 Chrome Extension + AI Summaries
Phase: 10 of 11 (AI Summaries + Auto-Save) -- IN PROGRESS
Plan: 1 of 2 in current phase (10-01 complete)
Status: Executing
Last activity: 2026-02-19 -- Completed 10-01-PLAN.md

Progress: [====......] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 4 (v2.0)
- Average duration: 6min
- Total execution time: 0.40 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 08-extension-foundation | 1 | 4min | 4min |
| 09-transcript-panel | 2 | 17min | 8.5min |
| 10-ai-summaries-auto-save | 1 | 3min | 3min |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

- Gemini API for AI summaries (server-side only, proxied through /api/summarize)
- Chrome extension only (no Firefox/Safari for v2.0)
- Session detection from web app (no separate extension OAuth)
- AI summaries extension-only (not web app)
- WXT framework for extension scaffold (not Plasmo or CRXJS)
- Message-passing architecture (content script never fetches directly)
- Shadow DOM for injected UI (prevents YouTube CSS bleed)
- Manual WXT scaffold (wxt init requires interactive prompts; manually created equivalent files)
- Icons in public/ for WXT static asset copying (assets/ for source reference)
- [Phase 09]: Extension-local type subset: VideoMetadata only carries title and author (no authorUrl/thumbnailUrl)
- [Phase 09]: Parallel API calls with graceful metadata degradation (transcript returned even if metadata fails)
- [Phase 09]: Shadow DOM approach requires explicit CSS import for WXT to inject styles into shadow root
- [Phase 09]: Panel visibility toggle (not destroy/recreate) for same-video reopen; separate destroyPanel for SPA navigation
- [Phase 10]: Global summary cache scope (no userId column) -- summaries are deterministic per video
- [Phase 10]: Gemini 2.5 Flash model for quality-cost balance with 65K output tokens
- [Phase 10]: Delimiter-based LLM response parsing with multi-level fallback
- [Phase 10]: 900K token threshold for chunked map-reduce summarization

### Pending Todos

None.

### Blockers/Concerns

- Gemini free tier limited to ~20 RPD post-December 2025. Summary caching by videoId is required before public launch.
- Chrome Web Store review takes 1-4 weeks. Start listing prep during Phase 10, not after.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Add bulk copy transcripts button to history selection mode | 2026-02-19 | 6231878 | [1-add-bulk-copy-transcripts-button-to-hist](./quick/1-add-bulk-copy-transcripts-button-to-hist/) |

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 10-01-PLAN.md
Resume file: .planning/phases/10-ai-summaries-auto-save/10-01-SUMMARY.md
Next step: Execute 10-02-PLAN.md (extension UI, summary tab, auto-save)
