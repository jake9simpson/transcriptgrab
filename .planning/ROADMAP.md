# Roadmap: TranscriptGrab

## Milestones

- v1.0 **Auth & User History** -- Phases 1-7 (shipped 2026-02-18) -- [archive](milestones/v1.0-ROADMAP.md)
- v2.0 **Chrome Extension + AI Summaries** -- Phases 8-11 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (8, 9, 10, 11): Planned milestone work
- Decimal phases (8.1, 8.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 8: Extension Foundation** - WXT scaffold, YouTube DOM injection, SPA navigation, message-passing architecture, and session detection
- [x] **Phase 9: Transcript Panel** - Shadow DOM panel with transcript display, copy, and sign-in prompt on YouTube pages (completed 2026-02-19)
- [x] **Phase 10: AI Summaries + Auto-Save** - Gemini-powered summaries with caching, and automatic transcript persistence for signed-in users (completed 2026-02-19)
- [ ] **Phase 11: Chrome Web Store Publishing** - Store listing, privacy policy, permission justification, and submission

## Phase Details

### Phase 8: Extension Foundation
**Goal**: Extension installs, injects a working button on YouTube, survives SPA navigation, and detects auth state from the web app
**Depends on**: Nothing (first phase of v2.0; builds on existing v1.0 web app backend)
**Requirements**: EXT-01, EXT-02, EXT-03, EXT-04, AUTH-01, AUTH-03, AUTH-05
**Success Criteria** (what must be TRUE):
  1. User can install the extension from local dev build and see a transcript button on any YouTube video page
  2. Button persists when user navigates between videos without a full page reload (SPA navigation)
  3. Extension shows signed-in indicator when user is logged into transcriptgrab.com, and no indicator when logged out
  4. Clicking the button triggers a message-passing round trip to the background service worker and back (verified via console or placeholder response)
  5. Extension loads and functions without errors when user is not signed into transcriptgrab.com
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

### Phase 9: Transcript Panel
**Goal**: User can view, copy, and dismiss a full transcript panel directly on YouTube video pages
**Depends on**: Phase 8
**Requirements**: PANEL-01, PANEL-02, PANEL-03, PANEL-04, AUTH-04
**Success Criteria** (what must be TRUE):
  1. Clicking the transcript button opens a panel above the YouTube description area showing the full transcript text
  2. Panel shows a loading state while fetching and an error message if the transcript is unavailable
  3. User can copy the transcript to clipboard with a visual confirmation (toast or button state change)
  4. User can close the panel, and it stays closed until reopened
  5. Unauthenticated users see a non-blocking sign-in prompt (not a gate) suggesting they sign in for history saving
**Plans**: 2 plans

Plans:
- [x] 09-01-PLAN.md -- Backend wiring: port types/format utilities, update messaging protocol, wire background service worker to real API
- [x] 09-02-PLAN.md -- Panel UI: Shadow DOM panel with transcript display, copy/download, timestamp toggle, sign-in banner, button wiring

### Phase 10: AI Summaries + Auto-Save
**Goal**: User can generate AI summaries of video transcripts and have transcripts automatically saved to their history
**Depends on**: Phase 9
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, AUTH-02
**Success Criteria** (what must be TRUE):
  1. User can click a summarize button and see 3-7 bullet point takeaways generated from the transcript
  2. User can toggle between bullet point and paragraph summary formats
  3. Requesting a summary for the same video a second time returns the cached result without re-calling the AI model
  4. When a signed-in user fetches a transcript, it auto-saves to their history on transcriptgrab.com (visible on the history page)
  5. AI API key is moved server-side before Chrome Web Store publishing (Phase 11); direct calls acceptable for development
**Plans**: 2 plans

Plans:
- [ ] 10-01-PLAN.md -- Backend: summaries DB table, Gemini SDK integration, /api/summarize endpoint with caching
- [ ] 10-02-PLAN.md -- Extension: auto-save, summarize messaging, tabbed panel UI with format toggle and saved indicator

### Phase 11: Chrome Web Store Publishing
**Goal**: Extension is publicly available on the Chrome Web Store with a complete, compliant store listing
**Depends on**: Phase 10
**Requirements**: PUB-01, PUB-02, PUB-03
**Success Criteria** (what must be TRUE):
  1. Extension is published and installable from the Chrome Web Store by any user
  2. Store listing includes a privacy policy hosted at a stable URL on transcriptgrab.com
  3. Every requested permission is justified in the store listing description with a user-facing explanation
**Plans**: TBD

Plans:
- [ ] 11-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 8 -> 8.x -> 9 -> 9.x -> 10 -> 10.x -> 11

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 8. Extension Foundation | v2.0 | 2/2 | Complete | 2026-02-19 |
| 9. Transcript Panel | v2.0 | Complete    | 2026-02-19 | 2026-02-19 |
| 10. AI Summaries + Auto-Save | 2/2 | Complete    | 2026-02-19 | - |
| 11. Chrome Web Store Publishing | v2.0 | 0/? | Not started | - |
