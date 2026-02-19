# Pitfalls Research

**Domain:** Chrome Extension (Manifest V3) + AI Summaries for YouTube — Added to Existing Next.js/Vercel App
**Researched:** 2026-02-18
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Content Scripts Cannot Make Cross-Origin Requests

**What goes wrong:**
The content script (injected into youtube.com) tries to `fetch()` the TranscriptGrab API at a different domain. The request fails with a CORS error or is blocked outright. Developers assume `host_permissions` in the manifest fixes this for content scripts — it does not.

**Why it happens:**
In Manifest V3, content scripts run in an "isolated world" but are subject to the same CORS rules as the host page. `host_permissions` bypasses CORS only for the extension service worker, not for content scripts. Cross-origin requests from content scripts are explicitly being restricted further as the MV3 spec matures. The official Chrome docs state: "Cross-origin requests are always treated as such in content scripts, even if the extension has host permissions."

**How to avoid:**
Use message passing: the content script sends a message to the service worker, the service worker makes the API fetch (which is exempt from CORS via `host_permissions`), then passes the response back.

```
content script -> chrome.runtime.sendMessage() -> service worker -> fetch(API) -> response -> content script
```

Declare the API domain in `host_permissions`:
```json
"host_permissions": ["https://transcriptgrab.vercel.app/*"]
```

**Warning signs:**
- `Access-Control-Allow-Origin` errors in extension console on youtube.com
- Fetch works in service worker but not content script
- Assuming `host_permissions` alone fixes content script fetches

**Phase to address:**
Phase 1 (Extension Foundation) — Establish the message-passing architecture before writing any fetch logic. Get it wrong here and everything downstream breaks.

---

### Pitfall 2: YouTube SPA Navigation Breaks Content Script Injection

**What goes wrong:**
The extension UI appears correctly on the first YouTube page load, but disappears or never appears when the user navigates to another video by clicking a related video or the search results. YouTube is a SPA: it swaps page content without a full navigation, so Chrome never re-runs the content script.

**Why it happens:**
Chrome re-injects content scripts only on full page navigations. YouTube uses `history.pushState()` to transition between pages — the URL changes, the page content changes, but there is no hard navigation. The content script's `run_at: document_idle` has already fired and will not fire again.

**How to avoid:**
Listen for YouTube's own navigation event from within the content script:
```javascript
document.addEventListener('yt-navigate-finish', () => {
  injectExtensionUI()
})
```
Also use a `MutationObserver` as a fallback to watch for the `#secondary` or `#below` container that appears when a video page loads. Clean up injected UI before re-injecting to avoid duplicates.

As a belt-and-suspenders approach, also add `chrome.webNavigation.onHistoryStateUpdated` in the service worker to send a message to the content script on URL change.

**Warning signs:**
- Extension UI appears on the first video but not after navigating to another video
- Extension UI appears fine after a hard refresh (F5) but not when clicking YouTube links
- UI showing multiple times (duplicate injection without cleanup)

**Phase to address:**
Phase 1 (Extension Foundation) — Write and test the navigation lifecycle handler before building any UI. Test by clicking through 5+ videos without reloading.

---

### Pitfall 3: Service Worker Terminates, Losing In-Progress State

**What goes wrong:**
The extension service worker stops a long-running Gemini API request mid-stream, or loses track of which tab is waiting for a summary because the service worker was terminated and restarted by Chrome during the request.

**Why it happens:**
MV3 service workers are not persistent. Chrome suspends them after 30 seconds of inactivity and kills them after a maximum of 5 minutes of active work. Global JavaScript variables (maps, objects, flags) stored in the service worker are wiped on restart. Timers set with `setTimeout` are also canceled on termination.

**How to avoid:**
- Never store critical state in global service worker variables. Use `chrome.storage.session` (cleared on browser close) or `chrome.storage.local` (persistent) for request state.
- For Gemini requests: use a request ID stored in `chrome.storage.session`. On restart, the content script can check if its request is still pending.
- Register all event listeners synchronously at the top level of the service worker, not inside callbacks or Promises. Asynchronously registered listeners will not be present if the service worker restarts.
- Use `chrome.alarms` instead of `setTimeout`/`setInterval` for recurring work.

