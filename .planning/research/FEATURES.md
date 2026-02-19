# Feature Research

**Domain:** YouTube transcript Chrome extension + AI summaries (v2.0 milestone)
**Researched:** 2026-02-18
**Confidence:** MEDIUM-HIGH (ecosystem research via WebSearch; official Chrome Extension docs HIGH confidence, specific extension UI patterns MEDIUM)

---

## Context: This Is a Milestone Research File

This replaces the prior FEATURES.md (v1.0 web app features). The v1.0 web app is fully shipped. This file covers **only the new v2.0 features**: the Chrome extension and AI summaries. All v1.0 features (transcript fetching, formats, copy, auth, history library) are assumed already built.

---

## Competitive Landscape

### Extensions Analyzed

| Extension | Users | Key Differentiator | Panel Placement |
|-----------|-------|--------------------|-----------------|
| YTScribe | 550K+ (4.9/5) | Fast SRT/TXT, AI punctuation | Below video (sidebar area) |
| Glasp | Large | Highlight + notes + AI summary | Right side panel, top area |
| Eightify | Large | 8-point summary, timestamps linked | Beside video (right side) |
| Tactiq | Large | Meeting-first, 10 free/month limit | Sidebar overlay |
| YouTube Transcript (official-ish) | Large | Minimal, just text | Popup or sidebar |
| Notta | Mid | 58 language support, 98% accuracy claim | Sidebar |

### Placement Patterns (MEDIUM confidence, derived from multiple sources)

All major extensions inject into the YouTube page in one of two ways:
- **Right sidebar / beside-video area** — the most common, appears alongside the recommended videos column (Glasp, Eightify, YTScribe)
- **Below video / above description** — less common but more prominent (some extensions, Glasp also mentions this placement)
- **Browser action popup** — click extension icon, popup appears (used by simpler tools, less favored UX)

The project spec calls for injection **above the description area** — this is a legitimate pattern, though less dominant than the right-sidebar approach. It has the advantage of being in the reading flow of the page.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One-click transcript access from YouTube page | All major competitors do this; users expect zero extra steps | LOW | Button injected near player or in description area; content script DOM injection |
| Full transcript visible in panel | Core use case; users don't want to open a new tab | LOW | Scrollable panel with all segments, timestamp prefixes optional |
| Clickable timestamps → seek video | Every transcript extension does this; users learn to expect it | MEDIUM | Requires calling `ytInitialPlayerResponse` or YouTube's postMessage API to seek; must handle YouTube's SPA navigation |
| Copy transcript to clipboard | Same expectation as web app; primary action | LOW | One button, clipboard API, visual confirmation feedback |
| Format toggle (plain / timestamps / SRT) | Web app already sets this expectation for TranscriptGrab users | LOW | Reuse existing `lib/format.ts` logic; toggle tabs in panel header |
| Language selection | Videos with multiple caption tracks need this | LOW | Dropdown, same logic as web app; fetch available languages from API response |
| Works on any YouTube video with captions | Users expect it to "just work" regardless of channel or language | MEDIUM | Graceful failure messaging when captions unavailable; must handle YouTube's varied DOM states |
| Loading/error states | Users will try it on long videos or unavailable captions | LOW | Spinner while fetching; clear error if no captions found |
| Panel close/hide button | Users need to dismiss without refreshing | LOW | X button; state persists until page navigation |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI summary (bullet points + paragraph toggle) | Eightify/Glasp charge for this; doing it well inline is a real value-add | MEDIUM | Call Gemini API with transcript text; two format modes; show "Summarizing..." state |
| Auto-save to web app history (if signed in) | No competitor does this seamlessly with a companion web app; creates lock-in | HIGH | Requires auth detection from extension → web app session; see auth dependency below |
| Signed-in indicator in extension panel | Users need to know their transcript is being saved | LOW | Show avatar/email or "Saving to your library" confirmation in panel |
| Sign-in prompt (not gate) for unsigned users | Encourages conversion without blocking core use | LOW | Subtle "Sign in to save to history" link in panel footer; never blocks transcript access |
| Transcript search within panel | Glasp offers this; useful for long videos | MEDIUM | Client-side text search, highlight matching segments; requires in-panel search input |
| Chapter-aware summary | If video has YouTube chapters, summarize per-chapter | HIGH | Detect chapters from `ytInitialPlayerResponse`; send per-chapter text to Gemini; deferred to v2.1+ |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Separate extension sign-in / OAuth flow | Users want to sign in directly from extension | Duplicates auth system, requires separate extension OAuth credentials, complex token management | Detect existing transcriptgrab.com session via content script; prompt user to open web app if not signed in |
| Extension-side transcript storage (offline cache) | "I want transcripts to work offline" | chrome.storage.local is limited (5-10MB), duplicates Neon Postgres, creates sync complexity | All persistence stays in web app DB; extension is stateless except JWT |
| Extension settings page (options.html) | Power users want to configure behavior | Adds surface area, most options have sensible defaults | Put only essential options in panel itself (language, format) |
| Floating overlay / always-on-top panel | Users think they want this | Obscures video content, annoying to dismiss, breaks during YouTube SPA navigation | Inject inline above description; stable position, no collision with video |
| Support for non-YouTube video sites | "Can you add Vimeo?" | Completely different DOM structures, different transcript APIs, massive scope expansion | Chrome-first, YouTube-only; scope the extension's manifest matches to youtube.com |
| Live transcript while watching (real-time) | Eightify and others tease this; sounds useful | Requires entirely different approach (subtitle API, web socket), not what this extension does | Fetch full transcript on-demand; label it clearly as "video transcript" not "live captions" |
| Export to Notion/Google Docs | "I use Notion for notes" | Integration complexity, OAuth for each service, maintenance burden | Copy to clipboard; users paste where they want |

