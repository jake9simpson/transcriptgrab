# Requirements: TranscriptGrab

**Defined:** 2026-02-18
**Core Value:** Users can always find their previous transcripts without regenerating them

## v2.0 Requirements

Requirements for Chrome Extension + AI Summaries milestone. Each maps to roadmap phases.

### Extension Core

- [x] **EXT-01**: Extension installs as a Manifest V3 Chrome extension
- [x] **EXT-02**: Content script injects transcript button near YouTube player controls
- [x] **EXT-03**: Extension handles YouTube SPA navigation (re-injects UI on video changes)
- [x] **EXT-04**: All API calls route through background service worker (message-passing)

### Transcript Panel

- [x] **PANEL-01**: User can click button to open transcript panel above YouTube description area
- [x] **PANEL-02**: Panel displays full transcript text with loading and error states
- [x] **PANEL-03**: User can copy transcript to clipboard with visual confirmation
- [x] **PANEL-04**: User can close/hide the panel

### AI Summary

- [x] **AI-01**: User can generate AI summary of the video transcript
- [x] **AI-02**: Summary displays as bullet points (3-7 key takeaways)
- [x] **AI-03**: User can toggle between bullet points and paragraph summary
- [x] **AI-04**: Summaries proxy through backend `/api/summarize` route (Gemini key server-side only)
- [x] **AI-05**: Summaries cached by videoId to avoid redundant API calls

### Auth & Persistence

- [x] **AUTH-01**: Extension detects if user is signed into transcriptgrab.com
- [ ] **AUTH-02**: Transcript auto-saves to history when user is signed in
- [x] **AUTH-03**: Extension shows signed-in status indicator
- [x] **AUTH-04**: Non-blocking sign-in prompt for unauthenticated users
- [x] **AUTH-05**: Extension works fully without sign-in (transcript + summary available, no persistence)

### Publishing

- [ ] **PUB-01**: Extension published on Chrome Web Store
- [ ] **PUB-02**: Store listing includes privacy policy at stable URL
- [ ] **PUB-03**: All permissions justified in store listing description

## Future Requirements

Deferred to post-v2.0. Tracked but not in current roadmap.

### Transcript Panel Enhancements

- **PANEL-05**: User can toggle between plain text and timestamped formats in extension
- **PANEL-06**: User can select caption language for multi-language videos
- **PANEL-07**: User can download transcript as SRT from extension
- **PANEL-08**: Clickable timestamps seek video to that position
- **PANEL-09**: User can search within transcript text in panel

### AI Summary Enhancements

- **AI-06**: Chapter-aware summaries for videos with YouTube chapters
- **AI-07**: Per-video AI chat (Q&A against transcript)

### Cross-Platform

- **PLAT-01**: Firefox extension
- **PLAT-02**: Safari extension

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Extension-side transcript storage (offline cache) | chrome.storage.local is limited, duplicates DB, creates sync complexity |
| Separate extension OAuth sign-in flow | Duplicates auth system, extension detects web app session instead |
| Extension settings/options page | Adds surface area; sensible defaults are sufficient |
| Non-YouTube video sites (Vimeo, etc.) | Completely different DOM/API; YouTube-only for v2.0 |
| Real-time/live transcript (subtitles while watching) | Different technical approach entirely; this is on-demand transcript fetching |
| Export to Notion/Google Docs | Integration complexity; copy to clipboard is sufficient |
| AI summaries on web app | Extension-only for now; test feature viability before expanding |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXT-01 | Phase 8 | Complete |
| EXT-02 | Phase 8 | Complete |
| EXT-03 | Phase 8 | Complete |
| EXT-04 | Phase 8 | Complete |
| PANEL-01 | Phase 9 | Complete |
| PANEL-02 | Phase 9 | Complete |
| PANEL-03 | Phase 9 | Complete |
| PANEL-04 | Phase 9 | Complete |
| AI-01 | Phase 10 | Complete |
| AI-02 | Phase 10 | Complete |
| AI-03 | Phase 10 | Complete |
| AI-04 | Phase 10 | Complete |
| AI-05 | Phase 10 | Complete |
| AUTH-01 | Phase 8 | Complete |
| AUTH-02 | Phase 10 | Pending |
| AUTH-03 | Phase 8 | Complete |
| AUTH-04 | Phase 9 | Complete |
| AUTH-05 | Phase 8 | Complete |
| PUB-01 | Phase 11 | Pending |
| PUB-02 | Phase 11 | Pending |
| PUB-03 | Phase 11 | Pending |

**Coverage:**
- v2.0 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-18 after roadmap creation*
