# Phase 9: Transcript Panel - Research

**Researched:** 2026-02-18
**Domain:** Shadow DOM panel injection into YouTube watch pages, transcript fetching via background service worker, clipboard/download APIs, WXT storage for persistence
**Confidence:** HIGH

## Summary

Phase 9 builds the transcript panel that opens when the user clicks the Phase 8 button. The panel is a Shadow DOM element injected below YouTube's description area and before the comments section, displaying fetched transcript segments line-by-line. The background service worker calls the TranscriptGrab web app's `/api/transcript` endpoint and relays the response to the content script. Copy and download use standard web APIs (`navigator.clipboard.writeText` and `Blob` + anchor download trick). A dismissible sign-in banner for unauthenticated users persists its dismissed state via WXT's built-in `storage.defineItem` API.

The existing codebase provides almost everything needed. The web app already has `lib/format.ts` with `formatTranscriptText(segments, showTimestamps)` that produces exactly the output needed for copy/download. The `lib/types.ts` defines `TranscriptSegment`, `TranscriptResult`, and `VideoMetadata` types. The background service worker's `getTranscript` handler is a placeholder that needs to be wired up to actually call the web app API. The messaging protocol in `utils/messaging.ts` needs its return type updated to carry real transcript data.

**Primary recommendation:** Keep everything in vanilla TypeScript (no React). The panel is complex enough to warrant its own module (`panel.ts`) alongside the existing `button.ts`. Use a second `createShadowRootUi` instance for the panel (separate from the button's shadow root) so the panel's CSS is fully isolated. Fetch transcripts through the background service worker calling the web app's `/api/transcript` and `/api/metadata` endpoints. Use `storage.defineItem<boolean>('local:signInBannerDismissed')` for permanent banner dismissal.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Panel layout & sizing
- Position below the YouTube description area, before comments -- pushes comments down when open
- Fixed height with internal scroll for long transcripts (no full-height expansion)
- Visual style matches YouTube's native look -- colors, borders, typography blend in
- Respects YouTube's dark/light theme -- detect YouTube's current mode and adapt panel colors

#### Transcript display
- Line-by-line segments, each transcript segment on its own line (matches YouTube transcript style)
- Timestamps are toggleable -- default to hidden, user can toggle on/off with a switch
- Panel header shows video title and channel name for context
- No search/filter within the transcript -- keep it simple

#### Copy experience
- Copy output matches current display state -- if timestamps are toggled on, they're included in the copy
- Toast notification for copy confirmation (small popup, disappears after 2-3s)
- Button only -- no keyboard shortcut
- Include a download button alongside copy -- saves transcript as .txt file

#### Sign-in prompt
- Dismissible banner at top of panel (above transcript text)
- Once dismissed, never shows again for that install (stored in extension local storage)
- Benefit-focused tone: emphasize value of saving and accessing transcripts later
- Dismiss is permanent per install -- no re-prompting

### Claude's Discretion
- Sign-in link action (new tab to web app vs extension popup -- whatever works best with Phase 8 auth detection)
- Exact banner styling and dismiss animation
- Toast notification implementation and positioning
- Download filename format
- Exact max-height value for the scrollable panel

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PANEL-01 | User can click button to open transcript panel above YouTube description area | Panel injected as a second Shadow DOM UI via `createShadowRootUi`, anchored to `ytd-watch-metadata` or `#below` element. Button click handler in `button.ts` toggles panel visibility. |
| PANEL-02 | Panel displays full transcript text with loading and error states | Background service worker calls `/api/transcript` with the videoId, relays `TranscriptResult` to content script. Panel shows spinner during fetch, error message on failure, segments on success. |
| PANEL-03 | User can copy transcript to clipboard with visual confirmation | `navigator.clipboard.writeText()` called from the content script (YouTube is HTTPS, so Clipboard API works). Toast notification element appended to the panel's Shadow DOM with CSS animation. |
| PANEL-04 | User can close/hide the panel | Close button in panel header removes or hides the panel DOM. Panel state tracked in the content script module scope. Re-clicking transcript button reopens with a fresh fetch. |
| AUTH-04 | Non-blocking sign-in prompt for unauthenticated users | Dismissible banner at top of panel, shown only when `checkAuth` returns `isSignedIn: false` AND `storage.defineItem('local:signInBannerDismissed')` is not true. Dismiss stores permanent flag. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wxt | ^0.20.x | Extension framework (already installed) | Provides `createShadowRootUi`, `storage`, auto-imports, content script lifecycle |
| @webext-core/messaging | ^1.4.0 | Type-safe messaging (already installed) | Used for content script <-> background communication; already in the project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| WXT built-in storage | (bundled) | Persist banner dismissal | `storage.defineItem<boolean>('local:signInBannerDismissed')` -- no additional install needed, `storage` is auto-imported by WXT |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla TS panel | React in content script | React adds ~40KB to content script bundle for what is essentially a styled list with a header and buttons. Not worth it for this scope. |
| `navigator.clipboard.writeText` | `document.execCommand('copy')` | execCommand is deprecated; clipboard API is the standard and works on HTTPS pages (YouTube is always HTTPS) |
| Blob + anchor download | `chrome.downloads.download()` with data URL | downloads API requires additional `downloads` permission in manifest; Blob + anchor works from content script without extra permissions |
| WXT `storage.defineItem` | `chrome.storage.local` directly | WXT's storage API provides type safety, default values, and is auto-imported. Same underlying API but better DX. |

**Installation:**
```bash
# No new packages needed -- all dependencies are already installed
```

## Architecture Patterns

### Recommended Project Structure
```
extension/
  entrypoints/
    youtube.content/
      index.ts           # Content script entry (existing, needs panel toggle wiring)
      button.ts          # Button creation (existing, needs click handler update)
      panel.ts           # NEW: Panel creation, rendering, and lifecycle
      style.css          # Existing button CSS + new panel CSS
    background/
      index.ts           # Background service worker (needs real transcript fetch)
      auth.ts            # Auth detection (existing, no changes)
  utils/
    messaging.ts         # Shared protocol map (needs type updates)
    constants.ts         # Shared constants (existing, may need additions)
    dom.ts               # waitForElement utility (existing, no changes)
    format.ts            # NEW: Transcript formatting (port from web app's lib/format.ts)
    types.ts             # NEW: Shared types (port subset from web app's lib/types.ts)
```

### Pattern 1: Second Shadow DOM UI for the Panel
**What:** Create a separate `createShadowRootUi` instance for the panel, independent of the button's shadow root
**When to use:** The panel has its own CSS, its own lifecycle, and is injected at a different anchor point than the button

The panel needs its own Shadow DOM because:
1. It is anchored at a different DOM location (below description, not in the actions row)
2. Its CSS is independent of the button CSS
3. It can be created/destroyed independently of the button

```typescript
// entrypoints/youtube.content/panel.ts
import './style.css'; // Panel styles are in the same file as button styles

let panelUi: ShadowRootContentScriptUi<HTMLDivElement> | null = null;

export async function showPanel(ctx: ContentScriptContext, videoId: string): Promise<void> {
  if (panelUi) {
    panelUi.remove();
    panelUi = null;
  }

  // Find anchor point: below description, before comments
  const anchor = document.querySelector('ytd-watch-metadata')
    || document.querySelector('#below');
  if (!anchor) return;

  panelUi = await createShadowRootUi(ctx, {
    name: 'transcriptgrab-panel',
    position: 'inline',
    anchor,
    append: 'after', // Places panel after the anchor element
    onMount(container) {
      const panel = document.createElement('div');
      panel.className = 'tg-panel';
      // ... build panel DOM
      container.appendChild(panel);
      return panel;
    },
    onRemove() {
      panelUi = null;
    },
  });

  panelUi.mount();
}
```

### Pattern 2: Background Service Worker Transcript Fetch
**What:** Wire the `getTranscript` message handler to actually call the web app's API
**When to use:** Every time a user clicks the transcript button

The current background handler is a placeholder. It needs to:
1. Call `/api/transcript` with the videoId
2. Call `/api/metadata` with the videoId for title/channel name
3. Return both to the content script

```typescript
// entrypoints/background/index.ts
onMessage('getTranscript', async ({ data }) => {
  const { videoId } = data;
  const apiBase = import.meta.env.DEV ? DEV_URL : PROD_URL;

  // Fetch transcript and metadata in parallel
  const [transcriptRes, metadataRes] = await Promise.all([
    fetch(`${apiBase}/api/transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: `https://youtube.com/watch?v=${videoId}` }),
    }),
    fetch(`${apiBase}/api/metadata?url=${encodeURIComponent(`https://youtube.com/watch?v=${videoId}`)}`),
  ]);

  const transcript = await transcriptRes.json();
  const metadata = await metadataRes.json();

  return { transcript, metadata };
});
```

### Pattern 3: Clipboard Write from Content Script
**What:** Use `navigator.clipboard.writeText()` from the content script context
**When to use:** User clicks the Copy button in the panel

YouTube is always served over HTTPS, so the Clipboard API is available. The content script runs in the YouTube page's secure context.

```typescript
async function copyTranscript(segments: TranscriptSegment[], showTimestamps: boolean): Promise<void> {
  const text = formatTranscriptText(segments, showTimestamps);
  await navigator.clipboard.writeText(text);
  showToast('Copied to clipboard');
}
```

**Important:** `navigator.clipboard.writeText()` may require user activation (a recent user gesture). Since it is called directly from a button click handler, the user activation requirement is satisfied.

### Pattern 4: File Download via Blob and Anchor
**What:** Create a Blob from the transcript text, generate an object URL, and trigger download via a hidden anchor element
**When to use:** User clicks the Download button

```typescript
function downloadTranscript(segments: TranscriptSegment[], showTimestamps: boolean, videoTitle: string): void {
  const text = formatTranscriptText(segments, showTimestamps);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(videoTitle)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

This works from content scripts on HTTPS pages without requiring the `downloads` permission.

### Pattern 5: Persistent Banner Dismissal via WXT Storage
**What:** Use `storage.defineItem` to permanently persist the sign-in banner dismissed state
**When to use:** Track whether the user has dismissed the sign-in prompt

```typescript
// utils/storage.ts or inline in panel.ts
const signInBannerDismissed = storage.defineItem<boolean>(
  'local:signInBannerDismissed',
  { fallback: false }
);

// Check on panel render:
const dismissed = await signInBannerDismissed.getValue();
if (!dismissed && !isSignedIn) {
  showSignInBanner();
}

// On dismiss:
await signInBannerDismissed.setValue(true);
```

WXT's `storage` is auto-imported globally. No additional package install needed.

### Pattern 6: YouTube Theme Detection and Adaptation
**What:** Detect YouTube's dark/light mode and adapt panel colors
**When to use:** Every time the panel is rendered

YouTube sets a `dark` attribute on `<html>` when dark mode is enabled:

```typescript
function isYouTubeDark(): boolean {
  return document.documentElement.hasAttribute('dark');
}
```

The existing button code in `button.ts` already uses this pattern (`document.documentElement.hasAttribute('dark')`). The panel should use the same approach and apply a `.tg-dark` class to its root element.

Additionally, to handle theme changes without page reload (user toggles dark mode), observe the `<html>` element for attribute changes:

```typescript
const themeObserver = new MutationObserver(() => {
  const isDark = isYouTubeDark();
  panelRoot.classList.toggle('tg-dark', isDark);
});
themeObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['dark'],
});
```

### Anti-Patterns to Avoid
- **Fetching transcripts from the content script directly:** Content scripts face CORS restrictions in MV3. All API calls must route through the background service worker via message passing.
- **Using innerHTML to build the panel DOM:** Security risk in content scripts. Use `document.createElement` for all DOM construction.
- **Sharing a single Shadow DOM between button and panel:** They are anchored at different DOM locations and have independent lifecycles. Separate shadow roots avoid coupling.
- **Using `rem` units in panel CSS:** Shadow DOM uses the host page's `<html>` font-size for rem calculation. YouTube's font-size may differ from expectations. Use `px` units exclusively.
- **Storing dismissed state in a JavaScript variable:** Lost on page reload/navigation. Must use `chrome.storage.local` (via WXT's `storage.defineItem`) for persistence across sessions.
- **Relying on YouTube's native transcript panel DOM:** Our panel fetches transcripts independently via the web app API. We do not interact with YouTube's built-in transcript feature at all.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transcript text formatting | Custom text formatter | Port `lib/format.ts` from the web app | Already handles timestamps, HTML entity decoding, edge cases. Tested and working. |
| Extension storage with type safety | Raw `chrome.storage.local.get/set` | WXT `storage.defineItem<T>()` | Type-safe, auto-imported, handles serialization, supports `watch()` for reactive updates |
| CSS isolation for injected panel | Manual style scoping or iframe | WXT `createShadowRootUi` | Shadow DOM prevents YouTube CSS bleed in both directions; WXT manages lifecycle |
| Toast notification library | npm toast library | Simple CSS-animated `<div>` in the shadow root | A 2-3 second fade-out toast is ~15 lines of CSS + 5 lines of JS. No library needed. |
| Filename sanitization for download | Complex regex replacement | Simple `replace(/[^a-zA-Z0-9_-]/g, '_')` with truncation | Filenames only need basic sanitization; edge cases are handled by the OS |

**Key insight:** The web app already contains the transcript formatting logic (`lib/format.ts`) and type definitions (`lib/types.ts`). Port these directly into the extension rather than reimplementing. They are pure functions with no Next.js dependencies.

## Common Pitfalls

### Pitfall 1: YouTube DOM Anchor Not Found After SPA Navigation
**What goes wrong:** Panel injection fails because the anchor element (`ytd-watch-metadata` or `#below`) does not exist yet after a YouTube SPA navigation.
**Why it happens:** YouTube's SPA navigation fires URL change events before the new page's DOM is fully rendered. The metadata section renders asynchronously.
**How to avoid:** Use the existing `waitForElement()` utility from `utils/dom.ts` to wait for the anchor before injecting the panel. The button injection already uses this pattern successfully.
**Warning signs:** Panel appears on initial page load but not after clicking a video link from the sidebar.

### Pitfall 2: Panel Shadow DOM Anchor Removed by YouTube
**What goes wrong:** YouTube rebuilds the `ytd-watch-metadata` element during SPA navigation, orphaning the panel's shadow root.
**Why it happens:** YouTube's Polymer components are destroyed and recreated on navigation. Our panel is attached to a child of the old component tree.
**How to avoid:** On each SPA navigation, check if the panel's shadow root is still in the DOM. If not, destroy the old `panelUi` reference and re-create if needed. The button code already handles this pattern (checking `document.querySelector('transcriptgrab-button')` on each navigation).
**Warning signs:** Panel disappears after navigating to a new video without reopening.

### Pitfall 3: Clipboard API Fails Without User Activation
**What goes wrong:** `navigator.clipboard.writeText()` throws a DOMException about user activation.
**Why it happens:** The Clipboard API requires a recent user gesture (click, keypress). If the copy function is called asynchronously without a direct connection to the click event, the browser may reject it.
**How to avoid:** Call `navigator.clipboard.writeText()` synchronously from the click handler (or in the first microtask). Do not wrap it in `setTimeout` or detach it from the event chain with multiple `await`s before the clipboard call.
**Warning signs:** Copy works sometimes but fails other times; error in console about "Document is not focused" or "transient activation required".

### Pitfall 4: Blob Download Blocked by Content Security Policy
**What goes wrong:** `URL.createObjectURL(blob)` or anchor click for download is blocked.
**Why it happens:** YouTube's Content Security Policy may restrict blob URLs or programmatic navigation.
**How to avoid:** Create the anchor element and append it to `document.body` (in the main page context, not inside the Shadow DOM). The `blob:` scheme should work on YouTube since the content script shares the page origin. If CSP blocks it, fall back to sending the data to the background service worker and using `chrome.downloads.download()` with a data URL.
**Warning signs:** Download button clicks do nothing; CSP violation errors in the console.

### Pitfall 5: Message Protocol Type Mismatch
**What goes wrong:** The content script receives `undefined` or an error when calling `sendMessage('getTranscript', ...)` because the return type changed.
**Why it happens:** The `ProtocolMap` in `utils/messaging.ts` must be updated to reflect the new return type (transcript data + metadata) but the background handler returns a different shape.
**How to avoid:** Update the `ProtocolMap` interface first. Define the exact shape of the response object. Ensure the background handler returns data matching this type.
**Warning signs:** TypeScript build errors about type mismatches; runtime `undefined` responses.

### Pitfall 6: Panel Styles Bleed from YouTube or Vice Versa
**What goes wrong:** Panel text inherits YouTube's font sizes, or panel CSS affects YouTube's layout.
**Why it happens:** Shadow DOM prevents CSS bleed in most cases, but inherited properties (font-family, color, line-height) propagate through the shadow boundary by default.
**How to avoid:** Set explicit `font-family`, `font-size`, `color`, and `line-height` on the panel's root element. Use a CSS reset within the shadow root (e.g., `all: initial` on the container, then override with desired styles).
**Warning signs:** Panel text looks different depending on which YouTube page you are on; YouTube layout shifts when panel is open.

### Pitfall 7: Stale Panel After Video Change
**What goes wrong:** User navigates to a new video while the panel is open, but the panel still shows the previous video's transcript.
**Why it happens:** SPA navigation does not reload the content script. The panel DOM persists across navigations.
**How to avoid:** On SPA navigation (`yt-navigate-finish`), close the panel or mark it as stale. The button click should always trigger a fresh fetch for the current video. Track the `videoId` of the currently displayed transcript and compare it to the current URL's videoId.
**Warning signs:** Transcript text does not match the video being watched.

## Code Examples

Verified patterns from official sources and the existing codebase:

### Porting Format Utilities from Web App
The web app's `lib/format.ts` contains pure functions that can be copied directly into the extension:

```typescript
// extension/utils/format.ts -- port from lib/format.ts
// Source: existing codebase at lib/format.ts

import type { TranscriptSegment } from './types';

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
};

export function decodeHtmlEntities(text: string): string {
  let result = text.replace(
    /&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g,
    (match) => HTML_ENTITIES[match]
  );
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
  return result;
}

export function formatTimestamp(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatTranscriptText(segments: TranscriptSegment[], showTimestamps: boolean): string {
  return segments
    .map((seg) => {
      const text = decodeHtmlEntities(seg.text);
      return showTimestamps ? `[${formatTimestamp(seg.start)}] ${text}` : text;
    })
    .join('\n');
}
```

### Type Definitions for Extension
```typescript
// extension/utils/types.ts -- subset of lib/types.ts
// Source: existing codebase at lib/types.ts

export interface TranscriptSegment {
  text: string;
  start: number;   // seconds (float)
  duration: number; // seconds (float)
}

export interface VideoMetadata {
  title: string;
  author: string;
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  videoId: string;
}
```

### Updated Messaging Protocol
```typescript
// extension/utils/messaging.ts -- updated ProtocolMap
// Source: existing codebase at extension/utils/messaging.ts

import { defineExtensionMessaging } from '@webext-core/messaging';

interface TranscriptResponse {
  success: boolean;
  transcript?: {
    segments: Array<{ text: string; start: number; duration: number }>;
    videoId: string;
  };
  metadata?: {
    title: string;
    author: string;
  };
  error?: string;
}

interface ProtocolMap {
  getTranscript(data: { videoId: string; languageCode?: string }): TranscriptResponse;
  checkAuth(): { isSignedIn: boolean };
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
```

### YouTube DOM Hierarchy for Panel Injection
Based on research from multiple userscripts and extensions targeting YouTube's watch page:

```
ytd-watch-flexy
  #columns
    #primary
      #player                          <- Video player
      #below                           <- Container for everything below player
        ytd-watch-metadata             <- Video title, description, actions row
          #above-the-fold
            #title                     <- Video title
            #top-level-buttons-computed <- Actions (Like, Share, etc.) -- BUTTON anchor
          #description                 <- Video description
        [PANEL INJECTION POINT]        <- After ytd-watch-metadata, before ytd-comments
        ytd-comments#comments          <- Comments section
    #secondary                         <- Sidebar (related videos)
```

The panel should be injected after `ytd-watch-metadata` and before `ytd-comments#comments`. Use `ytd-watch-metadata` as the anchor with `append: 'after'` positioning.

**Selector cascade for resilience:**
1. Primary: `ytd-watch-metadata` (stable, used by multiple extensions)
2. Fallback: `#below` (the container that holds both metadata and comments)

### Toast Notification (Pure CSS)
```css
/* Inside style.css for the panel shadow root */
.tg-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #323232;
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: 9999;
}

.tg-toast.tg-toast-visible {
  opacity: 1;
}
```

```typescript
function showToast(message: string, container: HTMLElement): void {
  const existing = container.querySelector('.tg-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'tg-toast';
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('tg-toast-visible'));
  setTimeout(() => {
    toast.classList.remove('tg-toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `document.execCommand('copy')` | `navigator.clipboard.writeText()` | Deprecated since 2020 | Clipboard API is async, promise-based, works in secure contexts |
| Content scripts making direct fetch() | All fetches via background service worker | Chrome MV3 (2022+) | Content scripts face CORS; background bypasses CORS with host_permissions |
| `chrome.storage.local.get/set` | WXT `storage.defineItem<T>()` | WXT 0.18+ | Type-safe, auto-imported, reactive `watch()` method |
| Manual Shadow DOM creation | WXT `createShadowRootUi()` | WXT 0.15+ | Framework manages shadow root lifecycle, CSS injection, cleanup |

**Deprecated/outdated:**
- `document.execCommand('copy')`: Deprecated. Use `navigator.clipboard.writeText()` instead.
- Directly calling `chrome.storage.local` in WXT projects: Works but loses type safety. Prefer `storage.defineItem`.

## Discretion Recommendations

### Sign-in Link Action: New Tab to Web App (Recommended)
**Recommendation:** The sign-in banner's link should open the web app (`PROD_URL`) in a new tab via `chrome.tabs.create()`.
**Reasoning:** The existing popup already has this pattern for the "Open TranscriptGrab" link. Opening the web app directly puts the user on the sign-in page. Trying to open the extension popup programmatically from a content script is not supported by Chrome's API.

### Banner Styling: Subtle Info Bar
**Recommendation:** A light blue/gray banner with a single line of text, a "Sign in" link, and an X dismiss button. In dark mode: dark blue-gray background (`rgba(96, 165, 250, 0.1)`) with blue text. In light mode: light blue background with darker blue text.
**Reasoning:** Matches the "informational" banner pattern used across YouTube and other Google products. Non-intrusive, blends with the panel.

### Dismiss Animation: Fade Out + Collapse
**Recommendation:** On dismiss, the banner fades to opacity 0 over 200ms, then collapses its height to 0 over 200ms (using `max-height` transition), then is removed from the DOM.
**Reasoning:** Smooth but fast. The user wants it gone, not animated -- but a jarring jump feels broken.

### Toast Positioning: Bottom Center of Panel
**Recommendation:** Toast appears at the bottom center of the panel (fixed within the shadow root container), not at the bottom of the viewport.
**Reasoning:** Positioning relative to the panel keeps it visually connected to the action. A viewport-level toast could conflict with YouTube's own notifications.

### Download Filename Format: `{video-title}-transcript.txt`
**Recommendation:** `{sanitized-video-title}-transcript.txt` where sanitization replaces non-alphanumeric characters (except hyphens and underscores) with underscores and truncates to 100 characters.
**Reasoning:** Descriptive enough to identify the file later. The `-transcript` suffix distinguishes it from other downloads. Truncation prevents filesystem issues with very long titles.

### Panel Max Height: 400px
**Recommendation:** `max-height: 400px` with `overflow-y: auto` on the transcript segments container.
**Reasoning:** 400px shows approximately 15-20 transcript segments, giving enough context without dominating the page. YouTube's own transcript panel uses a similar height. This leaves the video player visible on most screen sizes and does not push comments too far down.

## Open Questions

1. **Panel injection anchor stability across YouTube layouts**
   - What we know: `ytd-watch-metadata` is used by multiple extensions and userscripts (YouTube Transcript Downloader searches for it as its primary selector). The `#below` element is its parent container.
   - What's unclear: YouTube periodically redesigns its watch page. The December 2024 YouTube layout update moved some metadata elements.
   - Recommendation: Use `ytd-watch-metadata` as primary anchor, `#below` as fallback. Add a `console.warn` if neither is found. During implementation, verify with Chrome DevTools that the current DOM matches this hierarchy.

2. **`createShadowRootUi` `append: 'after'` behavior**
   - What we know: WXT's `createShadowRootUi` supports `position: 'inline'` with `append: 'first' | 'last' | 'after' | 'before'` (from the types). The button uses `append: 'last'` to place it at the end of the actions row.
   - What's unclear: Whether `append: 'after'` places the element as a sibling after the anchor (like `insertAdjacentElement('afterend')`) or as the last child. The WXT docs don't explicitly clarify the "after" positioning mode for inline elements.
   - Recommendation: Test during implementation. If `append: 'after'` does not produce the correct sibling placement, use `append: 'last'` with the anchor set to `#below` (placing the panel as the first child of the below container) or use manual `insertAdjacentElement` after the shadow root is mounted.

3. **Download in Shadow DOM context**
   - What we know: The anchor download trick (`a.click()`) works in content scripts. However, the click originates from inside a Shadow DOM.
   - What's unclear: Whether Chrome treats a programmatic click inside a Shadow DOM the same as one in the main document for triggering downloads.
   - Recommendation: Append the hidden anchor to `document.body` (outside the shadow root) rather than inside the shadow DOM container. This ensures the download triggers in the main document context. Clean up immediately after click.

## Sources

### Primary (HIGH confidence)
- WXT official docs (`/websites/wxt_dev`, `/websites/wxt_dev_guide`) - `createShadowRootUi` usage, `storage.defineItem` API, content script configuration, CSS injection modes
- Existing codebase at `extension/` - Current architecture, patterns, auto-imports, messaging protocol
- Existing codebase at `lib/format.ts`, `lib/types.ts` - Transcript formatting and type definitions to port
- Existing codebase at `app/api/transcript/route.ts`, `app/api/metadata/route.ts` - Web app API contract for background service worker calls
- [MDN Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText) - `navigator.clipboard.writeText()` usage, secure context requirements, user activation requirements
- [Chrome Extension Clipboard Docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard) - clipboardWrite permission, content script clipboard access

### Secondary (MEDIUM confidence)
- [YouTube Transcript Downloader userscript](https://greasyfork.org/en/scripts/522364-youtube-transcript-downloader/code) - Confirmed `ytd-watch-metadata` as primary selector for YouTube description area, `#above-the-fold` as fallback
- [YouTube Transcript Copier userscript](https://greasyfork.org/en/scripts/483035-youtube-transcript-copier/code) - Confirmed `ytd-engagement-panel-section-list-renderer` for YouTube's native transcript, `#primary-button > ytd-button-renderer` for controls
- [Tabview YouTube userscript](https://greasyfork.org/en/scripts/428651-tabview-youtube) - Confirmed `ytd-comments#comments` selector for comments section
- Multiple YouTube userstyles (UserStyles.world) - Confirmed `#below`, `#primary`, `ytd-watch-flexy` hierarchy
- [Blob download pattern](https://gist.github.com/bennadel/60ce9df15659e71a441ae5c12860cd64) - `URL.createObjectURL` + anchor download pattern for text files

### Tertiary (LOW confidence)
- YouTube `#below` container child ordering (description before comments) -- inferred from multiple CSS-targeting sources but not independently verified against current YouTube DOM. Verify with DevTools during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies needed; all tools (WXT, messaging, storage, Clipboard API) are documented and already in use
- Architecture: HIGH - Extends existing patterns (second Shadow DOM UI, same message-passing, same format utilities). Codebase is well-understood.
- YouTube DOM selectors: MEDIUM - Multiple independent sources confirm `ytd-watch-metadata` and `#below` hierarchy, but YouTube can change at any time. Must verify with DevTools.
- Pitfalls: HIGH - Each pitfall is grounded in actual code patterns observed in the codebase or documented browser API limitations

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days; WXT and Chrome APIs are stable; YouTube DOM may change)
