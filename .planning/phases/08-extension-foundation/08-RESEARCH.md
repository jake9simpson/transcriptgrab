# Phase 8: Extension Foundation - Research

**Researched:** 2026-02-18
**Domain:** Chrome extension development with WXT framework, YouTube DOM injection, SPA navigation, auth detection, message-passing architecture
**Confidence:** HIGH

## Summary

Phase 8 builds a WXT-based Chrome extension that installs cleanly, injects a transcript button into YouTube's video actions row, survives YouTube's SPA navigation, detects the user's auth state from transcriptgrab.com, and establishes the message-passing architecture between content script and background service worker. The existing web app uses NextAuth v5 with JWT strategy and Google OAuth, storing sessions in httpOnly cookies.

WXT is the right tool for this job. It provides file-based entrypoints, built-in `createShadowRootUi` for CSS-isolated injection, a `wxt:locationchange` event for SPA navigation, and a `ContentScriptContext` that handles cleanup on extension invalidation. The extension will live in its own `extension/` directory at the project root (not a monorepo -- the web app and extension share no build tooling, only an API contract). The content script injects vanilla TypeScript UI into YouTube's `#top-level-buttons-computed` container, the background service worker handles all API communication and auth detection via `chrome.cookies`, and `@webext-core/messaging` provides type-safe message passing between the two.

**Primary recommendation:** Use WXT with vanilla TypeScript for the content script button (no React needed for a single button), `@webext-core/messaging` for type-safe content-script-to-background communication, and `chrome.cookies.get()` against the `authjs.session-token` cookie on transcriptgrab.com for auth detection. The popup uses simple HTML/CSS matching the web app's dark theme. Keep the extension as a standalone `extension/` directory -- no monorepo complexity.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
#### Button placement & appearance
- Button appears below the video player in the actions row (alongside Like, Share, Download)
- Styled to match YouTube's native button appearance -- pill-shaped, blends in with existing controls
- Shows "Transcript" text label with a transcript/document icon
- Adapts to YouTube's dark/light theme automatically -- detect current theme and match colors

#### Auth state indicator
- Green dot or checkmark badge on the Chrome toolbar extension icon when signed in
- Subtle gray/neutral badge on toolbar icon when NOT signed in -- hints at disconnected state
- Auth state checked on each video page navigation -- always current
- No visual auth indicator on the YouTube page button itself (badge on toolbar icon only)

#### Extension toolbar popup
- Simple status popup showing: signed-in status, version info
- Popup matches TranscriptGrab web app styling -- same dark theme, colors, typography
- Signed-out users see neutral status text ("Not connected") -- no call to action or sign-in prompt
- Signed-in users see confirmation of connected state

#### Navigation transitions
- Button persists across SPA navigation -- stays in place, state resets without remove/re-inject flicker
- Standard /watch video pages only -- no Shorts support
- Works across all player modes: default, theater, and mini-player
- Auth state rechecked on each navigation