---

## Feature Dependencies

```
Chrome Extension (content script)
    ├──requires──> Manifest V3 extension scaffold (background, content script, popup if any)
    ├──requires──> youtube.com host permission in manifest
    └──requires──> InnerTube API access from extension
                   (same endpoint as web app, but called from extension context)

Transcript Panel (injected UI)
    ├──requires──> Content script DOM injection (MutationObserver for YouTube SPA)
    ├──requires──> Transcript fetch (calls existing /api/transcript or directly from extension)
    └──enables──> Format toggle (plain/timestamps/SRT — reuse lib/format.ts)
                  └──enables──> Copy to clipboard
                  └──enables──> Clickable timestamps → video seek

AI Summary
    ├──requires──> Transcript text (must fetch transcript first)
    ├──requires──> Gemini API key (server-side call to avoid key exposure)
    └──requires──> Summary API endpoint on web app (/api/summary)
                   └──requires──> Transcript panel already showing (summary is secondary view)

Auto-save from Extension
    ├──requires──> Auth detection (is user signed in to transcriptgrab.com?)
    │              ├──requires──> Content script on transcriptgrab.com (or)
    │              └──requires──> JWT passed via postMessage from web app to extension
    ├──requires──> Existing /api/transcripts POST endpoint (web app already has this)
    └──enables──> "Saved to history" confirmation in panel

Auth Detection
    ├──Option A──> Fetch /api/auth/session from extension (CORS issues, requires explicit Allow header)
    └──Option B──> Content script on transcriptgrab.com listens for auth events, stores JWT in chrome.storage.local
                   (recommended — avoids CORS, leverages JWT sessions already in use)
```

### Dependency Notes

- **AI Summary requires transcript first:** Summary is always a secondary action, never first-run. Show transcript panel before summary tab.
- **Auto-save requires auth detection:** Without knowing user identity, saving is impossible. Gracefully degrade: just don't auto-save, show sign-in prompt.
- **Format toggle requires raw segments:** Extension must store raw transcript segments (same JSONB structure as web app) to re-format client-side without re-fetching.
- **Clickable timestamps are a nice-to-have dependency:** Must handle YouTube's SPA navigation (URL changes without full page reload). MutationObserver required.
- **Gemini calls must be server-side:** Never expose Gemini API key in extension source code (it would be visible to anyone). Route through `/api/summary` on the web app.

---

## MVP Definition

### Launch With (v2.0)

Minimum viable product — what's needed to validate the Chrome extension concept.

- [ ] Chrome extension installs from Chrome Web Store (Manifest V3)
- [ ] Transcript button injected on YouTube video pages (above description area)
- [ ] Transcript panel shows full text with timestamps
- [ ] Copy to clipboard from panel
- [ ] Format toggle (plain text / with timestamps)
- [ ] Language selection for multi-language videos
- [ ] AI summary (bullet points) via Gemini — one-click from panel
- [ ] Bullet points / paragraph toggle for summary
- [ ] Auth detection from transcriptgrab.com session
- [ ] Auto-save to history when signed in, with visual confirmation
- [ ] Sign-in prompt (non-blocking) for unauthenticated users

