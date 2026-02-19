# Phase 9: Transcript Panel - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Shadow DOM panel injected into YouTube video pages that displays a full transcript, supports copy and download, and nudges unauthenticated users to sign in for history saving. Panel opens from the transcript button created in Phase 8. AI summaries and auto-save are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Panel layout & sizing
- Position below the YouTube description area, before comments — pushes comments down when open
- Fixed height with internal scroll for long transcripts (no full-height expansion)
- Visual style matches YouTube's native look — colors, borders, typography blend in
- Respects YouTube's dark/light theme — detect YouTube's current mode and adapt panel colors

### Transcript display
- Line-by-line segments, each transcript segment on its own line (matches YouTube transcript style)
- Timestamps are toggleable — default to hidden, user can toggle on/off with a switch
- Panel header shows video title and channel name for context
- No search/filter within the transcript — keep it simple

### Copy experience
- Copy output matches current display state — if timestamps are toggled on, they're included in the copy
- Toast notification for copy confirmation (small popup, disappears after 2-3s)
- Button only — no keyboard shortcut
- Include a download button alongside copy — saves transcript as .txt file

### Sign-in prompt
- Dismissible banner at top of panel (above transcript text)
- Once dismissed, never shows again for that install (stored in extension local storage)
- Benefit-focused tone: emphasize value of saving and accessing transcripts later
- Dismiss is permanent per install — no re-prompting

### Claude's Discretion
- Sign-in link action (new tab to web app vs extension popup — whatever works best with Phase 8 auth detection)
- Exact banner styling and dismiss animation
- Toast notification implementation and positioning
- Download filename format
- Exact max-height value for the scrollable panel

</decisions>

<specifics>
## Specific Ideas

- Panel should feel like a native YouTube feature, not an add-on — matching YouTube's theme is key
- Transcript segments displayed line-by-line mirrors what users expect from YouTube's own transcript panel
- Download as .txt alongside copy gives users two quick export paths without format complexity

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-transcript-panel*
*Context gathered: 2026-02-18*
