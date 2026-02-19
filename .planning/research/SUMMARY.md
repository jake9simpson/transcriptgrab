# Project Research Summary

**Project:** TranscriptGrab v2.0 — Chrome Extension + AI Summaries
**Domain:** Manifest V3 Chrome Extension + Gemini AI Integration with existing Next.js/Vercel app
**Researched:** 2026-02-18
**Confidence:** HIGH

## Executive Summary

TranscriptGrab v2.0 adds a Chrome extension that injects a transcript panel into YouTube video pages, plus AI-powered summaries via Google Gemini. The v1.0 web app (Next.js 16, Auth.js v5, Drizzle/Neon, InnerTube + Supadata) is fully shipped and becomes the backend for this milestone — the extension calls the existing API routes rather than duplicating any transcript logic. The recommended build approach is WXT framework for the extension scaffold (the community consensus replacement for Plasmo and CRXJS), `@google/genai` SDK calling `gemini-2.5-flash` through a new backend proxy route, and a message-passing architecture where all API calls flow through the background service worker, not the content script.

The single most important architectural constraint is that Manifest V3 creates three isolated execution environments — content script, background service worker, and popup — that cannot directly share state or make each other's API calls. Every design decision flows from this: API calls must be proxied through the background service worker (content scripts face CORS restrictions that service workers do not), the Gemini API key must live in Vercel environment variables and never appear in the extension bundle, and any state that needs to survive service worker termination must be persisted to `chrome.storage.local`. The extension is intentionally stateless except for cached session data.

The primary risks are: (1) YouTube's SPA navigation breaking content script injection — solvable with `yt-navigate-finish` event listening and a MutationObserver fallback; (2) Gemini's free tier being too restrictive for any real user load (20 RPD after December 2025 cuts) — requires summary caching by video ID in the existing DB before any public launch; (3) Chrome Web Store review adding 1-4 weeks to the timeline — requires starting store listing preparation in parallel with final development, not after. None of these risks are blockers, but all three require upfront design decisions rather than retrofitting.

---

## Key Findings

### Recommended Stack

