# Stack Research

**Domain:** Chrome Extension (Manifest V3) + AI Summaries for YouTube Transcript Tool
**Researched:** 2026-02-18
**Confidence:** HIGH

---

> **Note:** This file covers NEW additions for the Chrome extension + Gemini milestone only.
> Existing stack (Next.js 16, Auth.js v5, Drizzle ORM, Neon Postgres, InnerTube + Supadata) is validated and unchanged.

---

## Recommended Stack — New Additions Only

### Extension Build Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| WXT | `^0.20.17` | Chrome extension build framework | The consensus-leading framework as of 2026. Built on Vite, offers HMR for content scripts, auto-imports, TypeScript-first, Shadow Root UI helpers, React module support. Actively maintained (216 contributors, released Feb 12, 2026). Framework-agnostic — works with React 19 and Tailwind v4 via Vite plugin. |
| `@wxt-dev/module-react` | latest | React integration for WXT | Official WXT module for React support in popup, options page, and content script UIs. Required to use React components in extension entry points. |

### AI / Gemini SDK

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@google/genai` | `^1.41.0` | Google Gemini API SDK | Google's officially maintained SDK (GA since May 2025). Replaces the legacy `@google/generative-ai` (deprecated). Supports Gemini 2.5 Flash — the current best price-performance model for summarization tasks. Supports streaming, structured outputs, and function calling. Node 18+ required. |

### Supporting Libraries — Extension

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tailwindcss/vite` | `^4.0.0` | Tailwind CSS v4 in WXT via Vite plugin | Required for Tailwind v4 in WXT — the PostCSS path does not work with WXT. Use the Vite plugin path instead. Known limitation: minor border rendering issues inside shadow roots, which does not block functionality. |
| `webextension-polyfill` | `^0.10.0` | Cross-browser extension API polyfill | Wraps `chrome.*` API in Promise-based `browser.*` API. WXT bundles `@wxt-dev/browser` which provides typed wrappers, but explicit polyfill needed if you want the same code to run in Firefox without changes. Optional for Chrome-only. |

### Development Tools — Extension

| Tool | Purpose | Notes |
|------|---------|-------|
| WXT DevServer | HMR for extension during development | Run `wxt dev` — automatically reloads extension on file change, including content scripts |
| WXT CLI zip | Production zip for Chrome Web Store | Run `wxt zip` to produce a `.zip` ready for uploading to the Chrome Web Store |
| Chrome DevTools | Inspect service worker, content scripts | Open `chrome://extensions`, click "service worker" link to inspect background script |

---

## Gemini Model Selection

**Use: `gemini-2.5-flash`** (model ID: `gemini-2.5-flash`)

- 1M token context window — handles any YouTube transcript without chunking
- Best price-performance for high-volume text summarization (confirmed current SOTA in this category)
- Streaming support via `generateContentStream()` for progressive UI rendering
- `gemini-3-flash-preview` appears in docs but is preview-only; `gemini-2.5-flash` is production-stable

**Do NOT use:**
- `gemini-2.0-flash` — Deprecated as of early 2026
- `gemini-1.5-flash` — Superseded by 2.5 Flash, kept only for backward compat

---

## Integration Architecture with Existing App

### API Key Security Pattern

The Gemini API key MUST NOT be stored in the extension. Chrome extensions ship as readable ZIP files — any hardcoded key is fully exposed. Use the existing Next.js backend as a proxy:

```
Extension → POST /api/summarize (with session cookie) → Next.js → Gemini API → response
```

This means:
1. Add `GEMINI_API_KEY` as an environment variable to Vercel (not the extension)
2. Add a `POST /api/summarize` route to the existing Next.js app
3. Extension calls this route, authenticated via the existing Auth.js session cookie
4. Server calls Gemini with the API key from `process.env`

### Auth Session Detection Pattern

The extension detects whether the user is logged into the web app via cookie reading. Auth.js v5 stores the session in an HttpOnly JWT cookie (default name: `authjs.session-token`). The extension background service worker can read this using the `cookies` permission:

