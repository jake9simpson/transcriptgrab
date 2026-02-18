# Feature Research

**Domain:** YouTube transcript extraction with user accounts and persistent storage
**Researched:** 2026-02-17
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Auto-save on fetch | Standard web app behavior for signed-in users | LOW | Save transcript immediately when fetched (if authenticated) |
| Transcript history list | Core value of "save and revisit" | LOW | Chronological list with video metadata |
| Quick copy from history | Primary use case: copy text without re-fetching | LOW | One-click copy button on each history card |
| Basic search | Users expect to find specific videos in their library | MEDIUM | Search by video title or URL at minimum |
| Delete individual items | Users need to remove unwanted transcripts | LOW | Delete button on each card |
| Thumbnail preview | Visual identification is faster than reading titles | LOW | Use YouTube thumbnail API (already in next.config.ts) |
| Timestamp display | Users want to know when they saved something | LOW | "Saved 2 days ago" or actual date |
| Unauthenticated access | Can't require sign-in for core functionality | LOW | Must work without account (per project context) |
| Export individual transcripts | Same formats as main tool (plain, timestamps, SRT) | LOW | Reuse existing format.ts functions |
| Sign out | Standard auth flow requirement | LOW | Clear session, redirect to home |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| No "25 transcript limit" on free tier | Otter.ai archives after 25; we don't have to | LOW | Competitive advantage over paid tools |
| Instant re-copy without re-fetch | History persists full transcript text in DB | LOW | Faster than competitors who re-fetch |
| Format switching in history | Change format (plain → SRT) without new fetch | MEDIUM | Store raw transcript data, format on demand |
| Duplicate detection | Prevent same video saved multiple times | MEDIUM | Check video ID before inserting new record |
| Bulk export | Export multiple transcripts at once | MEDIUM | Select multiple → download ZIP or combined file |
| Bulk delete | Clean up library faster than one-by-one | LOW | Checkbox selection + "Delete selected" button |
| Tag/label system | Better organization than just chronological list | MEDIUM | User-defined tags, multi-tag support |
| Filter by format | Show only SRT exports, or only timestamped | LOW | Client-side filtering on history page |
| Share link to specific transcript | Send read-only link to non-users | HIGH | Public UUID-based URLs, privacy concerns |
| Browser extension | Save directly from YouTube without visiting site | HIGH | Deferred to v2+, Chrome/Firefox extension |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Folders/nested collections | Users think they need hierarchical organization | Creates decision fatigue, rarely used effectively per read-later app research | Flat list with tags + search is faster |
| Real-time collaborative editing | "What if multiple people want to edit?" | Massive complexity, not the core use case | Stick to read-only history, use export for editing |
| Inline transcript editing | Users want to fix errors in saved transcripts | Transcript drift from source, unclear value vs re-fetch | Store original only, edit in external tools after export |
| Storage quotas/limits | "Competitors have limits, we should too" | Creates user friction, unnecessary for text data | Text is cheap; don't add artificial limits |
| AI summarization in history | "Everyone has AI now" | Cost (API calls per view), accuracy issues, scope creep | Focus on fast access to full text; users can paste into ChatGPT |
| Advanced search operators | Power users request Boolean AND/OR/NOT | Adds UI complexity, 90% of users won't use it | Simple keyword search covers 95% of use cases |
| Social features (likes, comments) | "Make it social for engagement" | Privacy concerns, moderation burden, not core value | TranscriptGrab is a utility, not a social network |
| Multiple export formats per save | "Save as TXT and SRT simultaneously" | Storage bloat, confusing UX | Format is a view concern, not storage concern |

## Feature Dependencies

```
Google OAuth Sign-In
    ├──requires──> @auth/core or next-auth
    └──enables──> Auto-save on fetch
                  └──requires──> Vercel Postgres storage
                                 └──enables──> Transcript history list
                                                ├──enables──> Search
                                                ├──enables──> Delete
                                                ├──enables──> Bulk actions
                                                └──enables──> Export from history

Duplicate detection ──requires──> Vercel Postgres (check existing video_id)

Tags ──requires──> Additional DB table (transcript_tags, many-to-many)

Share links ──requires──> Public read endpoints + UUID generation
```