The extension is built with WXT (`^0.20.17`), the current community-standard framework for Manifest V3 extensions in 2026. WXT provides HMR for content scripts during development, Vite bundling (required for MV3's no-remote-code constraint), and React 19 support via `@wxt-dev/module-react`. Plasmo is effectively abandoned and must not be used. CRXJS (`^2.3.0`) is a viable alternative but has uncertain long-term maintenance.

Gemini integration uses the `@google/genai` SDK (`^1.41.0`) — the GA replacement for the deprecated `@google/generative-ai`. The target model is `gemini-2.5-flash` with a 1M token context window, which handles any YouTube transcript without chunking. Tailwind v4 in WXT requires the `@tailwindcss/vite` Vite plugin, not the PostCSS path (which is broken in WXT's Vite pipeline).

**Core technologies — new additions only:**
- **WXT `^0.20.17`**: Extension build framework — only maintained MV3 framework with HMR and React support
- **`@wxt-dev/module-react`**: React integration for extension entry points
- **`@google/genai` `^1.41.0`**: Gemini SDK — GA replacement for legacy SDK, installed in Next.js root (server-side calls only)
- **`@tailwindcss/vite` `^4.0.0`**: Tailwind v4 in WXT — Vite plugin path only, not PostCSS

**Critical version constraints:**
- Use `gemini-2.5-flash` — do NOT use `gemini-2.0-flash` (deprecated) or `gemini-1.5-flash` (superseded)
- Use `@google/genai` not `@google/generative-ai` — legacy SDK is deprecated

### Expected Features

The MVP (v2.0) covers the full extension lifecycle: install, inject on YouTube, display transcript, copy/format/language options, AI summary with bullet/paragraph toggle, auth detection from the web app session, auto-save to history when signed in, and a non-blocking sign-in prompt for unauthenticated users. Every major competitor (Glasp, Eightify, YTScribe) provides the transcript panel as a baseline expectation. The AI summary and auto-save-to-personal-library combination is a genuine differentiator — no competitor links to a companion web app history.

**Must have (v2.0 table stakes):**
- Transcript panel injected above description area on YouTube video pages
- One-click transcript fetch with loading and error states
- Copy to clipboard with visual confirmation
- Format toggle (plain text / with timestamps)
- Language selection for multi-caption videos
- AI summary via Gemini — bullet points with paragraph mode toggle
- Auth detection from transcriptgrab.com session
- Auto-save to history when signed in, with confirmation
- Non-blocking sign-in prompt for unauthenticated users

**Should have (v2.x, post-validation):**
- Clickable timestamps that seek the video (requires YouTube postMessage API integration)
- In-panel transcript search with highlight
- SRT format option in extension panel

**Defer to v3+:**
- Firefox/Safari extension (validate Chrome first)
- Per-video AI chat (Q&A against transcript)
- Chapter-aware AI summaries
- Offline transcript cache

### Architecture Approach

The extension lives in an `extension/` subdirectory at the repo root with its own `package.json` and WXT build pipeline. It shares no build tooling with the Next.js app but calls the same API routes. The only new backend code is a single `POST /api/summarize` route that proxies to Gemini using the server-side `GEMINI_API_KEY`. All other extension API calls (`/api/transcript`, `/api/metadata`, `/api/auth/session`) already exist.

**Major components:**

1. **Content Script** (`extension/src/content/`) — Detects YouTube video pages, injects button and transcript panel via Shadow DOM, listens for SPA navigation events, relays all API requests to background service worker via `chrome.runtime.sendMessage`
2. **Background Service Worker** (`extension/src/background/`) — Proxies all API fetches (bypassing CORS via `host_permissions`), checks session via `/api/auth/session`, persists session data to `chrome.storage.local`, routes messages between content script and backend
3. **`/api/summarize` route** (new, Next.js web app) — Receives transcript text from background SW, calls Gemini with `GEMINI_API_KEY`, returns structured summary; handles safety filter blocks and rate limit errors gracefully
4. **Extension popup** (optional) — Displays auth status and link to web app; reads from `chrome.storage.local`

**Key patterns enforced throughout:**
- Shadow DOM for all injected UI — prevents YouTube CSS from bleeding into extension panel
- Message-passing for all privileged operations — content script sends to background SW, never fetches directly
- `yt-navigate-finish` event + MutationObserver fallback — handles YouTube SPA navigation
- Session detection via credentialed GET to `/api/auth/session` — not direct cookie reads (encrypted JWT cannot be decoded without AUTH_SECRET)
- All state persisted to `chrome.storage.local`, never service worker globals

### Critical Pitfalls

1. **Content script CORS** — Content scripts on youtube.com cannot make cross-origin requests even with `host_permissions`. Route all API calls through the background service worker. Getting this wrong requires a new extension release to fix (1-2 week store review cycle per fix).

2. **YouTube SPA navigation** — Chrome does not re-inject content scripts on SPA navigation. Must listen for `yt-navigate-finish` DOM event and re-inject UI on each video change, with duplicate injection cleanup. Failure means extension only works on first page load.

3. **Service worker termination** — MV3 service workers die after 30 seconds of idle, wiping all module-level state. Persist any cross-request state to `chrome.storage.local`. Register all event listeners synchronously at the top level of the service worker file — not inside callbacks.

4. **Gemini rate limits** — Free tier is approximately 20 RPD as of January 2026 (down 92% from prior year). Cache summaries by `videoId` in the Neon DB before any public launch. Upgrade to paid tier before launch. Free tier exhausts in minutes with real users.

5. **Chrome Web Store review** — Review takes 1-4 weeks for new extensions. Overly broad permissions (e.g., `<all_urls>`) cause rejection. Start store listing preparation (privacy policy, description, demo video) during Phase 3 development, not after it finishes.

---

## Implications for Roadmap

Based on combined research, the natural build order follows the dependency chain: backend proxy first (standalone testable), then extension scaffold, then background service worker, then content script injection, then full panel UI, then AI summary as an additive layer. Publishing is a distinct final phase due to Chrome Web Store lead time.

### Phase 1: Extension Foundation

**Rationale:** The message-passing architecture, YouTube SPA navigation handling, and session detection must be correct before any user-facing UI is built. Retrofitting these foundational patterns after UI exists is high-cost rework. All 6 critical Phase 1 pitfalls (CORS, SPA nav, service worker state, remote code ban, auth session, DOM selector brittleness) are architectural — they must be established upfront.

**Delivers:** Working extension scaffold with no errors, placeholder button injected on YouTube video pages surviving multiple navigations, correct session detection from transcriptgrab.com, message-passing routing proven end-to-end.

**Addresses:** Extension infrastructure, auth detection, YouTube DOM injection with fallback selectors

**Must avoid:** Direct content script fetches (message-passing from day one), hardcoded single DOM selector (fallback list immediately), service worker global state

**Research flag:** Standard patterns, well-documented in official Chrome extension docs. No additional research needed.

### Phase 2: Transcript Panel + Backend Proxy

**Rationale:** The Gemini proxy route is the only new backend code — creating it first enables curl-testing before extension UI exists. The transcript panel is the core user-facing deliverable and a hard prerequisite for AI summary.

**Delivers:** `POST /api/summarize` route on Vercel (curl-testable independently), full Shadow DOM transcript panel on YouTube pages with transcript text, timestamps, copy to clipboard, format toggle, language selector, loading states, and error handling.

**Uses:** Shadow DOM injection pattern, message-passing to existing `/api/transcript` route, `@google/genai` SDK installed in Next.js root

**Must avoid:** Exposing `GEMINI_API_KEY` in extension bundle (all Gemini calls are server-side only), YouTube CSS bleed-through (Shadow DOM isolates styles)

**Research flag:** Standard patterns for Shadow DOM and transcript display. The Gemini proxy route is straightforward. No additional research needed.

### Phase 3: AI Summary + Auto-Save

**Rationale:** Summary is additive on top of the working transcript panel. Auto-save depends on auth detection established in Phase 1. Both features require the panel from Phase 2 to exist first.

**Delivers:** "Summarize" button in transcript panel, Gemini summary displayed as bullet points or paragraph (user-toggled), auto-save confirmation when signed in, sign-in prompt for unauthenticated users, summary caching by `videoId` in DB.

**Uses:** `gemini-2.5-flash` model, `/api/summarize` proxy, existing `/api/auth/session` endpoint, Drizzle schema addition for `summary` column on transcripts table

**Must avoid:** Missing Gemini safety filter handling (`finishReason: 'SAFETY'`), missing 429 rate limit handling, no caching (exhausts free tier immediately), auto-opening summary panel on every video load (must be user-triggered)

**Research flag:** Gemini safety filter behavior needs validation testing against diverse video categories (news, politics, medical, gaming) before shipping. Build error handling before the happy path.

### Phase 4: Chrome Web Store Publishing

**Rationale:** Publishing is a distinct phase because Chrome Web Store review takes 1-4 weeks and has independent requirements (privacy policy, store description, demo video, permission justification) that can be prepared in parallel with Phase 3 final development.

**Delivers:** Extension published on Chrome Web Store, store listing with privacy policy at stable URL, all permissions justified in listing, production environment variables set (`GEMINI_API_KEY` on Vercel).

**Must avoid:** `<all_urls>` wildcard permissions (instant rejection), missing privacy policy URL, submitting without a demo video, launching with free-tier Gemini only (upgrade to paid before launch)

**Research flag:** Chrome Web Store review policies are documented in official Chrome docs and fully covered by PITFALLS.md. Permission audit checklist is actionable as-is. No additional research needed.

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** Message-passing architecture and SPA navigation must be proven correct before building the panel. Wrong call here requires full rework of everything downstream.
- **Backend proxy early in Phase 2:** The `/api/summarize` route can be curl-tested independently before the extension UI exists, enabling parallel progress and de-risking Gemini integration early.
- **Phase 3 after Phase 2:** AI summary tab is additive to the panel. Auth detection is already working from Phase 1.
- **Phase 4 as distinct phase:** 3+ week Chrome Web Store lead time means publishing cannot be deferred to the last day. Store listing work starts during Phase 3.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3:** Gemini safety filter behavior needs hands-on testing against diverse content categories before shipping. PITFALLS.md documents which categories to test but not the optimal `safetySettings` configuration for a transcript summarization prompt specifically.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Chrome MV3 extension architecture is thoroughly documented. WXT handles framework complexity. Message-passing and storage patterns are well-established in official docs.
- **Phase 2:** Shadow DOM injection, transcript panel UI, and the Gemini proxy route all follow standard patterns documented in ARCHITECTURE.md.
- **Phase 4:** Chrome Web Store publishing requirements are fully documented in official Chrome docs and PITFALLS.md checklist.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | WXT, `@google/genai`, and `gemini-2.5-flash` all verified against official docs and release dates. One low-confidence note: `gemini-3-flash-preview` appears in Google docs quickstart as a possible future alias — use `gemini-2.5-flash` until a new stable GA model is confirmed. |
| Features | MEDIUM-HIGH | Competitor feature landscape from multiple independent 2026 sources. Official Chrome Summarizer API docs confirm AI summary UX patterns. Auth detection pattern sourced from next-auth community discussion (MEDIUM — community-validated but not official docs). |
| Architecture | HIGH | MV3 architecture documented from official Chrome extension docs. Message-passing, Shadow DOM, and service worker patterns are well-established. CORS behavior of content scripts vs background SW confirmed by official Chromium security documentation. |
| Pitfalls | HIGH | All pitfalls sourced from official Chrome docs, official Gemini rate limit docs, or Chrome Web Store review policy docs. Gemini rate limit reduction (December 2025) confirmed by multiple independent sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **Gemini safety filter configuration:** The optimal `safetySettings` values for a transcript summarization prompt are not documented with specificity. Test against news, politics, medical, and gaming video categories during Phase 3 development. Build the error path before the success path.
- **`yt-navigate-finish` stability:** YouTube's custom DOM event is the recommended navigation signal but could be renamed in a future YouTube update. The MutationObserver fallback mitigates this. Document the current event name in CLAUDE.md and flag it as something to monitor.
- **CORS for `/api/auth/session`:** Background SW fetches to `host_permissions` domains bypass CORS, but verify this in practice for the session endpoint. Fallback if needed: add `chrome-extension://` to the CORS allowlist in Next.js config using an environment variable for the extension ID.
- **Gemini model ID at implementation time:** `gemini-2.5-flash` is production-stable as of February 2026. Confirm the model ID is unchanged when beginning Phase 2 implementation.

---

## Sources

### Primary (HIGH confidence — official documentation)
- [WXT Official Documentation](https://wxt.dev/) — Framework overview, content scripts, Shadow Root pattern, HMR
- [WXT GitHub Releases](https://github.com/wxt-dev/wxt/releases) — v0.20.17 latest stable, February 12, 2026
- [Google Gemini API Libraries](https://ai.google.dev/gemini-api/docs/libraries) — `@google/genai` GA, deprecation of legacy SDK confirmed
- [Chrome MV3 Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — Content script isolation, CORS behavior
- [chrome.cookies API](https://developer.chrome.com/docs/extensions/reference/api/cookies) — Cookie permissions, host_permissions requirement
- [Chrome Web Store Review Process](https://developer.chrome.com/docs/webstore/review-process/) — Review timeline, policy requirements
- [Gemini API Rate Limits (Official)](https://ai.google.dev/gemini-api/docs/rate-limits) — Free tier limits post-December 2025
- [Gemini API Safety Settings](https://ai.google.dev/gemini-api/docs/safety-settings) — Safety filter configuration

### Secondary (MEDIUM confidence — community consensus)
- [2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/) — WXT vs Plasmo vs CRXJS analysis
- [WXT + Tailwind v4 GitHub Issue #1460](https://github.com/wxt-dev/wxt/issues/1460) — Vite plugin path confirmed, PostCSS path broken
- [Sharing next-auth authentication with a Chrome extension](https://github.com/nextauthjs/next-auth/discussions/6021) — Session detection via `/api/auth/session` endpoint
- [Making Chrome Extension Smart for SPA Websites](https://medium.com/@softvar/making-chrome-extension-smart-by-supporting-spa-websites-1f76593637e8) — YouTube SPA navigation patterns
- [TubeOnAI: 8 Best YouTube Transcript Chrome Extensions (2026)](https://tubeonai.com/youtube-video-transcription-chrome-extensions/) — Competitor feature landscape
- [Gemini API Rate Limits Complete Guide 2026](https://blog.laozhang.ai/en/posts/gemini-api-rate-limits-guide) — December 2025 free tier reduction independently confirmed

### Tertiary (LOW confidence — single source or inference)
- Gemini model naming: `gemini-3-flash-preview` appears in Google quickstart docs but may be a future preview alias — use `gemini-2.5-flash` for production until independently confirmed stable

---

*Research completed: 2026-02-18*
*Ready for roadmap: yes*