### Add After Validation (v2.x)

Features to add once core extension is working and users are engaged.

- [ ] Clickable timestamps that seek video — add if users report wanting to jump to moments (high value but not essential for initial validation)
- [ ] In-panel transcript search — add if users are fetching long lectures/podcasts
- [ ] SRT format option in extension (v1 deferred this from panel to keep UI simple)
- [ ] Chapter-aware AI summaries — add if videos-with-chapters become a primary use case

### Future Consideration (v3+)

Features to defer until extension product-market fit is established.

- [ ] Firefox / Safari extension — validate Chrome first
- [ ] Per-video AI chat (Q&A against transcript) — high complexity, niche demand
- [ ] Offline transcript cache — complex, limited chrome.storage
- [ ] Subtitle download directly from extension — edge case; web app handles this

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Transcript panel injected on YouTube | HIGH | MEDIUM | P1 |
| Transcript button near player | HIGH | MEDIUM | P1 |
| Copy to clipboard | HIGH | LOW | P1 |
| Format toggle (plain/timestamps) | MEDIUM | LOW | P1 |
| Language selection | MEDIUM | LOW | P1 |
| AI summary (bullet points) | HIGH | MEDIUM | P1 |
| Bullet/paragraph summary toggle | MEDIUM | LOW | P1 |
| Auth detection + auto-save | HIGH | HIGH | P1 |
| Sign-in prompt (non-blocking) | MEDIUM | LOW | P1 |
| Loading and error states | HIGH | LOW | P1 |
| Clickable timestamps → seek | HIGH | MEDIUM | P2 |
| In-panel transcript search | MEDIUM | MEDIUM | P2 |
| SRT format in panel | LOW | LOW | P2 |
| Chapter-aware summaries | MEDIUM | HIGH | P3 |
| Firefox extension | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for v2.0 launch
- P2: Add in v2.x after validation
- P3: Future consideration

---

## Competitor Feature Analysis

| Feature | Glasp | Eightify | YTScribe | Tactiq | TranscriptGrab v2.0 |
|---------|-------|----------|----------|--------|----------------------|
| Panel placement | Right sidebar | Right side | Below video / sidebar | Sidebar overlay | Above description (inline) |
| Transcript access | Yes, timestamped | Via AI view | Yes, SRT/TXT | Yes | Yes |
| AI summary | Yes (ChatGPT/Claude/Gemini) | Yes (8-point, GPT) | No | Yes (ChatGPT) | Yes (Gemini, bullet + paragraph) |
| Format options | Limited | No raw transcript | SRT + TXT | TXT | Plain + timestamps + SRT |
| Highlight/annotate | Yes (core feature) | No | No | No | No (out of scope) |
| Save to library | Glasp-owned library | No | No | Notion/Slack integrations | TranscriptGrab history (web app) |
| Auth required | Glasp account | No | No | Optional | Optional (transcript always works) |
| Timestamp click-to-seek | Yes | Yes | No | No | P2 (after validation) |
| Free tier limits | Limited AI calls | 5-8 free/day | Free | 10 transcripts/month free | Unlimited transcript, Gemini quota |
| In-panel search | No | No | No | No | P2 (after validation) |

**Competitive positioning for v2.0:**
- Glasp/Eightify are the strongest competitors in the AI summary space — established, polished
- TranscriptGrab's advantage: seamless integration with personal transcript history (no competitor does this), plus no per-transcript limits on the web app
- Risk: Eightify/Glasp have head start in AI summary UX; must match their quality to not feel like a downgrade

---

## UX Patterns Validated by Research

### Panel Interaction Flow (MEDIUM confidence)

The expected flow for users installing and using a YouTube transcript extension:

1. User visits a YouTube video page
2. Extension injects button automatically (no extension-icon click needed for core flow)
3. User clicks button → panel slides in / expands above description
4. Transcript appears with timestamps; loading state visible while fetching
5. User copies text OR toggles to AI summary tab
6. AI summary tab: shows loading state while Gemini processes
7. User sees bullet points; can toggle to paragraph mode
8. If signed in: quiet "Saved to your library" toast confirmation
9. If not signed in: panel footer shows "Sign in to save transcripts"

### AI Summary Presentation (HIGH confidence based on Chrome Summarizer API docs + competitor research)