**Warning signs:**
- "The service worker has been terminated" messages in chrome://extensions
- Summary requests that hang forever without completing
- Global state that resets unexpectedly mid-operation
- `chrome.runtime.lastError` about closed message channels

**Phase to address:**
Phase 1 (Extension Foundation) — Design storage strategy upfront. Phase 2 (AI Summaries) — Handle streaming Gemini responses with proper timeout/retry logic accounting for service worker lifecycle.

---

### Pitfall 4: Remote Code Execution Prohibition Blocks Dynamic Functionality

**What goes wrong:**
Any attempt to dynamically execute code strings (via built-in language features that evaluate code at runtime) or inject `<script>` tags pointing to external URLs causes Chrome to reject the extension at review or at runtime. This also means no loading AI libraries or prompt templates from a CDN at runtime.

**Why it happens:**
MV3's most fundamental security change bans remotely hosted code. Any executable JavaScript must be bundled inside the extension package. This is a hard wall — there are no exceptions, even with user consent. Extensions violating this are rejected from the Chrome Web Store and will throw CSP errors at runtime. The `unsafe-eval` CSP directive is also disallowed.

**How to avoid:**
- Bundle all JavaScript. Use Vite, Rollup, or webpack with a Chrome extension plugin (e.g., `crxjs/vite-plugin`).
- Do not load AI SDK from a CDN `<script>` tag. Install `@google/generative-ai` as a bundled npm dependency.
- Server-side prompt logic: if prompt templates need to change without a new extension release, keep them in the Next.js API route (server-side), not in the extension.
- Avoid all runtime code-from-string patterns — use `JSON.parse()` for data parsing instead.

**Warning signs:**
- CSP errors mentioning `unsafe-eval` in extension console
- Extension submission rejected with "remote code execution" reason
- Any `fetch()` call that loads JavaScript and then executes it

**Phase to address:**
Phase 1 (Extension Foundation) — Set up bundler before writing any code. Confirm bundler outputs are self-contained.

---

### Pitfall 5: Gemini API Free Tier Rate Limits Are Extremely Low

**What goes wrong:**
The extension works fine during solo development, then breaks for real users at low traffic. Free tier Gemini API limits were drastically cut in December 2025 — from 250 RPD to 20 RPD for Gemini Flash (a 92% reduction). Multiple users requesting summaries simultaneously hits the limit within minutes.

**Why it happens:**
Google reduced free tier quotas substantially. Current limits (as of January 2026):
- Free tier: 5-15 RPM depending on model, approximately 20 RPD for Flash
- Tier 1 (paid): 150-300 RPM

If the extension calls the Gemini API directly from each user's browser using a shared API key, every user burns from the same quota.

**How to avoid:**
- Route all Gemini calls through the TranscriptGrab Vercel API endpoint — never expose the API key in the extension bundle.
- Implement caching: if the same video has been summarized before, return the cached result from the database. This prevents redundant API calls for popular videos.
- Add rate limiting per user in the API route.
- Upgrade to Gemini Tier 1 (paid) before launch — free tier is insufficient for any real user base.
- Display a clear "Generating..." state and handle `429 Too Many Requests` gracefully with retry logic and user messaging.

**Warning signs:**
- 429 errors appearing during testing with more than a few users
- `RESOURCE_EXHAUSTED` errors from the Gemini API
- Summaries failing for some users but not others (quota contention)

**Phase to address:**
Phase 2 (AI Summaries) — Design caching and proxy architecture before exposing to users. Never call Gemini directly from the extension.

---

### Pitfall 6: Gemini Safety Filters Block Legitimate YouTube Content

**What goes wrong:**
Summaries fail for videos discussing news events, politics, controversial topics, or anything Gemini classifies as potentially harmful. The API returns a `SAFETY` block finish reason with no usable output. Users see an error for content that is completely legitimate.

**Why it happens:**
Gemini has configurable safety filters across categories: `HARM_CATEGORY_HARASSMENT`, `HARM_CATEGORY_HATE_SPEECH`, `HARM_CATEGORY_SEXUALLY_EXPLICIT`, `HARM_CATEGORY_DANGEROUS_CONTENT`, and `HARM_CATEGORY_CIVIC_INTEGRITY`. Some filters became harder to configure after a Gemini 2.5 Pro update in May 2025 that broke control over safety settings. Transcripts containing politically charged language, weapons discussions, or medical content can trigger filters even when the source video is entirely benign.

