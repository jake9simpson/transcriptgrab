# Roadmap: TranscriptGrab - Auth & User History

## Overview

This milestone transforms TranscriptGrab from a stateless transcript tool into a persistent user application. Users will authenticate via Google OAuth, automatically save transcripts they generate, and access a complete history library with search, export, and management capabilities. The journey starts with authentication infrastructure, adds database persistence, builds out the history interface, and concludes with polish features that differentiate the tool from competitors.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Auth Foundation** - Google OAuth sign-in, session management, protected routes
- [ ] **Phase 2: Database Infrastructure** - Vercel Postgres setup, schema, migrations, connection pooling
- [ ] **Phase 3: Transcript Persistence** - Auto-save transcripts, unauthenticated access preservation
- [ ] **Phase 4: History List** - Transcript library with cards, thumbnails, navigation
- [ ] **Phase 5: History Actions** - Copy, delete, and bulk operations on saved transcripts
- [ ] **Phase 6: Advanced History** - Search, format switching, timestamp toggle
- [ ] **Phase 7: Duplicate Detection & Polish** - Prevent duplicate saves, refinement

## Phase Details

### Phase 1: Auth Foundation
**Goal**: Users can sign in with Google, stay authenticated, and sign out
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. User can click "Sign in with Google" and complete OAuth flow
  2. User sees their profile info (name, avatar) when signed in
  3. User stays signed in across browser sessions and page refreshes
  4. User can sign out from any page and sees sign-in prompt again
  5. Protected routes (like /history) redirect unauthenticated users
**Plans**: 2 plans
- [x] 01-01-PLAN.md -- Auth.js v5 infrastructure (config, route handler, proxy, SessionProvider)
- [x] 01-02-PLAN.md -- Auth UI (sign-in button, avatar dropdown, sign-in hint, protected /history)

### Phase 2: Database Infrastructure
**Goal**: Database and schema ready to store user transcripts
**Depends on**: Phase 1 (requires auth tables for foreign keys)
**Requirements**: Enables PERS-*, HIST-* (infrastructure foundation)
**Success Criteria** (what must be TRUE):
  1. Vercel Postgres instance connected and accessible from app
  2. Database schema includes Auth.js adapter tables (users, accounts, sessions)
  3. Database schema includes transcripts table with proper foreign key to users
  4. Migrations run successfully in development and production
  5. Connection pooling configured to prevent exhaustion errors
**Plans**: 2 plans
- [ ] 02-01-PLAN.md -- Drizzle ORM setup, schema (users, accounts, transcripts), DB client, migration config
- [ ] 02-02-PLAN.md -- Wire Auth.js DrizzleAdapter, generate migration, provision Neon database

### Phase 3: Transcript Persistence
**Goal**: Signed-in users automatically save transcripts; unauthenticated users still work
**Depends on**: Phase 2 (database must exist)
**Requirements**: PERS-01, PERS-02, PERS-03, PERS-05
**Success Criteria** (what must be TRUE):
  1. Signed-in user generates transcript and it saves automatically without clicking "Save"
  2. Saved transcript includes full text, timestamps, video title, URL, thumbnail, and save date
  3. Unauthenticated user can still paste URL, get transcript, and copy without signing in
  4. User can save unlimited transcripts without hitting artificial storage limits
  5. Save operation completes without blocking transcript display
**Plans**: TBD

### Phase 4: History List
**Goal**: Users can view all their saved transcripts in a browsable library
**Depends on**: Phase 3 (transcripts must be saved to have history)
**Requirements**: HIST-01, HIST-02, HIST-03, HIST-04, UIUX-01
**Success Criteria** (what must be TRUE):
  1. User can navigate to /history and see all their saved transcripts
  2. Each transcript displays as a card with title, thumbnail, save date, and text preview
  3. Cards appear with most recent saves at the top
  4. User can click a card and view the full saved transcript
  5. Navigation exists between main transcript tool and history page
**Plans**: TBD

### Phase 5: History Actions
**Goal**: Users can copy, delete, and bulk-manage transcripts from history
**Depends on**: Phase 4 (history UI must exist)
**Requirements**: HIST-05, HIST-06, HIST-07, UIUX-04
**Success Criteria** (what must be TRUE):
  1. User can click one button to copy full transcript text from history
  2. Copy action shows visual confirmation (checkmark, toast, etc.)
  3. User can delete individual transcript from history with confirmation prompt
  4. User can select multiple transcripts with checkboxes
  5. User can delete all selected transcripts in one action
**Plans**: TBD

### Phase 6: Advanced History
**Goal**: Users can search, switch formats, and toggle timestamps in history
**Depends on**: Phase 5 (basic history operations must work)
**Requirements**: HIST-08, HIST-09, HIST-10, UIUX-02, UIUX-03
**Success Criteria** (what must be TRUE):
  1. User can type in search box and filter history by video title or URL
  2. Search updates instantly as user types (no search button required)
  3. User can export any saved transcript in plain text, timestamps, or SRT format
  4. User can switch between formats for same transcript without re-fetching from YouTube
  5. User can toggle timestamp visibility on transcript viewer
**Plans**: TBD

### Phase 7: Duplicate Detection & Polish
**Goal**: Prevent duplicate saves and refine edge cases
**Depends on**: Phase 6 (all core features operational)
**Requirements**: PERS-04
**Success Criteria** (what must be TRUE):
  1. User attempts to generate transcript for already-saved video and sees warning
  2. User can choose to save again or view existing saved transcript
  3. Duplicate check happens before save operation
  4. No race conditions or edge cases break auto-save functionality
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth Foundation | 2/2 | Complete | 2026-02-18 |
| 2. Database Infrastructure | 0/TBD | Not started | - |
| 3. Transcript Persistence | 0/TBD | Not started | - |
| 4. History List | 0/TBD | Not started | - |
| 5. History Actions | 0/TBD | Not started | - |
| 6. Advanced History | 0/TBD | Not started | - |
| 7. Duplicate Detection & Polish | 0/TBD | Not started | - |