### Claude's Discretion
- Auth detection method (cookie check vs API ping -- whatever fits the existing auth setup)
- Whether popup includes a link to open transcriptgrab.com
- How to handle waiting for YouTube's DOM to load the injection target after navigation
- Exact icon choice for the transcript button
- Shadow DOM implementation details for CSS isolation

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXT-01 | Extension installs as a Manifest V3 Chrome extension | WXT scaffolds MV3 by default; `wxt.config.ts` configures manifest; file-based entrypoints auto-generate manifest entries |
| EXT-02 | Content script injects transcript button near YouTube player controls | `createShadowRootUi` with `position: 'inline'` and `anchor` targeting `#top-level-buttons-computed`; `cssInjectionMode: 'ui'` for Shadow DOM isolation |
| EXT-03 | Extension handles YouTube SPA navigation (re-injects UI on video changes) | WXT's built-in `wxt:locationchange` event on `ContentScriptContext`; `MatchPattern` utility for URL filtering; persist-and-update pattern avoids flicker |
| EXT-04 | All API calls route through background service worker (message-passing) | `@webext-core/messaging` with typed `ProtocolMap`; background service worker handles `fetch()` with auto-included cookies via `host_permissions` |
| AUTH-01 | Extension detects if user is signed into transcriptgrab.com | `chrome.cookies.get()` checking for `authjs.session-token` cookie on transcriptgrab.com domain; `cookies` permission + `host_permissions` in manifest |
| AUTH-03 | Extension shows signed-in status indicator | `chrome.action.setBadgeText` + `setBadgeBackgroundColor` for toolbar icon badge; green dot when signed in, gray when not |
| AUTH-05 | Extension works fully without sign-in (transcript + summary available, no persistence) | Button always injected regardless of auth state; message-passing round trip works without auth; auth state only affects badge and future save behavior |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wxt | ^0.20.x | Extension framework | Leading MV3 framework; file-based entrypoints, Vite-powered, built-in Shadow DOM UI, SPA navigation support, auto-imports |
| @webext-core/messaging | ^1.0.x | Type-safe messaging | Official companion to WXT (same author); typed ProtocolMap pattern; handles sendMessage/onMessage between content script and background |
| typescript | ^5.x | Type safety | Matches web app; WXT has first-class TS support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tailwindcss/vite | ^4.x | Tailwind in popup | Only for the popup HTML page styling; NOT for content script button (that uses YouTube-native CSS) |
| tailwindcss | ^4.x | Utility CSS | Popup styling to match web app theme |
| @thedutchcoder/postcss-rem-to-px | ^1.x | rem-to-px conversion | Required if using Tailwind in Shadow DOM content; Tailwind uses rem units which break in Shadow DOM since rem is relative to host page's html font-size |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @webext-core/messaging | webext-bridge | webext-bridge is more feature-rich but heavier; @webext-core/messaging is by WXT's author and lighter |
| @webext-core/messaging | trpc-chrome | Overkill for this scope; tRPC adds router complexity we don't need |
| Vanilla TS button | React content script | React adds bundle size for a single button; Phase 9 (transcript panel) may introduce React later |
| Standalone extension/ dir | Monorepo workspaces | No shared build tooling between Next.js and WXT; monorepo adds tsconfig/alias complexity for no benefit at this stage |

**Installation:**
```bash
# From extension/ directory
npx wxt@latest init . --template vanilla
npm install @webext-core/messaging
npm install -D tailwindcss @tailwindcss/vite
```

## Architecture Patterns

### Recommended Project Structure
```
extension/                      # Standalone WXT project
  entrypoints/
    background/
      index.ts                  # Background service worker entry
      messaging.ts              # onMessage handlers
      auth.ts                   # Auth state detection logic
    youtube.content/
      index.ts                  # Content script entry (YouTube pages)
      button.ts                 # Button creation and injection
      style.css                 # YouTube-native button styles
    popup/
      index.html                # Toolbar popup HTML
      main.ts                   # Popup logic
      style.css                 # Popup styles (Tailwind)
  utils/
    messaging.ts                # Shared ProtocolMap + sendMessage/onMessage exports
    constants.ts                # Shared constants (URLs, cookie names, etc.)
  assets/
    icon-16.png                 # Extension icons
    icon-32.png
    icon-48.png
    icon-128.png
  public/
    icon/                       # Additional icon assets
  wxt.config.ts                 # WXT configuration
  tsconfig.json
  package.json
```

### Pattern 1: Type-Safe Message Passing
**What:** Define a shared ProtocolMap interface used by both content script and background
**When to use:** Every message between content script and background service worker

```typescript
// utils/messaging.ts
// Source: @webext-core/messaging docs (https://webext-core.aklinker1.io/messaging)
import { defineExtensionMessaging } from '@webext-core/messaging';

interface ProtocolMap {
  // Content script -> Background: request transcript fetch
  getTranscript(data: { videoId: string; languageCode?: string }): TranscriptResult;
  // Content script -> Background: check auth state
  checkAuth(): { isSignedIn: boolean };
  // Background -> Content script (via tab): auth state changed
  authStateChanged(data: { isSignedIn: boolean }): void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
```

### Pattern 2: SPA Navigation with Persist-and-Update
**What:** Content script listens for `wxt:locationchange`, keeps the button mounted, resets its state on navigation
**When to use:** YouTube video-to-video navigation without full page reload