### Dependency Notes

- **Auto-save requires auth:** Can't save without knowing which user to save for
- **All history features require storage:** Postgres is the foundation
- **Duplicate detection needs DB queries:** Must check `video_id` before INSERT
- **Tags add complexity:** Separate table, junction table, more queries
- **Share links need security planning:** Public URLs expose data; need UUID strategy

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [x] Google OAuth sign-in — Essential for user identity
- [x] Auto-save transcripts on fetch (if signed in) — Core "save and revisit" value
- [x] Transcript history page with cards — Visual library of saved transcripts
- [x] Quick copy from history — Primary use case without re-fetch
- [x] Delete individual transcripts — Users need cleanup capability
- [x] Basic search (title/URL) — Find specific videos in growing library
- [x] Thumbnail + metadata display — Visual identification + context
- [x] Export from history (reuse formats) — Access saved transcripts in different formats
- [x] Unauthenticated users still work — Don't block core tool with auth wall

### Add After Validation (v1.x)

Features to add once core is working and users are engaged.

- [ ] Duplicate detection — Add when users report saving same video twice (likely early feedback)
- [ ] Bulk delete — Add when users have 50+ transcripts and complain about cleanup time
- [ ] Filter by date range — Add when search alone isn't enough
- [ ] Format switching in history — Add if users request "I saved as plain text but want SRT now"
- [ ] Tags/labels — Add only if users explicitly ask for better organization

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Bulk export (ZIP download) — Wait for user requests; edge case initially
- [ ] Share links — High complexity, defer until clear demand
- [ ] Browser extension — Major effort, separate distribution, v2+ feature
- [ ] Folders — Only if tags prove insufficient (unlikely per research)
- [ ] AI features — Scope creep; users can paste into ChatGPT themselves

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Google OAuth sign-in | HIGH | MEDIUM | P1 |
| Auto-save on fetch | HIGH | LOW | P1 |
| Transcript history page | HIGH | LOW | P1 |
| Quick copy from history | HIGH | LOW | P1 |
| Delete individual | HIGH | LOW | P1 |
| Basic search | HIGH | MEDIUM | P1 |
| Thumbnail display | MEDIUM | LOW | P1 |
| Export from history | HIGH | LOW | P1 |
| Duplicate detection | MEDIUM | MEDIUM | P2 |
| Bulk delete | MEDIUM | LOW | P2 |
| Filter by date | MEDIUM | LOW | P2 |
| Format switching | LOW | MEDIUM | P2 |
| Tags/labels | MEDIUM | MEDIUM | P2 |
| Bulk export | LOW | MEDIUM | P3 |
| Share links | LOW | HIGH | P3 |
| Browser extension | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (table stakes)
- P2: Should have, add when users request or complain
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Otter.ai | Tactiq | Our Approach |
|---------|----------|--------|--------------|
| Save history | Yes (25 limit free) | Auto-saves to integrations | Unlimited free history |
| Search transcripts | Yes (keyword search) | Not mentioned | Keyword search (title/URL) |
| Export formats | TXT, DOCX, PDF, SRT | .txt download | TXT, SRT, timestamps (reuse existing) |
| Organization | Folders, channels, teams | AI summaries, action items | Flat list + search (v1), tags (v1.x) |
| Duplicate handling | Not mentioned | Not mentioned | Detect and warn before save (v1.x) |
| Sign-in required | Yes (free plan available) | No (for YT tool) | Optional (unauthenticated still works) |
| Bulk actions | Not mentioned | Not mentioned | Bulk delete (v1.x) |
| Sharing | Team collaboration features | Direct links | Deferred to v2+ |
| AI features | Otter AI Chat, summaries | AI summaries, prompts | Explicitly not building (users can use ChatGPT) |

**Competitive positioning:**
- Otter.ai: Full-featured, freemium model, 25 transcript limit on free tier
- Tactiq: Integration-focused, no sign-in barrier for YouTube tool
- **TranscriptGrab:** Unlimited free history, fast copy-paste workflow, no AI bloat

## Sources

