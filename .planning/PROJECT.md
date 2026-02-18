# TranscriptGrab

## What This Is

A YouTube transcript extractor with persistent user history. Users paste a video URL and get the transcript in multiple formats. Signed-in users get automatic transcript saving with a searchable history library, format switching, bulk management, and duplicate detection. Deployed on Vercel with Neon Postgres and Google OAuth.

## Core Value

Users can always find their previous transcripts without regenerating them.

## Requirements

### Validated

- ✓ User can paste a YouTube URL and get the transcript — existing
- ✓ User can switch between available caption languages — existing
- ✓ User can copy transcript to clipboard — existing
- ✓ User can download transcript as SRT file — existing
- ✓ User can toggle timestamp display on transcripts — existing
- ✓ Video metadata (title, author, thumbnail) displayed alongside transcript — existing
- ✓ Dark/light theme with persistence — existing
- ✓ Fallback transcript fetching when primary source fails — existing
- ✓ Google OAuth sign-in with JWT sessions — v1.0
- ✓ Sign out from any page with avatar dropdown — v1.0
- ✓ Session persists across refreshes and browser restarts — v1.0
- ✓ Auth state shown in UI (avatar or sign-in button) — v1.0
- ✓ Transcripts auto-saved to database when signed-in user generates one — v1.0
- ✓ Stored data includes full text, timestamps, title, URL, thumbnail, date — v1.0
- ✓ Unauthenticated users can still generate and copy without signing in — v1.0
- ✓ Duplicate detection warns before re-saving same video — v1.0
- ✓ No artificial limits on saved transcripts — v1.0
- ✓ History page with cards (title, thumbnail, date, preview) — v1.0
- ✓ Cards sorted by most recent first — v1.0
- ✓ Click card to view full transcript — v1.0
- ✓ One-click copy from history — v1.0
- ✓ Delete individual transcripts with confirmation — v1.0
- ✓ Bulk-select and delete multiple transcripts — v1.0
- ✓ Search history by video title or URL — v1.0
- ✓ Export in any format (plain, timestamps, SRT) — v1.0
- ✓ Switch format without re-fetching from YouTube — v1.0
- ✓ Navigation between transcript tool and history — v1.0
- ✓ Show/hide timestamps toggle — v1.0
- ✓ Polished card layout — v1.0
- ✓ Clean copy-to-clipboard with visual feedback — v1.0

### Active

(None yet — define in next milestone)

### Out of Scope

- Email/password auth — Google OAuth is sufficient, avoids password management
- Transcript sharing between users — not needed for personal history use case
- Mobile app — web-first approach
- Transcript editing — read-only is fine, editing creates source drift
- Team/organization features — single-user tool
- Browser extension — major effort, separate distribution channel

## Context

Shipped v1.0 with 3,717 LOC TypeScript across 7 phases (13 plans) in 1 day.
Tech stack: Next.js 16 App Router, TypeScript, Tailwind v4, shadcn/ui, Auth.js v5 (Google OAuth, JWT), Drizzle ORM, Neon Postgres.
All 23 v1 requirements satisfied per milestone audit.

## Constraints

- **Platform**: Vercel deployment
- **Database**: Neon Postgres with Drizzle ORM (pooled + unpooled connections)
- **Auth**: Auth.js v5 with Google OAuth, JWT strategy (no DB sessions)
- **Access**: Tool remains usable without sign-in; auth adds persistence only
- **Stack**: Next.js 16 App Router, TypeScript, Tailwind v4, shadcn/ui

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Google OAuth only (no email/password) | Simplicity, no password management needed | ✓ Good |
| Neon Postgres (not Vercel Postgres) | Serverless-friendly, pooled connections | ✓ Good |
| Auto-save transcripts (no save button) | Frictionless UX, users expect it to just work | ✓ Good |
| Open access for unauthenticated users | No friction for new users, auth adds value not gates it | ✓ Good |
| JWT sessions (no DB sessions) | Simpler, no session table management | ✓ Good |
| JSONB segments column | Client-side format switching without re-fetching | ✓ Good |
| Next.js 16 proxy.ts (not middleware.ts) | Framework convention for session handling | ✓ Good |
| Drizzle ORM with DrizzleAdapter | Type-safe queries, Auth.js integration | ✓ Good |
| onConflictDoNothing for duplicates | Silent skip preserves original save date | ✓ Good |
| Fail-open duplicate check endpoint | Returns non-error for unauthenticated users | ✓ Good |

---
*Last updated: 2026-02-18 after v1.0 milestone*
