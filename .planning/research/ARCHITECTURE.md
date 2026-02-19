# Architecture Research

**Domain:** Chrome Manifest V3 extension + AI summaries integration with existing Next.js app
**Researched:** 2026-02-18
**Confidence:** HIGH

## System Overview

This milestone adds a Chrome extension that integrates with the existing TranscriptGrab web app. The extension injects UI into YouTube pages, uses the existing backend API, detects the user's session from the web app's cookies, and calls Gemini for AI summaries through a new backend proxy route.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Chrome Extension Layer                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐   ┌──────────────────┐   ┌─────────────────────────┐  │
│  │  Content Script  │   │  Background SW   │   │  Extension Popup        │  │
│  │  (youtube.com)   │   │  (service worker)│   │  (optional settings UI) │  │
│  │  - Inject button │   │  - Fetch proxy   │   │  - Auth status display  │  │
│  │  - Inject panel  │   │  - Cookie check  │   │  - Quick link to webapp │  │
│  │  - DOM observe   │   │  - Message relay │   │                         │  │
│  └────────┬─────────┘   └────────┬─────────┘   └─────────────────────────┘  │
│           │  chrome.runtime.sendMessage  │                                    │
│           └──────────────────────────────┘                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                        Existing Next.js Web App (Vercel)                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐ │
│  │ /api/         │  │ /api/         │  │ /api/         │  │ /api/auth/    │ │
│  │ transcript    │  │ metadata      │  │ summarize     │  │ [...nextauth] │ │
│  │ (CORS-open)   │  │ (CORS-open)   │  │ (NEW, CORS)   │  │               │ │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘ │
│          │                  │                  │                   │          │
├──────────┴──────────────────┴──────────────────┴───────────────────┴──────────┤
│                        Business Logic + Data Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ lib/youtube  │  │ lib/format   │  │ lib/db       │  │ Gemini API       │ │
│  │ (unchanged)  │  │ (unchanged)  │  │ (Drizzle)    │  │ (server-side key)│ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Extension Architecture: Three-Part Structure

Every MV3 extension has three distinct execution environments that cannot directly access each other's DOM or state:

| Component | Where It Runs | What It Can Do | Limitations |
|-----------|--------------|----------------|-------------|
| **Content Script** | YouTube page context | Read/modify YouTube DOM, inject UI elements | Cannot access chrome.cookies; has isolated JS scope; fetch calls go to its own domain (CORS applies) |
| **Background Service Worker** | Browser background | Access chrome.cookies, chrome.storage, make cross-origin fetches, relay messages | No DOM access; ephemeral (terminates after idle); no persistent state |
| **Popup / Options** | Extension popup window | Show settings/status UI | Fresh page load each open; use chrome.storage for state |

**Communication pattern:** Content script sends messages to background service worker via `chrome.runtime.sendMessage()`. Background worker performs privileged operations and returns results.

## Component Responsibilities

| Component | Responsibility | Key APIs |
|-----------|---------------|----------|
| **Content Script** | Detect YouTube video page, inject button into player controls, inject transcript panel above description, listen for SPA navigation, relay fetch requests to background | `MutationObserver`, `chrome.runtime.sendMessage`, DOM manipulation |
| **Background Service Worker** | Proxy API calls to TranscriptGrab backend with credentials, check session status via cookie API, store session state in chrome.storage, handle tab messages | `chrome.cookies`, `chrome.storage.local`, `chrome.runtime.onMessage`, `fetch` with credentials |
| **manifest.json** | Declare permissions, host_permissions, content_scripts match patterns, service worker entry | Static config — no code |

## Recommended Project Structure

```
extension/                           # Separate directory at repo root (or sibling repo)
├── manifest.json                    # MV3 manifest
├── src/
│   ├── content/
│   │   ├── index.ts                 # Content script entry — YouTube injection
│   │   ├── inject-button.ts         # Button injection into player controls
│   │   ├── inject-panel.ts          # Transcript panel injection
│   │   ├── navigation-observer.ts   # YouTube SPA navigation detection
│   │   └── styles.css               # Isolated panel styles (shadow DOM)
│   ├── background/
│   │   ├── service-worker.ts        # SW entry — message handler
│   │   ├── api-client.ts            # Fetches to TranscriptGrab API with credentials
│   │   └── session.ts               # Cookie-based session detection
│   ├── popup/
│   │   ├── popup.html               # Extension popup page
│   │   └── popup.ts                 # Popup logic (show auth status, settings)
│   └── shared/
│       └── types.ts                 # Message types, shared interfaces
├── public/
│   └── icons/                       # Extension icons (16, 48, 128px)
├── package.json                     # WXT project config
└── wxt.config.ts                    # WXT configuration
```

