# Phase 8: Extension Foundation - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

WXT-based Chrome extension that installs, injects a transcript button on YouTube video pages, survives SPA navigation, detects auth state from transcriptgrab.com, and establishes the message-passing architecture between content script and background service worker. The transcript panel UI (Phase 9), AI summaries (Phase 10), and store publishing (Phase 11) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Button placement & appearance
- Button appears below the video player in the actions row (alongside Like, Share, Download)
- Styled to match YouTube's native button appearance — pill-shaped, blends in with existing controls
- Shows "Transcript" text label with a transcript/document icon
- Adapts to YouTube's dark/light theme automatically — detect current theme and match colors

### Auth state indicator
- Green dot or checkmark badge on the Chrome toolbar extension icon when signed in
- Subtle gray/neutral badge on toolbar icon when NOT signed in — hints at disconnected state
- Auth state checked on each video page navigation — always current
- No visual auth indicator on the YouTube page button itself (badge on toolbar icon only)

### Extension toolbar popup
- Simple status popup showing: signed-in status, version info
- Popup matches TranscriptGrab web app styling — same dark theme, colors, typography
- Signed-out users see neutral status text ("Not connected") — no call to action or sign-in prompt
- Signed-in users see confirmation of connected state

### Navigation transitions
- Button persists across SPA navigation — stays in place, state resets without remove/re-inject flicker
- Standard /watch video pages only — no Shorts support
- Works across all player modes: default, theater, and mini-player
- Auth state rechecked on each navigation

### Claude's Discretion
- Auth detection method (cookie check vs API ping — whatever fits the existing auth setup)
- Whether popup includes a link to open transcriptgrab.com
- How to handle waiting for YouTube's DOM to load the injection target after navigation
- Exact icon choice for the transcript button
- Shadow DOM implementation details for CSS isolation

</decisions>

<specifics>
## Specific Ideas

- Button should feel like a native YouTube feature, not a third-party add-on
- The persist-and-update approach for SPA navigation means the button never flickers or disappears during video-to-video navigation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-extension-foundation*
*Context gathered: 2026-02-18*