```typescript
// entrypoints/youtube.content/index.ts
// Source: WXT docs (https://wxt.dev/guide/essentials/content-scripts)
const watchPattern = new MatchPattern('*://*.youtube.com/watch*');

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  cssInjectionMode: 'ui',

  main(ctx) {
    let buttonMounted = false;

    const handleNavigation = (url: string) => {
      if (watchPattern.includes(url)) {
        if (!buttonMounted) {
          injectButton(ctx);
          buttonMounted = true;
        }
        resetButtonState();
        recheckAuth();
      }
    };

    // Handle initial page load
    handleNavigation(window.location.href);

    // Handle SPA navigation
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
      handleNavigation(newUrl.toString());
    });
  },
});
```

### Pattern 3: Auth Detection via Cookie Check
**What:** Background service worker checks for the NextAuth session cookie on transcriptgrab.com
**When to use:** On extension load, on each video page navigation, and periodically

```typescript
// entrypoints/background/auth.ts
// Source: Chrome cookies API (https://developer.chrome.com/docs/extensions/reference/api/cookies)

const COOKIE_NAME = 'authjs.session-token';
const COOKIE_URL = 'https://transcriptgrab.com';

// For production (HTTPS), cookie name has __Secure- prefix
const SECURE_COOKIE_NAME = '__Secure-authjs.session-token';

export async function checkAuthState(): Promise<boolean> {
  try {
    // Try secure cookie first (production), then non-secure (development)
    const secureCookie = await chrome.cookies.get({
      url: COOKIE_URL,
      name: SECURE_COOKIE_NAME,
    });
    if (secureCookie) return true;

    const cookie = await chrome.cookies.get({
      url: COOKIE_URL,
      name: COOKIE_NAME,
    });
    return !!cookie;
  } catch {
    return false;
  }
}
```

### Pattern 4: Shadow DOM Button Injection
**What:** Use createShadowRootUi for CSS isolation, but style the button to match YouTube's native appearance
**When to use:** Injecting the transcript button into YouTube's actions row

```typescript
// entrypoints/youtube.content/button.ts
// Source: WXT docs (https://wxt.dev/guide/essentials/content-scripts)

export async function injectButton(ctx: ContentScriptContext) {
  const ui = await createShadowRootUi(ctx, {
    name: 'transcriptgrab-button',
    position: 'inline',
    anchor: '#top-level-buttons-computed',
    append: 'last',
    onMount(container) {
      const button = document.createElement('button');
      button.className = 'tg-transcript-btn';
      // Build button content using safe DOM methods
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      // ... configure SVG icon attributes
      const label = document.createElement('span');
      label.textContent = 'Transcript';
      button.append(icon, label);
      button.addEventListener('click', handleButtonClick);
      container.append(button);
      return button;
    },
    onRemove(button) {
      button?.removeEventListener('click', handleButtonClick);
    },
  });

  ui.mount();
  return ui;
}
```

### Pattern 5: Toolbar Badge Updates
**What:** Update the extension toolbar icon badge to reflect auth state
**When to use:** After auth state check completes

```typescript
// entrypoints/background/auth.ts
// Source: Chrome action API (https://developer.chrome.com/docs/extensions/reference/api/action)

export async function updateAuthBadge(isSignedIn: boolean) {
  if (isSignedIn) {
    await chrome.action.setBadgeText({ text: ' ' });
    await chrome.action.setBadgeBackgroundColor({ color: '#22c55e' }); // green-500
  } else {
    await chrome.action.setBadgeText({ text: ' ' });
    await chrome.action.setBadgeBackgroundColor({ color: '#9ca3af' }); // gray-400
  }
}
```