**Web App additions (in existing Next.js project):**
```
app/api/
└── summarize/
    └── route.ts                     # NEW: Gemini proxy (auth-optional or auth-required)
```

### Structure Rationale

- **extension/ at repo root:** Extension is a distinct build artifact; shares no build pipeline with Next.js; keeping it in the same repo enables shared type definitions if needed
- **content/ subdirectory:** Split content script logic into focused files — injection, panel, SPA observer — to keep each file testable and under 200 lines
- **background/session.ts:** Session logic isolated from API client; background worker checks cookie, stores result in chrome.storage, content script reads from storage
- **WXT framework:** Use WXT over vanilla manifest + bundler. WXT provides HMR during development, Vite bundling, auto-imports, and proper TypeScript support. Plasmo is in maintenance mode as of 2025. CRXJS has limited activity. WXT is the current community standard.

## Architectural Patterns

### Pattern 1: Message-Passing for Privileged Operations

**What:** Content scripts delegate any operation requiring elevated permissions (cookie access, cross-origin fetches with credentials) to the background service worker via `chrome.runtime.sendMessage()`.

**When to use:** Any time the content script needs to call the TranscriptGrab API, check session status, or access chrome.cookies.

**Trade-offs:**
- Adds async message-passing overhead (negligible for this use case)
- Keeps content script sandboxed — cannot be used to exfiltrate cookies by injected page scripts
- Background service worker can be inspected separately in DevTools

**Example:**
```typescript
// content/index.ts
async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
  return chrome.runtime.sendMessage({
    type: 'FETCH_TRANSCRIPT',
    payload: { videoId, languageCode: 'en' },
  });
}

// background/service-worker.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_TRANSCRIPT') {
    handleFetchTranscript(message.payload).then(sendResponse);
    return true; // Required: keeps message channel open for async response
  }
});

async function handleFetchTranscript({ videoId, languageCode }: { videoId: string; languageCode: string }) {
  const response = await fetch('https://transcriptgrab.com/api/transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Sends auth cookies automatically (host_permissions required)
    body: JSON.stringify({ url: `https://youtu.be/${videoId}`, languageCode }),
  });
  return response.json();
}
```

### Pattern 2: Shadow DOM for UI Injection

**What:** Inject extension UI elements using Shadow DOM to prevent YouTube's CSS from bleeding into the extension's panel and vice versa.

**When to use:** All injected UI — transcript panel, button overlay. Not needed for elements appended to YouTube's own control bar using their native classes.

**Trade-offs:**
- Complete CSS isolation — YouTube's aggressive style overrides cannot affect extension panel
- Shadow DOM elements are not accessible to page's own JavaScript (intentional)
- Slightly more complex DOM setup than a bare `div`
- Custom styles must be injected into the shadow root, not the page `<head>`

**Example:**
```typescript
// content/inject-panel.ts
export function injectTranscriptPanel(anchorEl: Element): ShadowRoot {
  const host = document.createElement('div');
  host.id = 'transcriptgrab-panel-host';

  const shadow = host.attachShadow({ mode: 'closed' }); // 'closed' prevents page JS access

  // Inject styles directly into shadow root
  const style = document.createElement('style');
  style.textContent = `
    :host { display: block; ... }
    .panel { background: #0f0f0f; ... }
  `;
  shadow.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'panel';
  shadow.appendChild(panel);

  anchorEl.insertAdjacentElement('afterend', host);
  return shadow;
}
```

### Pattern 3: YouTube SPA Navigation Detection

**What:** YouTube is a Single Page Application. The content script only runs on initial page load. Navigation between videos updates the URL via the History API without reloading the page, so the content script must actively observe navigation to re-inject UI on each new video.

**When to use:** Any content script targeting YouTube (or any SPA).

**Trade-offs:**
- MutationObserver approach watches DOM; more resilient but more events to filter
- `youtube-navigate-finish` custom event is YouTube-specific and may break with YouTube updates
- `chrome.webNavigation.onHistoryStateUpdated` (in background SW) is the most reliable — fires on every SPA navigation and provides tabId + new URL

**Recommended approach:** Listen to `yt-navigate-finish` in the content script as the primary signal (YouTube fires this custom DOM event reliably), with a `MutationObserver` fallback watching for `#secondary` or `#description` to appear.

