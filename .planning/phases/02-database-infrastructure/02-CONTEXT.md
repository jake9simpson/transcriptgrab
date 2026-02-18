# Phase 2: Database Infrastructure - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up Vercel Postgres with schema to store users, accounts, and transcripts. Includes Auth.js adapter tables, transcripts table with foreign key to users, migrations, and connection pooling. This is the persistence foundation for Phases 3-7.

</domain>

<decisions>
## Implementation Decisions

### Transcript record shape
- Minimal metadata per transcript: video title, URL, thumbnail URL, transcript text, save date
- No extra fields (channel name, duration, language, publish date) — keep lean, add later if needed
- One transcript per video per user — unique constraint on user + video. Re-saving updates the existing record rather than creating duplicates

### Auth session model
- Keep JWT sessions (current Phase 1 approach) — no database session storage
- Database stores users and accounts for foreign keys, but session state stays in the cookie
- No DB hit per authenticated request

### Claude's Discretion
- Whether to store raw timestamped segments (for format switching in Phase 6) or formatted text only — weigh Phase 6 requirements against schema simplicity
- Whether to extract video_id as a dedicated column or use full URL for uniqueness — pick what makes duplicate detection cleanest
- User record creation timing (first sign-in vs first save) — pick cleanest Auth.js adapter integration
- Profile sync on re-login (update from Google vs store once) — follow Auth.js adapter defaults
- Auth.js adapter table scope (full schema vs minimal users+accounts) — pick what JWT strategy actually requires
- ORM/query layer choice
- Migration tooling
- Connection pool configuration

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

*Phase: 02-database-infrastructure*
*Context gathered: 2026-02-17*