Standard format for AI summary in browser extensions:
- **Primary format: bullet points (key-points style)** — 3-7 bullets, each 1-2 sentences
- **Secondary format: paragraph (tldr style)** — 3-5 sentences, flowing prose
- **Toggle between formats:** Simple tab or button toggle (not a settings page)
- **Length:** Medium is the sweet spot; short feels incomplete, long defeats the purpose
- **Timestamps in summary:** Linking each bullet to a video timestamp is a differentiator that Eightify popularized; adds complexity but is high-value

### Auth Detection Pattern (MEDIUM confidence, sourced from next-auth GitHub discussions)

For detecting existing Auth.js v5 JWT session from extension:
- Content script injected on `transcriptgrab.com` pages
- Web app broadcasts JWT (or session indicator) via `window.postMessage` on auth events
- Extension content script captures message, stores token in `chrome.storage.local`
- Extension uses stored token when making API calls to `/api/transcripts` (auto-save) and `/api/summary` (Gemini)
- Token refresh: re-check on each new YouTube page load via background service worker ping to `/api/auth/session`

---

## Complexity Notes for Implementation

| Feature | Complexity Driver | Mitigation |
|---------|-------------------|------------|
| YouTube SPA navigation | YouTube doesn't do full page reloads; extension must detect URL changes and re-inject | Use MutationObserver on URL or `pushstate` intercept; standard pattern for YouTube extensions |
| Gemini API key exposure | Can't put API key in extension code (public) | Route all Gemini calls through `/api/summary` on web app; extension just passes transcript text |
| CORS for API calls from extension | Extension origin `chrome-extension://` is not `transcriptgrab.com` | Add `chrome-extension://*` to CORS `allowedOrigins` on relevant API routes; or use background service worker for all fetch calls |
| Auth.js session from extension | `api/auth/session` returns CORS errors from extension context | Use postMessage bridge or background service worker with credentials; validated pattern in next-auth community |
| YouTube DOM stability | YouTube frequently changes DOM structure; selectors break | Target stable data attributes or element roles; MutationObserver with retry; document known-good selectors in CLAUDE.md |
| Manifest V3 service worker | No persistent background page; service worker can sleep | Keep state in `chrome.storage.local`; don't assume background worker is alive |

---

## Sources

### Extension Ecosystem Research
- [8 Best YouTube Video Transcription Chrome Extensions (2026) - TubeOnAI](https://tubeonai.com/youtube-video-transcription-chrome-extensions/)
- [Free YouTube Transcript Chrome Extension | 550K+ Users (2026) | YTScribe](https://ytscribe.com/blog/chrome-extension)
- [Top Alternatives to Eightify for YouTube Summarization (2025)](https://www.tubememo.com/blog/top-alternatives-to-eightify-for-youtube-summarization-2025)
- [YouTube Transcript Extractors Compared (2026) | Jellypod](https://www.jellypod.com/blog/youtube-transcript-extractors-compared)
- [Top 6 AI Summary Extensions in 2026 | Mapify](https://mapify.so/blog/top-ai-summary-extensions)

### AI Summary UX Patterns
- [Summarize with built-in AI | Chrome Summarizer API | Chrome for Developers](https://developer.chrome.com/docs/ai/summarizer-api) — HIGH confidence, official docs
- [AI UX Patterns | Summary | ShapeofAI.com](https://www.shapeof.ai/patterns/summary)
- [10 Best Free AI YouTube Summary Chrome Extensions | Web Highlights](https://web-highlights.com/blog/best-youtube-ai-summary-chrome-extension/)

### Auth Detection Patterns
- [Sharing next-auth authentication with a Chrome extension | nextauthjs/next-auth Discussion #6021](https://github.com/nextauthjs/next-auth/discussions/6021) — MEDIUM confidence, community-validated pattern

### Chrome Extension Technical Patterns
- [Content scripts | Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — HIGH confidence, official docs
- [chrome.cookies API | Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/cookies) — HIGH confidence, official docs

### Competitor Analysis Sources
- [Glasp YouTube Transcript](https://glasp.co/youtube-transcript)
- [Tactiq YouTube Transcript Tool 2025](https://transtube.io/tactiq-youtube-transcript/)
- [My Honest Tactiq AI Review & 5 Better Alternatives (2026) - tl;dv](https://tldv.io/blog/tactiq-alternatives/)
- [Eightify AI YouTube Summarizer](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb)

---

*Feature research for: TranscriptGrab v2.0 — Chrome Extension + AI Summaries*
*Researched: 2026-02-18*