### Anti-Patterns to Avoid
- **Content script making fetch() calls directly:** Violates EXT-04; content scripts face CORS restrictions; all API calls must go through background service worker via message passing
- **Using React for the button alone:** Adds 40KB+ to the content script bundle for a single DOM element; use vanilla TS for the button, save React for Phase 9's panel
- **Querying YouTube DOM once and caching selectors:** YouTube rebuilds DOM on SPA navigation; always re-query or use MutationObserver
- **Storing auth tokens in chrome.storage.local:** The web app already manages JWT cookies; the extension should read cookies, not duplicate token storage
- **Using `document.cookie` to read session:** NextAuth cookies are httpOnly; they cannot be read via JavaScript; must use `chrome.cookies` API from the background service worker

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message passing between contexts | Custom `chrome.runtime.sendMessage` wrappers | `@webext-core/messaging` | Type safety, auto-handles async responses, supports tab targeting, eliminates the `return true` footgun |
| SPA navigation detection | Custom `MutationObserver` on `<title>` or URL polling | WXT's built-in `wxt:locationchange` event | WXT already observes `history.pushState` and `popstate`; handles edge cases |
| CSS isolation for injected UI | Manual iframe or style scoping | WXT's `createShadowRootUi` with `cssInjectionMode: 'ui'` | Shadow DOM prevents YouTube CSS bleed in both directions; WXT handles the shadow root lifecycle |
| Extension manifest generation | Manual manifest.json | WXT auto-generation from `wxt.config.ts` + entrypoint files | Entrypoints auto-register in manifest; permissions declared in config |
| URL pattern matching | Regex for YouTube URLs | WXT's `MatchPattern` utility | Standard WebExtension match pattern syntax; handles edge cases |

**Key insight:** WXT abstracts the three hardest parts of extension development -- manifest management, content script lifecycle, and shadow DOM UI injection. Fighting WXT by reimplementing these creates bugs that WXT's maintainers have already solved.

## Common Pitfalls

### Pitfall 1: YouTube DOM Not Ready After SPA Navigation
**What goes wrong:** Content script tries to inject the button immediately on `wxt:locationchange`, but YouTube's actions row (`#top-level-buttons-computed`) hasn't rendered yet.
**Why it happens:** YouTube's SPA navigation triggers URL change before DOM updates. The polymer components render asynchronously.
**How to avoid:** Use a polling/retry approach or MutationObserver to wait for the anchor element. WXT's `createShadowRootUi` can accept a function for `anchor` that retries, but the safest approach is:
```typescript
function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
  });
}
```
**Warning signs:** Button appears on initial page load but not after clicking a video link.

### Pitfall 2: NextAuth Cookie Name Varies by Environment
**What goes wrong:** Extension checks for `authjs.session-token` but production uses `__Secure-authjs.session-token`.
**Why it happens:** NextAuth v5 (Auth.js) automatically prefixes cookie names with `__Secure-` when running on HTTPS (production). Development on localhost uses the unprefixed name.
**How to avoid:** Check both cookie names. Try `__Secure-authjs.session-token` first, fall back to `authjs.session-token`. This handles both production and local development.
**Warning signs:** Auth detection works in development but fails in production (or vice versa).

### Pitfall 3: httpOnly Cookies Cannot Be Read from Content Scripts
**What goes wrong:** Developer tries `document.cookie` in the content script to detect auth state.
**Why it happens:** NextAuth session cookies are httpOnly by default, meaning JavaScript on the page cannot access them.
**How to avoid:** Auth detection must happen in the background service worker using `chrome.cookies.get()`, which can read httpOnly cookies when the extension has `cookies` permission and matching `host_permissions`.
**Warning signs:** `document.cookie` returns empty string or doesn't contain the session token.

### Pitfall 4: Tailwind rem Units Break in Shadow DOM
**What goes wrong:** Font sizes, spacing, and padding look wrong in the injected UI.
**Why it happens:** Tailwind CSS uses `rem` units by default. In Shadow DOM, `rem` is relative to the host page's `<html>` font-size, not the shadow root. YouTube may set unusual font sizes.
**How to avoid:** For the content script button: don't use Tailwind at all; use YouTube-native CSS with `px` units. For future Phase 9 panel: use `@thedutchcoder/postcss-rem-to-px` to convert rem to px at build time.
**Warning signs:** UI elements appear too large or too small depending on the host page.

### Pitfall 5: Background Service Worker Goes Idle
**What goes wrong:** Auth state check fails because the service worker has been terminated by Chrome.
**Why it happens:** MV3 service workers are event-driven and get terminated after ~30 seconds of inactivity.
**How to avoid:** Design auth checks as request-response (content script asks, background responds) rather than relying on persistent background state. The `@webext-core/messaging` pattern naturally handles this because each `sendMessage` wakes the service worker.
**Warning signs:** First click after inactivity is slow or fails; subsequent clicks work fine.