**Example:**
```typescript
// content/navigation-observer.ts
export function observeNavigation(onVideoChange: (videoId: string) => void) {
  // Primary: YouTube fires this custom event on each navigation
  document.addEventListener('yt-navigate-finish', () => {
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (videoId) onVideoChange(videoId);
  });

  // Fallback: MutationObserver watches for description element
  // which appears after YouTube renders a new video page
  const observer = new MutationObserver(() => {
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (videoId && document.querySelector('#description')) {
      observer.disconnect();
      onVideoChange(videoId);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
```

### Pattern 4: Cookie-Based Session Detection

**What:** The extension detects whether the user is signed into TranscriptGrab by reading the Auth.js session cookie from the web app domain. Auth.js v5 with JWT strategy sets `__Secure-authjs.session-token` (in production) or `authjs.session-token` (in development) as an httpOnly cookie.

**When to use:** Before showing save-to-history UI; before making authenticated API calls.

**Critical constraint:** The session cookie is httpOnly, so it cannot be read by JavaScript via `document.cookie`. However, the Chrome extensions `chrome.cookies` API CAN read httpOnly cookies, as it is a browser-level API, not a JS API. The extension must declare the `cookies` permission and `host_permissions` for the web app domain.

**Alternative approach (simpler):** Instead of reading the cookie directly, make a credentialed GET request from the background SW to `/api/auth/session`. Auth.js returns `{}` if not authenticated, or `{ user: {...} }` if authenticated. This avoids interpreting encrypted cookie values.

**Recommended:** Use the `/api/auth/session` endpoint approach. The cookie value is encrypted JWT — the extension cannot decode it without the `AUTH_SECRET`. The session endpoint decodes it server-side and returns structured data.

**Example:**
```typescript
// background/session.ts
export async function checkSession(): Promise<{ userId: string; email: string } | null> {
  try {
    const response = await fetch('https://transcriptgrab.com/api/auth/session', {
      credentials: 'include', // Sends the authjs.session-token cookie
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (data?.user?.id) {
      await chrome.storage.local.set({ session: data.user });
      return data.user;
    }
  } catch {
    // Network error or not signed in
  }
  await chrome.storage.local.remove('session');
  return null;
}
```

**CORS requirement:** The Next.js `/api/auth/session` endpoint must allow `chrome-extension://` origins for this to work. See Integration Points below.

## Data Flow

### Flow 1: User on YouTube, Clicks "Get Transcript"

```
[User on youtube.com/watch?v=XYZ]
    ↓
[Content Script: navigation-observer detects video page]
    ↓
[Content Script: inject-button.ts injects button into #movie_player .ytp-right-controls]
[Content Script: checks chrome.storage.local for cached session]
    ↓
[User clicks button]
    ↓
[Content Script → Background SW: sendMessage({ type: 'FETCH_TRANSCRIPT', videoId: 'XYZ' })]
    ↓
[Background SW: fetch POST https://transcriptgrab.com/api/transcript, credentials: 'include']
    ↓
[TranscriptGrab API: fetches via InnerTube/Supadata, saves to DB if user authenticated]
    ↓
[Background SW → Content Script: sendResponse(transcriptData)]
    ↓
[Content Script: inject-panel.ts renders transcript in Shadow DOM panel above description]
```

### Flow 2: AI Summary Request

```
[User clicks "Summarize" in injected panel]
    ↓
[Content Script → Background SW: sendMessage({ type: 'SUMMARIZE', segments: [...] })]
    ↓
[Background SW: fetch POST https://transcriptgrab.com/api/summarize, credentials: 'include']
    ↓
[/api/summarize: calls Gemini API with GEMINI_API_KEY (server-side env var), returns summary]
    ↓
[Background SW → Content Script: sendResponse({ summary: '...' })]
    ↓
[Content Script: renders summary in panel]
```

### Flow 3: Auth Detection on Extension Load

```
[Extension installed / browser starts]
    ↓
[Background SW: checkSession() → GET https://transcriptgrab.com/api/auth/session, credentials: include]
    ↓
[Auth.js reads httpOnly cookie, decodes JWT, returns session JSON or {}]
    ↓
[Background SW: stores { userId, email } in chrome.storage.local]
    ↓
[Content Script (on YouTube): reads chrome.storage.local to show/hide "Save" UI]
```

## Gemini API Integration: Backend Proxy (Required)

**Decision: Gemini API calls must go through the Next.js backend, never directly from the extension.**