**How to avoid:**
- Catch `finishReason === 'SAFETY'` and return a user-friendly message: "Summary unavailable for this video's content."
- Adjust safety thresholds to `BLOCK_ONLY_HIGH` for non-children categories where permitted.
- Add a system prompt that frames the task clearly: "You are summarizing a YouTube video transcript for educational purposes. Provide a factual summary."
- Test against a range of video categories: news, cooking, gaming, politics, medical, finance.
- Monitor `promptFeedback.blockReason` to log which categories trigger blocks.

**Warning signs:**
- `finishReason: 'SAFETY'` in Gemini responses
- Summaries failing for news or political content
- `promptFeedback.safetyRatings` showing HIGH probability ratings

**Phase to address:**
Phase 2 (AI Summaries) — Test with diverse video categories before shipping. Build error handling before building the happy path.

---

### Pitfall 7: Chrome Web Store Review Rejects for Overly Broad Permissions

**What goes wrong:**
The Chrome Web Store review team rejects the extension for requesting permissions that appear excessive for the stated functionality. Common triggers: requesting `<all_urls>` host access when only YouTube is needed, requesting `tabs` when `activeTab` suffices, or requesting broad storage access without justification.

**Why it happens:**
Over 52% of Chrome Web Store rejections stem from improper permission settings. Reviewers flag permissions that appear beyond what the extension's stated purpose requires. Extensions must also justify "why" they need each sensitive permission in the store listing description.

**How to avoid:**
- Use `activeTab` instead of `tabs` when only needing the current tab's URL.
- Restrict `host_permissions` to exactly the domains needed:
  ```json
  "host_permissions": [
    "https://www.youtube.com/*",
    "https://transcriptgrab.vercel.app/*"
  ]
  ```
- Never request `<all_urls>` unless truly required.
- For each sensitive permission in the manifest, add a corresponding explanation in the store listing's privacy and permissions section.
- Use `optional_permissions` for features that are not core to the extension, requesting them at runtime via `chrome.permissions.request()`.

**Warning signs:**
- Requesting `tabs` when only needing the URL of the current active tab
- Using `"*://*/*"` as a match pattern
- Permissions listing longer than 3-4 items for a single-purpose extension
- Store listing description not mentioning why each permission is needed

**Phase to address:**
Phase 3 (Publishing) — Audit permissions as the final step before submission. Do a "permission justification review" where each permission maps to a specific feature.

---

### Pitfall 8: Chrome Web Store Review Delays and Policy Ambiguity

**What goes wrong:**
Initial submission gets stuck in review for 1-4 weeks. Re-submissions after changes can add another 1-2 weeks each. Extension gets rejected for vague policy reasons like "does not comply with developer policies" without specific guidance.

**Why it happens:**
The Chrome Web Store review process is automated first, then manual. Extensions that interact with YouTube (a Google property) or use AI APIs receive heightened scrutiny. Review times average 7-14 days for new submissions. Rejection notices are often generic, requiring developers to guess the exact violation.

**How to avoid:**
- Read the Chrome Web Store Developer Program Policies in full before submitting.
- Include a detailed description of what the extension does, which permissions it uses, and why — reviewers read this.
- Record a short video demonstrating functionality (helps reviewers understand the extension faster).
- Avoid keyword stuffing in the store listing name/description.
- Privacy policy is required — host it at a stable URL before submission.
- Submit early in the development timeline, not the day before planned launch. Buffer at least 3 weeks.

**Warning signs:**
- Submission with minimal store description
- No privacy policy URL
- Extension name or description containing competitor names or generic terms ("best YouTube extension")
- Launching without accounting for review time in schedule

**Phase to address:**
Phase 3 (Publishing) — Start the store listing preparation in parallel with final development, not after.

---

### Pitfall 9: Auth Session Cannot Be Read Across Domains

**What goes wrong:**
The extension's content script (on youtube.com) or service worker needs to know if the user is logged into TranscriptGrab to show personalized features or save summaries to their account. Reading the auth session cookie directly from the extension fails because the cookie is scoped to the TranscriptGrab domain.

