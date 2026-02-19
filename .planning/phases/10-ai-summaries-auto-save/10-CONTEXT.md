# Phase 10: AI Summaries + Auto-Save - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Gemini-powered AI summaries with caching, and automatic transcript persistence for signed-in users. Users can generate bullet-point or paragraph summaries from within the extension panel, and transcripts auto-save to their transcriptgrab.com history on fetch. Summary generation requires authentication. Chrome Web Store publishing is a separate phase.

</domain>

<decisions>
## Implementation Decisions

### Summary presentation
- Tabbed layout: "Transcript" and "Summary" tabs in the panel
- Transcript tab is the default on panel open
- Summary tab has a toggle button (segmented control) to switch between bullet points and paragraph format
- Copy button on summary tab mirrors the transcript tab pattern

### Summarize trigger & flow
- Summarization is gated behind sign-in — unauthenticated users see a sign-in prompt instead of summarize
- For long transcripts exceeding Gemini's context window: chunk the transcript, summarize each chunk, merge into a single cohesive summary
- Errors (quota exceeded, API failure) shown as toast notifications, not inline in the summary tab

### Auto-save behavior
- Auto-save triggers on transcript fetch (when user clicks the transcript button), not on panel render
- Subtle "Saved" indicator (badge/checkmark) in the panel — not a toast, not silent
- If video already exists in history, skip silently — don't overwrite or update timestamp
- If a summary has been generated, persist both transcript AND summary to history (available on transcriptgrab.com)

### Summary caching
- Two-tier cache: database as primary persistent store, extension localStorage as fast lookup layer
- No regeneration option — once a summary is cached, it stays
- No user-facing rate limit display

### Claude's Discretion
- Summary tab empty state before user requests a summary (CTA button, placeholder text, etc.)
- Global vs per-user cache scope — pick based on architecture constraints
- Rate limiting UX approach given Gemini free tier (~20 RPD) — backend handling vs user-facing indicator
- Loading state design for summary generation
- Exact segmented control styling for format toggle

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-ai-summaries-auto-save*
*Context gathered: 2026-02-19*