Rationale:
- Exposing `GEMINI_API_KEY` in extension code is a critical security vulnerability — extension source is fully inspectable
- Chrome Web Store review may flag extensions with API keys in source
- Backend proxy enables rate limiting per user, usage tracking, and key rotation
- The backend proxy adds ~50-100ms latency which is acceptable for summarization (non-streaming use case)

**New route to create:** `app/api/summarize/route.ts`

```typescript
// app/api/summarize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(request: NextRequest) {
  const { segments, videoTitle } = await request.json();

  // Optional: check auth if summary is a premium feature
  // const session = await auth();

  const plainText = segments.map((s: { text: string }) => s.text).join(' ');

  const result = await ai.models.generateContent({
    model: 'gemini-2.0-flash-lite', // Best price/speed for summarization
    contents: [
      {
        role: 'user',
        parts: [{ text: `Summarize this YouTube video transcript concisely in 3-5 bullet points.\n\nTitle: ${videoTitle}\n\nTranscript:\n${plainText}` }],
      },
    ],
  });

  return NextResponse.json({ summary: result.text });
}
```

**Model choice:** `gemini-2.0-flash-lite` — optimized for speed and cost on text summarization tasks. Free tier: 15 RPM, 1,000 RPD. Sufficient for early usage.

**Package:** `@google/genai` (the new unified SDK, replacing `@google/generative-ai`).

## CORS Configuration for Extension Access

The existing API routes are same-origin only. The extension must be added as an allowed origin.

**Problem:** The extension's origin is `chrome-extension://<EXTENSION_ID>/`. The ID is different in development (unpacked) vs production (Chrome Web Store).

**Solution:** Add CORS headers to the API routes the extension calls (`/api/transcript`, `/api/metadata`, `/api/summarize`, `/api/auth/session`). Use an environment variable for allowed extension IDs.

```typescript
// middleware.ts (or per-route)
const ALLOWED_ORIGINS = [
  'https://transcriptgrab.com',
  process.env.EXTENSION_ORIGIN_DEV,    // chrome-extension://dev-id/
  process.env.EXTENSION_ORIGIN_PROD,   // chrome-extension://prod-id/
].filter(Boolean);

function getCorsHeaders(origin: string | null) {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }
  return {};
}
```

**Note on credentials:** `Access-Control-Allow-Credentials: true` requires `Access-Control-Allow-Origin` to be a specific origin (not `*`). This is why per-request origin checking is necessary.

**Alternative (simpler for development):** Background service worker fetches bypass CORS entirely when the target domain is in `host_permissions`. Fetches from the background SW to listed host_permissions domains do not go through CORS preflight. This means CORS config is only needed for content script fetches (which should be proxied to background SW anyway).

**Revised recommendation:** Route ALL API calls from the extension through the background service worker (not content scripts directly). Background SW fetches to `host_permissions` domains bypass CORS. This eliminates the need to modify CORS headers on the existing API routes. Only the `/api/auth/session` check needs CORS awareness since it uses `credentials: include`.

## manifest.json Configuration

```json
{
  "manifest_version": 3,
  "name": "TranscriptGrab",
  "version": "2.0.0",
  "description": "Get YouTube transcripts instantly, powered by TranscriptGrab",
  "permissions": [
    "storage",
    "cookies"
  ],
  "host_permissions": [
    "https://www.youtube.com/*",
    "https://transcriptgrab.com/*",
    "http://localhost:3000/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/watch*"],
      "js": ["content/index.js"],
      "css": ["content/styles.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

**Key decisions:**
- `document_idle` for content script: YouTube's player controls exist in DOM by idle state
- No `webNavigation` permission: Use `yt-navigate-finish` DOM event inside content script instead (avoids needing background tab tracking)
- `cookies` permission: Required for `chrome.cookies` API if using direct cookie reads (not needed if using the session endpoint approach)
- `host_permissions` for `transcriptgrab.com`: Enables credentialed fetches from background SW without CORS issues

## YouTube DOM Injection Points

YouTube's DOM structure for injection targets (as of 2026 — verify these selectors before building):

| UI Element | Insertion Target | Method |
|------------|-----------------|--------|
| **Transcript button** | `.ytp-right-controls` inside `#movie_player` | `insertBefore()` with a custom button styled to match YT controls |
| **Transcript panel** | `#secondary` (right column) or above `#description` | `prepend()` inside `#secondary` or `insertAdjacentElement('beforebegin', descriptionEl)` |
| **Loading indicator** | Inside the injected panel's Shadow DOM | Internal to panel component |