**Why it happens:**
Browser security prevents extensions from reading `HttpOnly` session cookies set by a different domain. Even if the extension has `host_permissions` for the TranscriptGrab domain, `HttpOnly` cookies are specifically inaccessible to JavaScript. Chrome extensions can read non-HttpOnly cookies via `chrome.cookies.get()`, but NextAuth sets cookies as `HttpOnly` by default.

**How to avoid:**
- Add a dedicated `/api/auth/session` endpoint (Next.js already has this via NextAuth) that the extension service worker calls. It returns the session JSON if the user is authenticated, or `null` if not.
- For this to work cross-origin from the extension service worker: configure the NextAuth cookie as `sameSite: 'none'` and `secure: true` in production, and ensure the API endpoint returns proper CORS headers for the extension's origin (`chrome-extension://[id]`).
- Cache the session check result in `chrome.storage.session` — do not check on every single action.
- Alternatively, implement a token-based auth flow where the user explicitly connects the extension to their TranscriptGrab account (similar to OAuth device flow).

**Warning signs:**
- `chrome.cookies.get()` returning null for the session cookie
- Extension service worker getting 401 from TranscriptGrab API despite user being logged in
- Session cookie present in browser but inaccessible to extension

**Phase to address:**
Phase 1 (Extension Foundation) — Decide auth approach (session endpoint vs token flow) before building any auth-dependent features.

---

### Pitfall 10: YouTube DOM Structure Changes Break Injection Targets

**What goes wrong:**
The content script injects the extension UI into a specific CSS selector (e.g., `#secondary`, `#below`, `.ytd-watch-metadata`). YouTube's A/B testing and frequent UI redesigns change these selectors without warning, causing the extension UI to either not appear or appear in the wrong location.

**Why it happens:**
YouTube actively A/B tests UI layouts. Different users see different DOM structures simultaneously. The HTML element IDs that exist today (`#secondary-inner`, `#info-contents`) may not exist tomorrow, and the same user may see different layouts on different days. Extensions that hardcode a single injection target will break.

**How to avoid:**
- Use multiple fallback selectors in priority order:
  ```javascript
  const INJECTION_TARGETS = [
    '#secondary-inner',
    '#secondary',
    '#below',
    'ytd-watch-flexy #columns'
  ]
  function findInjectionTarget() {
    return INJECTION_TARGETS.map(s => document.querySelector(s)).find(Boolean)
  }
  ```
- Use `MutationObserver` to wait for the target to appear (it may not exist immediately after navigation).
- Add monitoring/error reporting so you know when injection fails.
- Design the UI to degrade gracefully if the injection point is not found (e.g., fall back to a floating panel using `position: fixed`).

**Warning signs:**
- Extension UI not appearing for some users but working for others
- Reports of extension breaking after YouTube site updates
- `document.querySelector()` returning null for selectors that previously worked