### Pitfall 6: Duplicate Button Injection
**What goes wrong:** Multiple transcript buttons appear on the page.
**Why it happens:** SPA navigation fires, content script injects a new button without checking if one already exists. Or the content script runs multiple times due to extension reloads during development.
**How to avoid:** Track injection state; check for existing shadow root before creating a new one. Use a named shadow root (`name: 'transcriptgrab-button'`) and check `document.querySelector('transcriptgrab-button')` before injecting.
**Warning signs:** Two or more "Transcript" buttons in the actions row.

### Pitfall 7: CORS When Content Script Fetches API
**What goes wrong:** Content script tries to call `transcriptgrab.com/api/transcript` directly and gets CORS error.
**Why it happens:** Content scripts run in the page's origin context. Cross-origin requests from content scripts are blocked by CORS in MV3 (changed from MV2 behavior).
**How to avoid:** Route all API calls through the background service worker via message passing (EXT-04). Background scripts/service workers bypass CORS when `host_permissions` includes the target domain.
**Warning signs:** Network errors or CORS policy violations in the console.

## Code Examples

Verified patterns from official sources:

### WXT Configuration for This Extension
```typescript
// extension/wxt.config.ts
// Source: WXT docs (https://wxt.dev/guide/essentials/config/manifest)
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'TranscriptGrab',
    description: 'Grab YouTube transcripts instantly',
    permissions: ['cookies', 'storage'],
    host_permissions: [
      'https://transcriptgrab.com/*',
      'http://localhost:3000/*',  // Development
    ],
    action: {
      default_title: 'TranscriptGrab',
    },
  },
});
```

### Content Script Entry with SPA Handling
```typescript
// extension/entrypoints/youtube.content/index.ts
// Source: WXT docs (https://wxt.dev/guide/essentials/content-scripts)
import { ContentScriptContext, createShadowRootUi } from 'wxt/client';
import { sendMessage } from '@/utils/messaging';

const WATCH_PATTERN = new MatchPattern('*://*.youtube.com/watch*');
const ANCHOR_SELECTOR = '#top-level-buttons-computed';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_idle',

  main(ctx) {
    let currentUi: ReturnType<typeof createShadowRootUi> | null = null;

    async function onWatchPage() {
      // Wait for YouTube's actions row to render
      const anchor = await waitForElement(ANCHOR_SELECTOR);
      if (!anchor || ctx.isInvalid) return;

      if (!currentUi) {
        currentUi = await mountButton(ctx);
      }
      // Recheck auth on each navigation
      const { isSignedIn } = await sendMessage('checkAuth', undefined);
      // Auth state only affects badge (handled by background)
    }

    // Initial load
    if (WATCH_PATTERN.includes(window.location.href)) {
      onWatchPage();
    }

    // SPA navigation
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
      if (WATCH_PATTERN.includes(newUrl.toString())) {
        onWatchPage();
      }
    });
  },
});
```