**YouTube SPA reality:** The selectors above exist after `yt-navigate-finish` fires. Do NOT try to inject before this event. On initial page load, use `document_idle` + wait for `#movie_player` to be present via `MutationObserver`.

## Component Build Order

Build in this order to minimize dependency blockers:

### Step 1: Backend Gemini Proxy (1-2 days)
Create `/api/summarize/route.ts` in the existing Next.js app. Test with curl. Confirm `gemini-2.0-flash-lite` works for transcript summarization.

**Why first:** Establishes the only new backend endpoint. Everything else in the extension calls pre-existing API routes.

### Step 2: Extension Scaffold with WXT (0.5 days)
Initialize WXT project in `extension/`. Configure `wxt.config.ts` with React + TypeScript. Set up `manifest.json` with correct permissions. Confirm extension loads in Chrome with no errors.

**Why second:** Scaffold must exist before writing content scripts or background worker.

### Step 3: Background Service Worker + Session Detection (1-2 days)
Implement `background/session.ts` (session check via `/api/auth/session`). Implement `background/api-client.ts` (proxied fetch to `/api/transcript` and `/api/summarize`). Implement `background/service-worker.ts` message handler.

**Why third:** Content script depends on this being functional for all API calls.

### Step 4: Content Script — Navigation + Button (1-2 days)
Implement `navigation-observer.ts`. Implement `inject-button.ts` — find correct YouTube DOM target, inject button, wire click to message send. Test on multiple video page navigations.

**Why fourth:** Navigation detection + button injection are prerequisites for the panel.

### Step 5: Content Script — Transcript Panel (2-3 days)
Implement `inject-panel.ts` with Shadow DOM. Build panel UI — transcript segments list, copy button, timestamps toggle. Wire up to transcript data from background SW response.

**Why fifth:** Panel is the primary user-facing feature; requires button to trigger it.

### Step 6: AI Summary UI in Panel (1 day)
Add "Summarize" button to panel. Wire to background SW `SUMMARIZE` message. Display summary in panel below transcript.

**Why last:** Purely additive feature; panel must exist first.

## Anti-Patterns

### Anti-Pattern 1: Gemini API Key in Extension Source

**What people do:** Call Gemini directly from the content script or background SW with the API key hardcoded or in environment variables bundled into the extension.

**Why it's wrong:** Extension source is fully readable. Any user who installs the extension can extract the API key from the bundle. Chrome Web Store reviewers flag this. Key rotation becomes necessary immediately.

**Do this instead:** Route all Gemini calls through `/api/summarize` on the backend. Key lives in Vercel environment variables only.

### Anti-Pattern 2: Fetching from Content Script Directly

**What people do:** Make `fetch()` calls to the TranscriptGrab API directly from the content script.

**Why it's wrong:** Content scripts run in the context of YouTube, so CORS headers for `youtube.com` apply. The TranscriptGrab API doesn't need to allow YouTube as an origin. Even with CORS configured, `credentials: include` requires specific origin (not wildcard), and YouTube pages are not in the allowed origin list.

**Do this instead:** Send a message to the background service worker, which makes the fetch. Background SW fetches to domains in `host_permissions` bypass CORS entirely.

### Anti-Pattern 3: Relying on Static YouTube Selectors

**What people do:** Hard-code `.ytp-right-controls` or `#secondary` selectors and assume they are stable.

**Why it's wrong:** YouTube frequently A/B tests UI changes. Selectors change without notice. Extensions break silently with no error message to users.

**Do this instead:** Use multiple selector fallbacks with `querySelector` chained. Log selector misses to `chrome.storage` for debugging. Add a MutationObserver timeout that shows a "Could not find player controls" message in the popup after 5 seconds if injection fails.

### Anti-Pattern 4: Storing Session Token Value

**What people do:** Read and store the raw Auth.js session cookie value (`__Secure-authjs.session-token`) in `chrome.storage.local`.

**Why it's wrong:** This is an encrypted JWT that the extension cannot decode without `AUTH_SECRET`. Storing it gives you nothing useful. The value changes on session refresh.

**Do this instead:** Store the decoded session data (userId, email, name) from the `/api/auth/session` JSON response. Re-fetch the session endpoint when the extension needs fresh auth state.

### Anti-Pattern 5: Persistent Background Page Pattern from MV2

**What people do:** Write extension background code assuming it persists forever (like MV2 background pages). Store state in module-level variables.

**Why it's wrong:** MV3 background scripts are service workers. They terminate after ~30 seconds of inactivity. All module-level state is lost. Next message wakes a fresh SW instance.