**Phase to address:**
Phase 1 (Extension Foundation) — Build the injection logic with multiple fallbacks from the start.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Calling Gemini directly from extension (exposing API key) | Simpler architecture | API key exposed in bundle, quota shared across all users | Never |
| Hardcode single YouTube DOM selector | Fast injection setup | Breaks when YouTube redesigns | Never — always use fallback list |
| Store state in service worker globals | Simple code | State lost on service worker restart | Never for cross-request state |
| Register all host_permissions with all_urls wildcard | Works everywhere | Chrome Web Store rejection | Never |
| Skip YouTube navigation event handling | Works on page load | UI disappears after SPA navigation | Never |
| No caching for AI summaries | Simpler API route | Repeated quota consumption for same video | Only during early dev before launch |
| Bundle Gemini SDK in extension | Avoids proxy setup | Cannot update prompts without new extension release | Acceptable if prompts are stable |
| Single shared API key in server-side only | Simpler key management | No per-user rate limiting | Acceptable at small scale with server-side rate limiting |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Gemini API | Calling from content script with key in bundle | Proxy via Vercel API route — key never leaves server |
| Gemini API | Not handling `finishReason: 'SAFETY'` | Check finish reason before rendering, show friendly fallback |
| YouTube DOM | Injecting at `document_idle` without nav listener | Listen for `yt-navigate-finish` and re-inject |
| YouTube DOM | Single CSS selector for injection point | Priority list of 3-4 fallback selectors |
| NextAuth sessions | `chrome.cookies.get()` for HttpOnly session cookie | Call `/api/auth/session` from service worker |
| NextAuth sessions | Forgetting CORS headers for `chrome-extension://` origin | Add extension origin to CORS allowlist in Next.js config |
| Chrome Storage | Using service worker global variables for state | `chrome.storage.session` (ephemeral) or `chrome.storage.local` (persistent) |
| Chrome Messaging | Registering message listeners inside async callbacks | Register all listeners synchronously at top level of service worker |
| Vercel CORS | Missing `chrome-extension://[id]` in allowed origins | Wildcard `chrome-extension://*` or specific extension ID |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No summary caching | Gemini quota exhausted, repeated costs | Cache by video ID in database | After 20 unique videos (free tier) |
| Fetching transcript + summary on every page load | Slow extension UI, unnecessary API calls | Check cache first, lazy-load on button click | Immediately on launch |
| MutationObserver with `subtree: true` on `document.body` | High CPU on YouTube (heavy DOM changer) | Scope observer to specific container, debounce callback | Continuous YouTube browsing |
| Unregistered MutationObservers on navigation | Memory leak, accumulating observers | Disconnect observer before re-injecting on navigation | After 5+ video navigations |
| Content script fetch with fallback retries | Silent CORS failures wasting time | Route all fetches through service worker via messaging | Every request |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Bundling Gemini API key in extension | Key exposed via devtools inspection of extension bundle | Proxy all AI calls through server-side API route |
| Using `innerHTML` with transcript content | XSS from malformed transcript data | Use `textContent` or sanitize with DOMPurify before inject |
| Accepting arbitrary URLs from content script messages | SSRF via crafted messages | Validate all incoming message data in service worker; only accept video IDs, not URLs |
| No extension ID allowlisting in Vercel API | Any extension can call your API endpoints | Check `Origin` header matches your published extension ID |
| Logging full transcript content to console | PII exposure in shared machines | Remove all debug logging of transcript content before production build |
| `sameSite: None` cookie without `Secure` flag | Cookie sent over HTTP | Always pair `sameSite: None` with `secure: true` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing extension panel on every YouTube page, not just videos | Cluttered UI on homepage/search | Only inject when `window.location.pathname` matches `/watch` |
| No loading state during summary generation | Appears frozen, users click multiple times | Show skeleton/spinner immediately, disable button during generation |
| Displaying raw Gemini errors to users | Confusing technical messages | Map error types to friendly messages ("Summary unavailable for this video") |
| Extension UI that blocks video playback controls | Users cannot interact with video | Position injection point below video controls, not over them |
| No sign-in prompt for unauthenticated users | Features silently fail | Show "Sign in to save summaries" CTA when session check returns null |
| Summary panel auto-opening on every video load | Annoying for users who did not request it | Only generate summary when user explicitly clicks "Summarize" |

## "Looks Done But Isn't" Checklist

