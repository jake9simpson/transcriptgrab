# Phase 3: Transcript Persistence - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-save transcripts for signed-in users when they generate a transcript. Unauthenticated users retain full access to transcript generation and copying. No manual save button, no history UI, no transcript management — those are later phases.

</domain>

<decisions>
## Implementation Decisions

### Save trigger & timing
- Save fires after a short delay (2-3 seconds) once the transcript displays — not immediately on API response
- If the user already has this video saved (duplicate detection via userId+videoId unique index), skip saving entirely — preserve the original save date
- Save failures: Claude's discretion on retry strategy
- Save path (client-side vs server-side): Claude's discretion based on architecture

### Save feedback
- Successful new save: toast notification (e.g., "Transcript saved to history")
- Duplicate detected (already saved): different toast — "Already in history" (possibly with link to saved version)
- Save failure: silent — don't interrupt the user's workflow
- Toast linking to /history: Claude's discretion

### Sign-in nudge
- Show a nudge to unauthenticated users after a transcript displays — they see the transcript value first, then the pitch to sign in
- Nudge visual style: Claude's discretion (inline banner vs subtle text)
- Dismissability: Claude's discretion (always present vs dismissable per session)
- Nudge copy: Claude's discretion (specific value prop vs minimal)

### Stored data scope
- Store video duration alongside existing fields (title, URL, thumbnail, segments, save date)
- Do NOT store language/locale — not needed for current phases
- Formatted output storage vs regeneration from segments: Claude's discretion
- Word count storage vs on-demand computation: Claude's discretion

### Claude's Discretion
- Save retry strategy on failure
- Client-side vs server-side save path
- Toast design and whether it links to /history
- Sign-in nudge visual treatment, dismissability, and copy
- Whether to store pre-formatted output or regenerate from segments
- Whether to denormalize word count

</decisions>

<specifics>
## Specific Ideas

- The auto-save should feel invisible — "it just works" when you're signed in
- Duplicate handling is simple: if it exists, skip and tell the user it's already there
- The sign-in nudge appears after the transcript loads so users see the value before the ask

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-transcript-persistence*
*Context gathered: 2026-02-18*