**Do this instead:** Persist any state that must survive SW termination to `chrome.storage.local`. Re-initialize from storage at the start of each message handler.

## Integration Points

### Extension → Existing API Routes (No Changes Required)

| Route | Method | Caller | Credentials | Change Needed |
|-------|--------|--------|-------------|---------------|
| `/api/transcript` | POST | Background SW | `include` (optional, saves if authed) | None — already works |
| `/api/metadata` | GET | Background SW | None required | None |

### Extension → New API Route

| Route | Method | Caller | Auth | Change Needed |
|-------|--------|--------|------|---------------|
| `/api/summarize` | POST | Background SW | Optional (or required) | Create new route |

### Extension → Auth.js Session Endpoint

| Route | Method | Caller | Note |
|-------|--------|--------|------|
| `/api/auth/session` | GET | Background SW | Works with `credentials: include`; no CORS change needed when called from background SW (host_permissions bypass) |

### New vs Modified Files

**New (Next.js web app):**
- `app/api/summarize/route.ts` — Gemini proxy endpoint

**New (Extension — separate build):**
- `extension/` — entire new directory, new build system (WXT + Vite)
- All extension files are net new; no shared code with Next.js

**Modified (Next.js web app):**
- `next.config.ts` — potentially add CORS headers if content scripts call API directly (avoided if all calls go through background SW)
- `.env` / Vercel env vars — add `GEMINI_API_KEY`

**Unchanged:**
- `lib/youtube.ts` — extension uses the API, not this lib directly
- `lib/format.ts` — extension uses the API response; may duplicate a subset of formatting locally for display
- `auth.ts`, `lib/db/` — no changes needed; extension uses the existing session endpoint

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-10k daily users** | Current architecture sufficient; Gemini free tier (1,000 RPD) handles ~1,000 summaries/day |
| **10k-100k daily users** | Move to Gemini paid tier; add per-user rate limiting on `/api/summarize`; cache summaries by `videoId` in DB to avoid duplicate Gemini calls |
| **100k+ daily users** | Gemini key rotation (like existing Supadata pattern); Redis cache for summaries; summary pre-generation for popular videos |

### First Bottleneck

Gemini free tier rate limits (15 RPM, 1,000 RPD). Hit quickly if the extension becomes popular. Mitigation: cache summaries in the `transcripts` DB table — if a video has been summarized before, return cached result instead of calling Gemini.

### Second Bottleneck

Chrome Web Store review time (typically 1-7 days for new extensions, faster for updates). Plan releases accordingly — don't expect same-day updates.

## Sources

### High Confidence (Official Documentation)

- [Chrome MV3 Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — Content script injection patterns, run_at options, DOM access
- [chrome.cookies API](https://developer.chrome.com/docs/extensions/reference/api/cookies) — Cookie reading permissions, host_permissions requirement
- [chrome.scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) — Dynamic injection patterns
- [Chrome Extensions AI](https://developer.chrome.com/docs/extensions/ai) — Native AI APIs (Prompt API, Summarizer API) as alternative to Gemini
- [chrome.webNavigation API](https://developer.chrome.com/docs/extensions/reference/api/webNavigation) — SPA navigation detection in background SW

### High Confidence (Community with Verification)

- [WXT Framework Comparison 2025](https://wxt.dev/guide/resources/compare) — WXT vs Plasmo vs CRXJS; WXT confirmed as leading maintained framework
- [2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/) — Independent analysis confirming WXT as dominant choice
- [Cookie-Based Auth for Browser Extension + Web App (MV3)](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies) — Official storage and cookies patterns

### Medium Confidence (Community Examples)

- [Sharing next-auth authentication with Chrome Extension](https://github.com/nextauthjs/next-auth/discussions/6021) — Confirmed pattern: use `/api/auth/session` endpoint rather than cookie values
- [Making Chrome Extension Smart for SPA Websites](https://medium.com/@softvar/making-chrome-extension-smart-by-supporting-spa-websites-1f76593637e8) — YouTube SPA navigation patterns using `onHistoryStateUpdated`
- [Shadow DOM for Chrome Extensions](https://railwaymen.org/blog/chrome-extensions-shadow-dom) — CSS isolation via Shadow DOM in content scripts
- [Gemini API Rate Limits 2026](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits) — Free tier limits after December 2025 reduction (15 RPM, 1,000 RPD)

---
*Architecture research for: TranscriptGrab Chrome extension + Gemini AI summaries milestone*
*Researched: 2026-02-18*