- [ ] **SPA Navigation:** Extension UI appears after clicking related videos — not just on hard load
- [ ] **Service Worker State:** Extension works after Chrome suspends and restarts the service worker (test by navigating away and back)
- [ ] **CORS Routing:** All API calls go through service worker message passing, not direct content script fetch
- [ ] **Gemini Safety:** Error handling covers `finishReason: 'SAFETY'` with user-friendly message
- [ ] **Rate Limits:** 429 responses from Gemini API show retry/wait message, not blank screen
- [ ] **Permission Scope:** `host_permissions` lists only YouTube and TranscriptGrab — no wildcard all-sites permission
- [ ] **Remote Code:** No dynamic code execution from strings, no external JS loading — verified in bundle output
- [ ] **Privacy Policy:** Hosted at stable public URL before Chrome Web Store submission
- [ ] **Duplicate Injection:** UI does not appear multiple times when navigating between videos rapidly
- [ ] **Auth Cross-Domain:** Session check works via `/api/auth/session` endpoint, not cookie reading
- [ ] **DOM Fallbacks:** Injection works with at least 3 different YouTube layout variants

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| API key exposed in extension bundle | HIGH | Rotate key immediately, release new extension version, revoke old key |
| Content script CORS failures at launch | HIGH | Release new version routing fetches through service worker — requires new store review |
| YouTube DOM selectors break | MEDIUM | Release new version with updated selectors — 1-2 week review cycle to reach users |
| Gemini quota exhausted | LOW | Upgrade to paid tier, implement caching — server-side change, no extension update needed |
| Chrome Web Store rejection | MEDIUM | Read rejection reason, fix specific issue, resubmit — adds 1-2 weeks to timeline |
| Service worker state loss | LOW | Move state to `chrome.storage.session`, release update |
| Safety filter false positives | LOW | Adjust safety thresholds in API route, server-side change, no extension update needed |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Content script CORS | Phase 1 (Extension Foundation) | Service worker sends request, content script receives response — no direct fetch |
| YouTube SPA navigation | Phase 1 (Extension Foundation) | Click through 5+ videos without reloading; UI appears on each |
| Service worker state loss | Phase 1 (Extension Foundation) | Suspend service worker manually; extension recovers on next interaction |
| Remote code execution ban | Phase 1 (Extension Foundation) | Bundle output analyzed — no external script loading |
| Auth cross-domain session | Phase 1 (Extension Foundation) | Session endpoint returns user data when logged into web app |
| YouTube DOM selector brittleness | Phase 1 (Extension Foundation) | UI injection tested on multiple YouTube layout variants |
| Gemini rate limits | Phase 2 (AI Summaries) | Caching in place; repeated requests for same video do not hit API |
| Gemini safety filters | Phase 2 (AI Summaries) | Test against news, politics, medical, gaming videos; all show result or friendly error |
| API key exposure | Phase 2 (AI Summaries) | Inspect extension bundle — Gemini key absent; all calls proxy through Vercel |
| Overly broad permissions | Phase 3 (Publishing) | Manifest permission list reviewed; each item has store listing justification |
| Web Store review delays | Phase 3 (Publishing) | Submission made 3+ weeks before target launch; privacy policy URL live |
| Store policy violations | Phase 3 (Publishing) | Run through Chrome Extension rejection checklist before first submission |

## Sources

### Chrome Extension Manifest V3
- [Chrome Extensions: What is Manifest V3?](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Cross-Origin Network Requests in Extensions](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Common Manifest File Issues](https://moldstud.com/articles/p-top-10-common-manifest-file-issues-for-chrome-extensions-and-how-to-fix-them)
- [Service Worker Suspension Testing (eyeo blog)](https://developer.chrome.com/blog/eyeos-journey-to-testing-mv3-service%20worker-suspension)

### YouTube SPA Navigation
- [Content Script Won't Run Until Refresh on YouTube (Chromium Group)](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/32lLHYjQUQQ)
- [Making Chrome Extension Smart for SPA Websites (Medium)](https://medium.com/@softvar/making-chrome-extension-smart-by-supporting-spa-websites-1f76593637e8)
- [WXT Framework: Content Scripts with SPA Support](https://wxt.dev/guide/essentials/content-scripts.html)

### Gemini API
- [Gemini API Rate Limits (Official)](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API Safety Settings](https://ai.google.dev/gemini-api/docs/safety-settings)
- [Gemini Update Breaks Content Filters (The Register, May 2025)](https://www.theregister.com/2025/05/08/google_gemini_update_prevents_disabling/)
- [Gemini API Rate Limits Complete Guide 2026](https://blog.laozhang.ai/en/posts/gemini-api-rate-limits-guide)

### Chrome Web Store Publishing
- [Chrome Web Store Review Process](https://developer.chrome.com/docs/webstore/review-process/)
- [Why Chrome Extensions Get Rejected (Extension Radar)](https://www.extensionradar.com/blog/chrome-extension-rejected)
- [Chrome Web Store Rejection Codes](https://www.coditude.com/insights/chrome-web-store-rejection-codes/)

### Auth and CORS
- [Chrome Extension + NextAuth Integration (Discussion)](https://github.com/nextauthjs/next-auth/discussions/8045)
- [Cross-Origin Requests: Content Script Changes (Chromium Security)](https://www.chromium.org/Home/chromium-security/extension-content-script-fetches/)
- [CORS in Chrome Extensions (Reintech)](https://reintech.io/blog/cors-chrome-extensions)
- [Manifest V3 CORS Issue (Chromium Group)](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/IY_g501CekI)

---
*Pitfalls research for: Chrome Extension (Manifest V3) + Gemini AI Summaries added to TranscriptGrab*
*Researched: 2026-02-18*