### Transcript Tool Competitive Analysis
- [EaseUS YouTube Transcript Generator](https://multimedia.easeus.com/youtube-transcript/) - History and account features
- [Otter.ai YouTube Transcript Generator](https://otter.ai/youtube-transcript-generator) - Export formats, editing, AI features
- [Tactiq YouTube Transcript](https://tactiq.io/tools/youtube-transcript) - Free, no sign-in approach
- [Best Free YouTube Transcript Generator Tools (2026 Guide)](https://www.happyscribe.com/blog/best-free-youtube-transcript-generator-tools-2026-guide)
- [5 Best Free YouTube Transcript Extractors to Try in 2026](https://www.scrapingdog.com/blog/5-best-free-youtube-transcript-extractors/)

### Transcript App Organization Features
- [Sonix: Organize your media & search transcripts](https://sonix.ai/features/organize-and-search) - Folders, tags, search
- [10 Best Transcription Software & Apps in 2026](https://clickup.com/blog/transcription-software/)
- [10 Best Meeting Transcription Software [2026]](https://www.meetjamie.ai/blog/meeting-transcription-software) - Tagging, filtering, search

### Otter.ai Specific Features
- [Otter.ai Free Plan Limits (2026): Minutes, Storage & What's Capped](https://www.unkoa.com/otter-ai-free-plan-limits-2026/) - 25 transcript history limit
- [Otter AI Transcription Limits 2026: Free vs Pro vs Business](https://summarizemeeting.com/en/faq/otter-ai-transcription-limits-2026/)
- [Honest Otter AI Review in 2026](https://tldv.io/blog/otter-ai-review/) - Search, folders, playback features

### Read-Later App UX Patterns
- [The 4 best read it later apps to save content](https://zapier.com/blog/best-bookmaking-read-it-later-app/)
- [10 Best Read-Later Apps in 2026: Complete Comparison Guide](https://www.readless.app/blog/best-read-later-apps-comparison)
- [Best Read-It-Later Apps in 2026](https://www.cloudwards.net/best-read-it-later-apps/)

### Pocket vs Instapaper Comparison
- [Instapaper vs. Pocket: Which is best?](https://zapier.com/blog/instapaper-vs-pocket/) - Tagging vs folders, organization patterns
- [Instapaper vs Pocket 2026](https://www.cloudwards.net/instapaper-vs-pocket/) - Feature comparison, user expectations

### Content Library Management
- [Bulk actions | Contentful Help Center](https://www.contentful.com/help/content-and-entries/managing-multiple-entries/) - Bulk delete, archive, export patterns
- [ChatGPT Delete All Chats](https://chromewebstore.google.com/detail/chatgpt-delete-all-chats/daipnaolfenpglcjgjkgeaandppiabgn) - Bulk actions, archive UX

### Auto-Save UX Patterns
- [To save or to autosave: Autosaving patterns in modern web applications](https://medium.com/@brooklyndippo/to-save-or-to-autosave-autosaving-patterns-in-modern-web-applications-39c26061aa6b)
- [Designing a user-friendly autosave functionality](https://uxdesign.cc/designing-a-user-friendly-autosave-functionality-439f2fe4222d)
- [Autosave design pattern](https://ui-patterns.com/patterns/autosave)

### User Complaints and Pain Points
- [Best Read-It-Later Apps in 2026](https://www.cloudwards.net/best-read-it-later-apps/) - Common problems: slow bulk transfers, poor fetch reliability
- [Top Mobile App Retention Features in 2026](https://www.remoteface.com/top-mobile-app-retention-features-in-2026-and-why-most-apps-still-lose-users/) - "Think too much, click too much, learn too much before results"

### UX Mistakes to Avoid
- [Reduce Redundancy: Decrease Duplicated Design Decisions](https://www.nngroup.com/articles/reduce-redundancydecrease-duplicated-design-decisions/) - Duplicate content UX issues
- [13 UX Design Mistakes You Should Avoid in 2026](https://www.wearetenet.com/blog/ux-design-mistakes)

---
*Feature research for: TranscriptGrab (YouTube transcript extraction with user accounts)*
*Researched: 2026-02-17*