### Background Service Worker with Message Handling
```typescript
// extension/entrypoints/background/index.ts
// Source: WXT docs + @webext-core/messaging
import { onMessage } from '@/utils/messaging';
import { checkAuthState, updateAuthBadge } from './auth';

export default defineBackground(() => {
  // Handle auth check requests from content script
  onMessage('checkAuth', async () => {
    const isSignedIn = await checkAuthState();
    await updateAuthBadge(isSignedIn);
    return { isSignedIn };
  });

  // Handle transcript fetch requests (placeholder for Phase 9)
  onMessage('getTranscript', async ({ data }) => {
    const response = await fetch('https://transcriptgrab.com/api/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: `https://youtube.com/watch?v=${data.videoId}` }),
      credentials: 'include',
    });
    return response.json();
  });

  // Listen for cookie changes to update auth state
  chrome.cookies.onChanged.addListener(async (changeInfo) => {
    if (
      changeInfo.cookie.domain.includes('transcriptgrab.com') &&
      changeInfo.cookie.name.includes('session-token')
    ) {
      const isSignedIn = await checkAuthState();
      await updateAuthBadge(isSignedIn);
    }
  });
});
```

### Popup HTML with Status Display
```html
<!-- extension/entrypoints/popup/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TranscriptGrab</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body class="dark">
    <div id="popup">
      <h1>TranscriptGrab</h1>
      <p id="status">Checking...</p>
      <p id="version"></p>
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MV2 background pages (persistent) | MV3 service workers (event-driven) | Chrome MV3 mandate (2024) | Service workers sleep after inactivity; must design for stateless request/response |
| Content scripts could make cross-origin fetch | Content scripts blocked by CORS (MV3) | Chrome 102+ (2022) | All cross-origin requests must route through background service worker |
| `browser_action` / `page_action` | Unified `action` API | MV3 | Single `chrome.action` namespace for badge, icon, popup |
| Plasmo framework dominance | WXT as leading framework | 2024-2025 | WXT offers better DX, faster builds, more active maintenance |
| NextAuth v4 cookie: `next-auth.session-token` | Auth.js v5 cookie: `authjs.session-token` | NextAuth v5 (2024) | Cookie name changed; must check for v5 prefix |
| Tailwind CSS config file | Tailwind CSS v4 CSS-first config | 2025 | `@tailwindcss/vite` plugin replaces PostCSS approach; config in CSS |

**Deprecated/outdated:**
- MV2 manifest format: Chrome stops supporting MV2 extensions
- `chrome.browserAction` API: replaced by `chrome.action` in MV3
- `webextension-polyfill`: WXT includes its own browser API normalization via `wxt/browser`

## Discretion Recommendations

### Auth Detection: Cookie Check (Recommended over API Ping)
**Recommendation:** Use `chrome.cookies.get()` to check for the NextAuth session cookie.
**Reasoning:** The web app uses NextAuth v5 with JWT strategy. The session token lives in an httpOnly cookie (`authjs.session-token` in dev, `__Secure-authjs.session-token` in production). Cookie check is instant (no network round trip), works offline, and avoids adding a new API endpoint. The background service worker can read httpOnly cookies via `chrome.cookies` API with `cookies` permission and `host_permissions` for `transcriptgrab.com`.
**Alternative considered:** API ping to `/api/auth/session` -- adds network latency, requires the server to be reachable, and needs CORS configuration. Cookie check is strictly better for this use case.

### Popup Link to transcriptgrab.com: Yes, Include It
**Recommendation:** Add a small "Open TranscriptGrab" link at the bottom of the popup.
**Reasoning:** Users need a way to navigate to the web app to sign in or view their history. The popup already shows connection status, so a link provides a natural next step. Use `chrome.tabs.create()` to open in a new tab.

### DOM Loading Strategy: MutationObserver with Timeout
**Recommendation:** Use a `waitForElement()` utility that combines `querySelector` with a `MutationObserver` and a 5-second timeout.
**Reasoning:** YouTube's polymer components render asynchronously after SPA navigation. Simple `setTimeout` delays are unreliable (DOM render time varies). `MutationObserver` watching `document.body` for `childList` + `subtree` changes is the standard approach used by all major YouTube extensions. The timeout prevents indefinite waiting if the page structure changes.

### Transcript Button Icon: Lucide `FileText` Icon
**Recommendation:** Use the Lucide `file-text` SVG icon (same icon library as the web app).
**Reasoning:** The web app already uses `lucide-react`. Using the same icon family maintains visual consistency. The SVG can be inlined directly in the button element without importing the React library.

### Shadow DOM: Use for Button, CSS Matches YouTube Native
**Recommendation:** Wrap the button in a Shadow DOM via `createShadowRootUi` with `cssInjectionMode: 'ui'`. Style the button with YouTube-native CSS (not Tailwind) using `px` units, matching YouTube's `.yt-spec-button-shape-next` design tokens.
**Reasoning:** Shadow DOM prevents YouTube's CSS from affecting the button and prevents the button's CSS from leaking into YouTube. However, the button CSS itself should mimic YouTube's native button appearance (pill shape, matching colors, same font) so it blends in. YouTube's dark/light theme can be detected by checking `document.documentElement.getAttribute('dark')` (YouTube sets a `dark` attribute on the `<html>` element).

## Open Questions