```json
// manifest.json permissions
"permissions": ["cookies", "storage"],
"host_permissions": ["https://transcriptgrab.vercel.app/*"]
```

The extension background worker calls `chrome.cookies.get({ url, name })` to check for the session cookie. If found, the user is considered logged in. If not, redirect to the web app login page.

**Critical caveat:** Auth.js sets cookies as `HttpOnly` by default, which means content scripts cannot read `document.cookie`. Only the background service worker (via `chrome.cookies`) can read HttpOnly cookies. This requires the `cookies` permission in the manifest.

### Extension Project Location

Place the extension as a subdirectory of the existing monorepo rather than a separate repo:

```
transcriptgrab/           ← existing Next.js project root
├── app/
├── lib/
├── components/
├── extension/            ← NEW: WXT project lives here
│   ├── wxt.config.ts
│   ├── entrypoints/
│   │   ├── background.ts
│   │   ├── content.ts
│   │   └── popup/
│   └── package.json      ← separate package.json for extension deps
├── package.json          ← Next.js app package.json (unchanged)
└── CLAUDE.md
```

This is the simplest structure. The extension has its own `package.json` and `node_modules`. Run WXT from the `extension/` subdirectory with `cd extension && wxt dev`. No monorepo tooling (Turborepo) needed unless shared UI components become a priority.

---

## Installation

```bash
# From the extension/ subdirectory
cd extension

# Initialize WXT project
npx wxt@latest init .

# React module
npm install @wxt-dev/module-react

# Gemini SDK (install in Next.js root — calls happen server-side)
cd ..
npm install @google/genai

# Tailwind v4 in extension (Vite plugin approach)
cd extension
npm install tailwindcss @tailwindcss/vite
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| WXT | CRXJS (`@crxjs/vite-plugin`) | Only if you need absolute minimal abstraction and are willing to accept maintenance uncertainty. CRXJS released 2.3.0 in Dec 2025 after a long gap, but long-term commitment is unclear. |
| WXT | Plasmo | Never for new projects in 2026. Plasmo has stalled — poor MV3 support, inactive GitHub issues, no active releases. Community consensus is to avoid it. |
| WXT | Webpack boilerplate (manual) | Only if your team already has deep Webpack expertise and zero tolerance for framework opinions. Manual setup adds weeks with no DX benefit. |
| `@google/genai` | `@ai-sdk/google` (Vercel AI SDK) | If you already use Vercel AI SDK in the Next.js app for streaming responses. The AI SDK's `streamText()` with Google provider is a clean integration. Either works — `@google/genai` is more direct with fewer abstractions. |
| `@google/genai` | `@google/generative-ai` | Never — this package is the legacy SDK. Google explicitly marks it deprecated in favor of `@google/genai`. |
| Backend proxy for Gemini | Calling Gemini from extension directly | Never — API keys cannot be safely stored in a browser extension. Any key embedded in extension code is publicly readable by inspecting the extension ZIP. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@google/generative-ai` | Legacy/deprecated SDK, no longer actively maintained | `@google/genai` (v1.41.0+) |
| `gemini-2.0-flash` | Deprecated in 2026 | `gemini-2.5-flash` |
| Manifest V2 | Chrome has sunset MV2 enforcement and will remove support | Manifest V3 only |
| Storing Gemini API key in extension | Extension source is readable; key would be fully exposed | Proxy all Gemini calls through Next.js API route |
| PostCSS for Tailwind v4 in WXT | Does not work — WXT's Vite pipeline conflicts with Tailwind v4 PostCSS plugin | Use `@tailwindcss/vite` Vite plugin instead |
| `document.cookie` for session detection | Auth.js HttpOnly cookies are not accessible to content scripts | Use background service worker with `chrome.cookies` API |
| Plasmo | Abandoned by maintainers, broken MV3 support | WXT |

---

## MV3 Key Constraints

These Manifest V3 constraints directly affect architecture decisions:

