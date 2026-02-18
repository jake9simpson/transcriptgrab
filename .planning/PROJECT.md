# TranscriptGrab

## What This Is

A YouTube transcript extractor that lets users paste a video URL and instantly get the transcript in multiple formats. Deployed on Vercel with a dual-fetch strategy (InnerTube + Supadata fallback). The next milestone adds persistent storage, user accounts, and transcript history so users never have to regenerate a transcript they've already grabbed.

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

### Active

- [ ] Transcripts auto-saved to database when signed-in user generates one
- [ ] Google OAuth sign-in
- [ ] Transcript history page with cards (title, date, preview)
- [ ] Full transcript view from history
- [ ] One-click copy from history
- [ ] Unauthenticated users can still use the tool (just without saving)
- [ ] Polished card layout and navigation between current transcript and history
- [ ] Show/hide timestamps option on transcript viewer

### Out of Scope

- Email/password auth — Google OAuth is sufficient for v1, keeps it simple
- Transcript sharing between users — not needed for personal history use case
- Full-text search across transcripts — can revisit in v2
- Mobile app — web-first
- Transcript editing — read-only is fine
- Team/organization features — single-user tool

## Context

- Existing Next.js 16 App Router codebase with TypeScript, Tailwind v4, shadcn/ui
- Deployed on Vercel with Supadata API key for transcript fallback
- YouTube blocks cloud provider IPs, so Supadata fallback is required in production
- No database or auth currently — these are net-new additions
- Codebase map available at `.planning/codebase/`

## Constraints

- **Platform**: Vercel deployment — database and auth must be Vercel-compatible
- **Database**: Vercel Postgres — native integration, serverless-friendly
- **Auth**: Google OAuth only — via NextAuth.js or similar
- **Access**: Tool remains usable without sign-in; auth adds persistence only
- **Stack**: Next.js 16 App Router, TypeScript, Tailwind v4, shadcn/ui (existing)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Google OAuth only (no email/password) | Simplicity, no password management needed | — Pending |
| Vercel Postgres for storage | Native Vercel integration, zero config | — Pending |
| Auto-save transcripts (no save button) | Frictionless UX, users expect it to just work | — Pending |
| Open access for unauthenticated users | No friction for new users, auth adds value not gates it | — Pending |

---
*Last updated: 2026-02-17 after initialization*
