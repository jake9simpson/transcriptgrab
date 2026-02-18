# Requirements: TranscriptGrab

**Defined:** 2026-02-17
**Core Value:** Users can always find their previous transcripts without regenerating them

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign in with Google OAuth
- [ ] **AUTH-02**: User can sign out from any page
- [ ] **AUTH-03**: User session persists across page refreshes and browser restarts
- [ ] **AUTH-04**: Auth state shown in UI (signed-in user info or sign-in button)

### Transcript Persistence

- [ ] **PERS-01**: Transcript auto-saved to database when signed-in user generates one
- [ ] **PERS-02**: Stored data includes full transcript text, timestamps, video title, video URL, thumbnail URL, and save date
- [ ] **PERS-03**: Unauthenticated users can still generate and copy transcripts without signing in
- [ ] **PERS-04**: Duplicate detection warns or prevents saving the same video transcript twice
- [ ] **PERS-05**: No artificial limits on number of saved transcripts

### History Page

- [ ] **HIST-01**: Signed-in user can view all saved transcripts on a dedicated history page
- [ ] **HIST-02**: History displays as cards with video title, thumbnail, save date, and text preview
- [ ] **HIST-03**: Cards sorted by most recent first
- [ ] **HIST-04**: User can click a card to view the full transcript
- [ ] **HIST-05**: User can one-click copy full transcript text from history
- [ ] **HIST-06**: User can delete individual transcripts from history
- [ ] **HIST-07**: User can bulk-select and delete multiple transcripts
- [ ] **HIST-08**: User can search history by video title or URL
- [ ] **HIST-09**: User can export transcript from history in any available format (plain, timestamps, SRT)
- [ ] **HIST-10**: User can switch transcript format in history view without re-fetching from YouTube

### UI/UX

- [ ] **UIUX-01**: Navigation between main transcript tool and history page
- [ ] **UIUX-02**: Show/hide timestamps toggle on transcript viewer
- [ ] **UIUX-03**: Polished card layout for history items
- [ ] **UIUX-04**: Clean copy-to-clipboard with visual feedback

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Organization

- **ORG-01**: User can tag/label transcripts for categorization
- **ORG-02**: User can filter history by date range

### Export

- **EXPO-01**: User can bulk export multiple transcripts as ZIP download

### Sharing

- **SHAR-01**: User can generate a read-only share link for a specific transcript

## Out of Scope

| Feature | Reason |
|---------|--------|
| Email/password auth | Google OAuth sufficient, avoids password management complexity |
| Folders/nested collections | Research shows flat list + search is more effective than hierarchical organization |
| AI summarization | Scope creep; users can paste transcripts into ChatGPT themselves |
| Transcript editing | Read-only is fine; editing creates source drift |
| Browser extension | Major effort, separate distribution channel, v2+ |
| Real-time collaboration | Massive complexity, not the core use case |
| Social features | TranscriptGrab is a utility, not a social network |
| Mobile app | Web-first approach |
| Storage quotas | Text is cheap; no artificial limits |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| PERS-01 | — | Pending |
| PERS-02 | — | Pending |
| PERS-03 | — | Pending |
| PERS-04 | — | Pending |
| PERS-05 | — | Pending |
| HIST-01 | — | Pending |
| HIST-02 | — | Pending |
| HIST-03 | — | Pending |
| HIST-04 | — | Pending |
| HIST-05 | — | Pending |
| HIST-06 | — | Pending |
| HIST-07 | — | Pending |
| HIST-08 | — | Pending |
| HIST-09 | — | Pending |
| HIST-10 | — | Pending |
| UIUX-01 | — | Pending |
| UIUX-02 | — | Pending |
| UIUX-03 | — | Pending |
| UIUX-04 | — | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 0
- Unmapped: 23

---
*Requirements defined: 2026-02-17*
*Last updated: 2026-02-17 after initial definition*