| Constraint | Impact | Solution |
|------------|--------|---------|
| Service worker replaces background page | Worker terminates when idle (30s timeout). Cannot hold persistent state in memory. | Use `chrome.storage.local` for any state the service worker needs to persist |
| No remote code execution | Cannot load scripts from CDN at runtime | All code must be bundled at build time |
| Fetch in service worker only | Content scripts cannot use `chrome.cookies` API directly | Message passing from content script → background service worker → API calls |
| `externally_connectable` for web app | Extension and web app can communicate via `chrome.runtime.sendMessage` only if declared | Declare `externally_connectable.matches` with the web app domain in manifest |

---

## Message Passing Pattern (Extension ↔ Web App)

```typescript
// manifest.json
{
  "externally_connectable": {
    "matches": ["https://transcriptgrab.vercel.app/*"]
  }
}
```

This lets the TranscriptGrab web app trigger the extension from its own pages (e.g., "Open in Extension" button) and lets the extension communicate with the web app's domain. Without this, communication is one-way only (extension to external URLs via fetch).

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| WXT `^0.20.17` | React 19 | React 19 supported via `@wxt-dev/module-react` |
| WXT `^0.20.17` | Tailwind v4 via `@tailwindcss/vite` | PostCSS path broken; Vite plugin path works with minor shadow root CSS caveats |
| `@google/genai` `^1.41.0` | Node.js 18+ | Cannot run in browser context directly (use via Next.js API route) |
| `@google/genai` `^1.41.0` | Next.js 16 App Router | Works in route handlers and server actions |
| Auth.js v5 session cookies | `chrome.cookies` API (background SW only) | Requires `cookies` permission + `host_permissions` for the web app domain |

---

## Environment Variables — New Additions

```bash
# Add to Vercel environment variables (NOT to extension)
GEMINI_API_KEY=<from Google AI Studio>

# Already exists — no change needed for extension auth detection
# Auth.js session cookie is at transcriptgrab.vercel.app (existing domain)
```

---

## Sources

### High Confidence (Official Docs Verified)
- [WXT Official Documentation](https://wxt.dev/) — Framework overview, content script UI, Shadow Root pattern
- [WXT Content Scripts Guide](https://wxt.dev/guide/essentials/content-scripts.html) — UI injection methods (Integrated, Shadow Root, IFrame)
- [WXT GitHub Releases](https://github.com/wxt-dev/wxt/releases) — v0.20.17 latest stable, Feb 12, 2026
- [Google Gemini API Libraries](https://ai.google.dev/gemini-api/docs/libraries) — `@google/genai` confirmed GA, replaces legacy SDK
- [Google Gemini API Quickstart](https://ai.google.dev/gemini-api/docs/quickstart) — `@google/genai` usage pattern
- [Chrome `externally_connectable`](https://developer.chrome.com/extensions/manifest/externally_connectable) — Web app ↔ extension communication

### Medium Confidence (Web Search + Multiple Sources Agree)
- [@google/genai npm](https://www.npmjs.com/package/@google/genai) — v1.41.0 latest, published Feb 2026
- [2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/) — WXT recommended over Plasmo and CRXJS
- [WXT + Tailwind v4 GitHub Issue #1460](https://github.com/wxt-dev/wxt/issues/1460) — Closed: Vite plugin path works, PostCSS path does not
- [NextAuth Chrome extension discussion](https://github.com/nextauthjs/next-auth/discussions/6021) — Session cookie reading patterns, `sameSite` requirements
- [Gemini 2.5 Flash on OpenRouter](https://openrouter.ai/google/gemini-2.5-flash) — 1M token context window confirmed

### Low Confidence (Single Source, Not Independently Verified)
- Gemini model naming: "gemini-3-flash-preview" appearing in docs quickstart — may be a preview alias; use `gemini-2.5-flash` for production until stable GA model confirmed

---
*Stack research for: TranscriptGrab Chrome Extension + Gemini AI Summaries milestone*
*Researched: 2026-02-18*