1. **Exact `#top-level-buttons-computed` stability**
   - What we know: Multiple userscripts and extensions use `#top-level-buttons-computed` as the injection target for YouTube's actions row. The "YouTube - Add Watch Later Button" script uses `#above-the-fold #menu #top-level-buttons-computed` with `findOnce: false` for SPA persistence.
   - What's unclear: YouTube periodically changes its DOM structure. This selector has been stable for 2+ years, but there's no guarantee.
   - Recommendation: Use the nested selector `#above-the-fold #menu #top-level-buttons-computed` as primary target. Add a fallback selector targeting `ytd-menu-renderer` in case the ID changes. Log a warning if neither is found so we can detect breakage quickly.

2. **Theater mode and mini-player button placement**
   - What we know: The user wants the button to work across default, theater, and mini-player modes. In theater mode, the same `#top-level-buttons-computed` container exists. Mini-player is structurally different.
   - What's unclear: Whether mini-player renders the actions row at all, or if the button should appear elsewhere.
   - Recommendation: Target `#top-level-buttons-computed` which covers default and theater mode. For mini-player, defer to Phase 9 if it requires separate injection logic -- the button presence is less critical in mini-player mode.

3. **Auth cookie check on transcriptgrab.com deployed URL**
   - What we know: The cookie is on the `transcriptgrab.com` domain. `host_permissions` must include `https://transcriptgrab.com/*`.
   - What's unclear: Whether the Vercel deployment uses a `.vercel.app` subdomain or only the custom domain. If both, cookies may be on different domains.
   - Recommendation: Check the actual production cookie domain. Add both `https://transcriptgrab.com/*` and `https://*.vercel.app/*` to `host_permissions` if needed, though prefer the custom domain only.

## Sources

### Primary (HIGH confidence)
- WXT official docs (`/websites/wxt_dev`, `/websites/wxt_dev_guide`) - Content scripts, entrypoints, project structure, SPA navigation, Shadow DOM UI, manifest configuration
- @webext-core/messaging (`/aklinker1/webext-core`) - ProtocolMap definition, sendMessage/onMessage usage, ExtensionMessenger types
- Chrome cookies API (https://developer.chrome.com/docs/extensions/reference/api/cookies) - chrome.cookies.get, chrome.cookies.onChanged, permissions
- Chrome action API (https://developer.chrome.com/docs/extensions/reference/api/action) - setBadgeText, setBadgeBackgroundColor, setIcon
- NextAuth/Auth.js v5 (`/nextauthjs/next-auth`) - JWT session strategy, httpOnly cookies, session cookie configuration

### Secondary (MEDIUM confidence)
- YouTube "Add Watch Later Button" userscript (https://greasyfork.org/en/scripts/419656-youtube-add-watch-later-button) - `#top-level-buttons-computed` selector, `#above-the-fold #menu` nesting, SPA navigation handling pattern
- WXT + React + Tailwind + shadcn boilerplate (https://github.com/imtiger/wxt-react-shadcn-tailwindcss-chrome-extension) - PostCSS rem-to-px pattern, Tailwind in Shadow DOM
- Monorepo setup guide (https://weberdominik.com/blog/monorepo-wxt-nextjs/) - WXT + Next.js project organization, path alias configuration
- WXT Tailwind v4 compatibility issue (https://github.com/wxt-dev/wxt/issues/1460) - @tailwindcss/vite plugin as solution
- NextAuth Chrome extension discussions (https://github.com/nextauthjs/next-auth/discussions/6021, https://github.com/nextauthjs/next-auth/discussions/8045) - Cookie-based auth detection patterns

### Tertiary (LOW confidence)
- YouTube DOM selectors for mini-player mode - Not independently verified; needs manual DevTools inspection during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - WXT, @webext-core/messaging, and chrome.cookies are all well-documented with official sources
- Architecture: HIGH - Message-passing pattern, Shadow DOM injection, and SPA navigation handling are all documented in WXT official docs
- Pitfalls: HIGH - Each pitfall is sourced from official docs, GitHub issues, or community discussions with multiple corroborating sources
- YouTube DOM selectors: MEDIUM - Based on active userscripts but YouTube can change DOM at any time

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days; WXT and Chrome APIs are stable; YouTube DOM may change)
