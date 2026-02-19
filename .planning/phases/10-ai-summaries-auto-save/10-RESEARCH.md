# Phase 10: AI Summaries + Auto-Save - Research

**Researched:** 2026-02-19
**Domain:** Gemini API integration (server-side summarization), extension UI tabbed layout, two-tier summary caching, authenticated transcript auto-save from Chrome extension
**Confidence:** HIGH

## Summary

Phase 10 adds two major features to the extension: AI-powered transcript summaries via the Gemini API, and automatic transcript persistence for signed-in users. The summary feature requires a new `/api/summarize` backend route that proxies Gemini calls (keeping the API key server-side), a new database table for summary caching, and a tabbed UI in the extension panel. The auto-save feature requires the background service worker to call the existing `/api/transcript/save` endpoint with proper cookie credentials after each transcript fetch. Both features are gated behind authentication -- summaries require sign-in, and auto-save is inherently auth-dependent.

The Gemini API is accessed via the `@google/genai` npm package (v1.41.0), which provides a clean `ai.models.generateContent()` API with system instruction support. Gemini 2.5 Flash is the recommended model: it has a 1,048,576 token input limit (easily handles any YouTube transcript), costs $0.30/M input tokens on paid tier (free tier available), and returns up to 65,536 output tokens. For most transcripts (under 100K tokens), no chunking is needed. For exceptionally long transcripts, a map-reduce strategy (chunk, summarize each, merge) handles the edge case. Summary caching uses a new `summaries` database table as the primary persistent store, with extension `localStorage` as a fast lookup layer that avoids network round trips.

The critical architectural insight is that the background service worker can send authenticated requests to the web app by including `credentials: 'include'` in fetch calls. Since the extension already has `host_permissions` for the web app domain, and cookies are already set by NextAuth, the browser automatically attaches the session cookie to these requests. This means the existing `/api/transcript/save` and `/api/transcript/check` endpoints work as-is -- no CORS changes needed because background service workers bypass CORS when `host_permissions` are declared.

**Primary recommendation:** Use `@google/genai` with `gemini-2.5-flash` model for summarization. Create a `/api/summarize` route that accepts videoId + transcript text, checks the `summaries` DB table for cached results, and calls Gemini only on cache miss. Store both bullet and paragraph formats in a single DB row. On the extension side, add a tabbed panel UI (Transcript/Summary tabs), a segmented control for format toggle, and fire auto-save as a background task after successful transcript fetch.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Summary presentation
- Tabbed layout: "Transcript" and "Summary" tabs in the panel
- Transcript tab is the default on panel open
- Summary tab has a toggle button (segmented control) to switch between bullet points and paragraph format
- Copy button on summary tab mirrors the transcript tab pattern

#### Summarize trigger & flow
- Summarization is gated behind sign-in -- unauthenticated users see a sign-in prompt instead of summarize
- For long transcripts exceeding Gemini's context window: chunk the transcript, summarize each chunk, merge into a single cohesive summary
- Errors (quota exceeded, API failure) shown as toast notifications, not inline in the summary tab

#### Auto-save behavior
- Auto-save triggers on transcript fetch (when user clicks the transcript button), not on panel render
- Subtle "Saved" indicator (badge/checkmark) in the panel -- not a toast, not silent
- If video already exists in history, skip silently -- don't overwrite or update timestamp
- If a summary has been generated, persist both transcript AND summary to history (available on transcriptgrab.com)

#### Summary caching
- Two-tier cache: database as primary persistent store, extension localStorage as fast lookup layer
- No regeneration option -- once a summary is cached, it stays
- No user-facing rate limit display

### Claude's Discretion

- Summary tab empty state before user requests a summary (CTA button, placeholder text, etc.)
- Global vs per-user cache scope -- pick based on architecture constraints
- Rate limiting UX approach given Gemini free tier (~20 RPD) -- backend handling vs user-facing indicator
- Loading state design for summary generation
- Exact segmented control styling for format toggle

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-01 | User can generate AI summary of the video transcript | `/api/summarize` route calls Gemini 2.5 Flash via `@google/genai` SDK. Extension sends transcript text + videoId via background service worker message. Summary tab in panel displays result. |
| AI-02 | Summary displays as bullet points (3-7 key takeaways) | System instruction to Gemini specifies "3-7 bullet point takeaways". Response parsed and rendered as `<ul>` list in the summary tab. |
| AI-03 | User can toggle between bullet points and paragraph summary | Both formats generated in a single Gemini call (system instruction requests both). Stored as separate fields in DB. Segmented control in summary tab switches between them. |
| AI-04 | Summaries proxy through backend `/api/summarize` route (Gemini key server-side only) | `GEMINI_API_KEY` environment variable on Vercel. Extension never sees the key. Background service worker calls `/api/summarize` which calls Gemini server-side. |
| AI-05 | Summaries cached by videoId to avoid redundant API calls | New `summaries` DB table with `videoId` column + unique index. `/api/summarize` checks DB first, returns cached result on hit. Extension localStorage provides fast secondary cache. |
| AUTH-02 | Transcript auto-saves to history when user is signed in | Background service worker calls `/api/transcript/check` then `/api/transcript/save` with `credentials: 'include'` after successful transcript fetch. Existing save endpoint + `onConflictDoNothing` handles duplicates. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @google/genai | ^1.41.0 | Gemini API client (server-side only) | Official Google SDK for Gemini. Clean `ai.models.generateContent()` API with system instructions. Supports all Gemini models. |
| drizzle-orm | ^0.45.1 (existing) | Database ORM for summaries table | Already used for all DB operations. Summaries table follows same pattern as transcripts table. |
| @neondatabase/serverless | ^1.0.2 (existing) | Neon PostgreSQL client | Already the DB driver. No changes needed. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| WXT built-in storage | (bundled) | Extension localStorage cache for summaries | `storage.defineItem` for caching summary results locally in extension to avoid network round trips |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @google/genai | Direct REST API calls | SDK handles auth, retries, error typing. REST is more manual but fewer dependencies. SDK is small and official. |
| gemini-2.5-flash | gemini-2.0-flash | 2.0-flash is cheaper ($0.10 vs $0.30/M input) but 2.5-flash has better reasoning quality and 65K output limit vs 8K. For summarization quality, 2.5-flash is worth the marginal cost. |
| gemini-2.5-flash | gemini-2.5-flash-lite | Flash-lite is the cheapest option with highest free tier RPD (1000/day) but lower quality. Could be a fallback if rate limits are hit. |
| DB-primary cache | Gemini context caching | Gemini's built-in caching has a 2,048 token minimum, costs per hour of TTL, and requires file uploads. Our use case is simpler: cache the output, not the input. DB cache is permanent and free. |
| Global summary cache | Per-user summary cache | Global cache means one user's summary benefits all users for the same video. Since summaries are deterministic for the same transcript, global caching is safe and vastly more efficient. |

**Installation:**
```bash
# In the web app root (not extension)
npm install @google/genai
```

## Architecture Patterns

### Recommended Project Structure

New/modified files only:
```
# Web app (new files)
app/api/summarize/route.ts          # NEW: Summarize API endpoint
lib/db/schema.ts                     # MODIFIED: Add summaries table
lib/db/queries.ts                    # MODIFIED: Add summary queries

# Extension (modified files)
extension/entrypoints/background/index.ts    # MODIFIED: Add summarize + auto-save handlers
extension/entrypoints/youtube.content/panel.ts  # MODIFIED: Tabbed layout, summary tab
extension/entrypoints/youtube.content/style.css # MODIFIED: Tab styles, summary styles
extension/utils/messaging.ts                    # MODIFIED: Add summarize + save message types
extension/utils/types.ts                        # MODIFIED: Add summary types
```

### Pattern 1: Summarize API Route with DB Cache
**What:** Backend route that checks DB cache first, calls Gemini on miss, stores result, returns both formats
**When to use:** Every summarize request from the extension

```typescript
// app/api/summarize/route.ts
import { GoogleGenAI } from '@google/genai';
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getSummaryByVideoId, saveSummary } from '@/lib/db/queries';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const POST = auth(async function POST(req) {
  // Require authentication
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { videoId, transcriptText } = await req.json();
  if (!videoId || !transcriptText) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Check DB cache first (global, not per-user)
  const cached = await getSummaryByVideoId(videoId);
  if (cached) {
    return NextResponse.json({
      success: true,
      data: { bullets: cached.bullets, paragraph: cached.paragraph },
    });
  }

  // Call Gemini
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: transcriptText,
    config: {
      systemInstruction: `You are a transcript summarizer. Given a YouTube video transcript, produce TWO summaries:

1. BULLETS: 3-7 key takeaway bullet points. Each bullet should be a single concise sentence capturing a distinct main point. Use "- " prefix for each bullet.

2. PARAGRAPH: A cohesive 3-5 sentence paragraph summary covering the main topics and conclusions.

Format your response EXACTLY as:
BULLETS:
- [point 1]
- [point 2]
...

PARAGRAPH:
[paragraph text]`,
    },
  });

  // Parse response into bullets and paragraph
  const text = response.text ?? '';
  const { bullets, paragraph } = parseSummaryResponse(text);

  // Store in DB (global cache)
  await saveSummary({ videoId, bullets, paragraph });

  return NextResponse.json({
    success: true,
    data: { bullets, paragraph },
  });
});
```

### Pattern 2: Summaries Database Table (Global Cache)
**What:** New `summaries` table indexed by videoId for global caching
**When to use:** Persisting summary results to avoid redundant Gemini calls

```typescript
// Addition to lib/db/schema.ts
export const summaries = pgTable(
  'summaries',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    videoId: text('videoId').notNull(),
    bullets: text('bullets').notNull(),    // Markdown bullet list
    paragraph: text('paragraph').notNull(), // Paragraph text
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (summary) => [
    uniqueIndex('summary_video_idx').on(summary.videoId),
  ]
);
```

**Recommendation: Global scope (not per-user).** Summaries are deterministic for a given transcript. Global caching means the first user to summarize a video benefits all subsequent users. This dramatically reduces Gemini API calls, which is critical given the free tier limits (250 RPD for 2.5 Flash). Per-user caching would waste API calls regenerating identical summaries.

### Pattern 3: Two-Tier Cache (DB + Extension localStorage)
**What:** Extension stores summary results in localStorage as a fast lookup layer before hitting the network
**When to use:** When user opens the summary tab for a video they have previously summarized

```typescript
// Extension-side cache using WXT storage
const summaryCache = storage.defineItem<Record<string, SummaryData>>(
  'local:summaryCache',
  { fallback: {} }
);

async function getCachedSummary(videoId: string): Promise<SummaryData | null> {
  const cache = await summaryCache.getValue();
  return cache[videoId] ?? null;
}

async function setCachedSummary(videoId: string, data: SummaryData): Promise<void> {
  const cache = await summaryCache.getValue();
  cache[videoId] = data;
  await summaryCache.setValue(cache);
}
```

### Pattern 4: Auto-Save with Authenticated Fetch
**What:** Background service worker saves transcript to history after successful fetch
**When to use:** Every time a signed-in user fetches a transcript

```typescript
// In background/index.ts, after successful transcript fetch
async function autoSaveTranscript(
  videoId: string,
  transcript: TranscriptResponse,
  metadata: VideoMetadata | undefined
): Promise<boolean> {
  try {
    // Check if already saved
    const checkRes = await fetch(
      `${apiBase}/api/transcript/check?videoId=${videoId}`,
      { credentials: 'include' }
    );
    const checkData = await checkRes.json();
    if (checkData.exists) return false; // Already saved, skip silently

    // Save transcript
    const saveRes = await fetch(`${apiBase}/api/transcript/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        videoId,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        videoTitle: metadata?.title ?? 'Unknown video',
        thumbnailUrl: null,
        videoDuration: null,
        segments: transcript.segments,
      }),
    });

    return saveRes.ok;
  } catch {
    return false; // Auto-save is best-effort
  }
}
```

**Critical detail:** `credentials: 'include'` causes the browser to attach the NextAuth session cookie to the request. Since the extension has `host_permissions` for the web app domain, this works without CORS issues -- background service workers with host_permissions bypass CORS entirely.

### Pattern 5: Tabbed Panel Layout
**What:** Replace the current single-content panel with a two-tab layout (Transcript / Summary)
**When to use:** Panel creation in `panel.ts`

The tab bar sits in the panel header below the video info. The transcript tab is the default active tab. The summary tab shows different content based on auth state:
- **Signed in, no summary yet:** CTA button "Summarize this video" with a brief description
- **Signed in, loading:** Spinner with "Generating summary..." text
- **Signed in, summary cached:** Summary content with format toggle
- **Not signed in:** Sign-in prompt (same pattern as the existing banner)

```typescript
// Tab structure in panel.ts
const tabBar = document.createElement('div');
tabBar.className = 'tg-tab-bar';

const transcriptTab = document.createElement('button');
transcriptTab.className = 'tg-tab tg-tab-active';
transcriptTab.textContent = 'Transcript';

const summaryTab = document.createElement('button');
summaryTab.className = 'tg-tab';
summaryTab.textContent = 'Summary';

// Tab click handlers switch active tab and show/hide content
transcriptTab.addEventListener('click', () => {
  transcriptTab.classList.add('tg-tab-active');
  summaryTab.classList.remove('tg-tab-active');
  transcriptContent.style.display = '';
  summaryContent.style.display = 'none';
});
```

### Pattern 6: Segmented Control for Summary Format
**What:** A pill-style segmented control to toggle between bullet and paragraph format
**When to use:** Inside the summary tab when a summary exists

```css
/* Segmented control styling */
.tg-format-toggle {
  display: inline-flex;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.tg-format-option {
  padding: 4px 12px;
  border: none;
  background: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  color: inherit;
}

.tg-format-option.tg-format-active {
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tg-dark .tg-format-toggle {
  background: rgba(255, 255, 255, 0.1);
}

.tg-dark .tg-format-option.tg-format-active {
  background: rgba(255, 255, 255, 0.15);
}
```

### Pattern 7: Updated Message Protocol
**What:** Add new message types for summarize and auto-save operations
**When to use:** Extension messaging protocol in `utils/messaging.ts`

```typescript
// Updated ProtocolMap
interface SummaryResponse {
  success: boolean;
  data?: { bullets: string; paragraph: string };
  error?: string;
}

interface SaveResult {
  saved: boolean;
}

interface ProtocolMap {
  getTranscript(data: { videoId: string; languageCode?: string }): TranscriptResponse;
  checkAuth(): { isSignedIn: boolean };
  summarize(data: { videoId: string; transcriptText: string }): SummaryResponse;
  autoSave(data: { videoId: string }): SaveResult;
}
```

### Anti-Patterns to Avoid
- **Sending the Gemini API key to the extension:** The key must stay server-side in the `/api/summarize` route. The extension sends transcript text to the backend, never calls Gemini directly.
- **Per-user summary caching:** Summaries are deterministic for a given transcript. Global cache by videoId is correct. Per-user caching wastes Gemini quota regenerating identical content.
- **Blocking transcript display on auto-save:** Auto-save is fire-and-forget. The panel should render immediately after transcript fetch. Save result (success/failure) is communicated via a subtle indicator, not by blocking the UI.
- **Calling Gemini for both formats separately:** Request both bullet and paragraph formats in a single prompt. One API call, two outputs. Halves the Gemini usage.
- **Using Gemini context caching for summary caching:** Gemini's context caching is for caching input tokens (e.g., a large document you query multiple times). Our use case is caching output -- the summary result. DB storage is simpler, permanent, and free.
- **Making auto-save fire on panel render:** The user decision explicitly states auto-save triggers on transcript fetch, not panel render. This means it fires once per click, not on every panel open/close cycle.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gemini API client | Raw REST calls to generativelanguage.googleapis.com | `@google/genai` SDK | Handles auth headers, error types, retries. Official and maintained. |
| Summary text parsing | Complex regex for bullet/paragraph extraction | Structured system instruction with delimiter parsing | Tell Gemini to use `BULLETS:` and `PARAGRAPH:` delimiters. Simple `split()` + `trim()` is reliable. |
| DB migration | Manual SQL ALTER TABLE | `drizzle-kit push` or `drizzle-kit generate` + `drizzle-kit migrate` | Already the project's migration workflow. Generates type-safe schema changes. |
| Token counting for chunking | Character-count heuristic | `ai.models.countTokens()` from @google/genai | Accurate token count for deciding if chunking is needed. Free API call. |
| Extension localStorage API | Raw `chrome.storage.local` | WXT `storage.defineItem<T>()` | Type-safe, auto-imported, consistent with existing code pattern. |

**Key insight:** The Gemini SDK handles the hardest parts (auth, error handling, streaming). The existing codebase handles the second hardest part (auth-gated API routes, DB operations, extension messaging). This phase is mostly wiring existing patterns together with a new API route and UI tab.

## Common Pitfalls

### Pitfall 1: Gemini API Key Exposed in Extension Bundle
**What goes wrong:** API key leaks to client-side code, gets abused.
**Why it happens:** Developer puts `GEMINI_API_KEY` in the extension's environment or makes direct Gemini calls from the background service worker.
**How to avoid:** The key lives ONLY in the web app's Vercel environment variables. The `/api/summarize` route accesses it via `process.env.GEMINI_API_KEY`. The extension calls `/api/summarize`, never Gemini directly.
**Warning signs:** Any import of `@google/genai` in the extension directory. The SDK should only be imported in `app/api/summarize/`.

### Pitfall 2: Auto-Save Fails Silently Because Cookies Not Included
**What goes wrong:** The `/api/transcript/save` endpoint returns 401 Unauthorized even though the user is signed in.
**Why it happens:** The background service worker's `fetch()` call doesn't include `credentials: 'include'`, so the NextAuth session cookie is not sent with the request.
**How to avoid:** Add `credentials: 'include'` to all authenticated fetch calls in the background service worker (save, check, summarize).
**Warning signs:** Auto-save always fails; `/api/transcript/save` logs show requests with no session cookie.

### Pitfall 3: CORS Blocking Extension Requests to Web App
**What goes wrong:** Authenticated requests from the background service worker fail with CORS errors.
**Why it happens:** If the web app adds CORS middleware that doesn't allow the chrome-extension:// origin, or if the `host_permissions` are incorrect.
**How to avoid:** Background service workers with matching `host_permissions` bypass CORS entirely -- no CORS headers needed on the server side. The current web app has no CORS middleware, which is correct. Do NOT add CORS middleware that might accidentally restrict extension requests.
**Warning signs:** Network errors in the service worker console mentioning CORS or Access-Control-Allow-Origin.

### Pitfall 4: Gemini Rate Limits Hit on Free Tier
**What goes wrong:** Users get "quota exceeded" errors when trying to summarize.
**Why it happens:** Gemini 2.5 Flash free tier allows 10 RPM and 250 RPD (reduced from higher limits in December 2025). A popular video could exhaust daily quota quickly.
**How to avoid:** Global summary caching is the primary defense -- once a video is summarized, the result is stored permanently. The `/api/summarize` route checks DB cache before calling Gemini. For production at scale, add a Vercel env var `GEMINI_API_KEY` with a paid tier key (Tier 1 provides 150 RPM, 10K RPD). Show a generic "Unable to generate summary right now" toast on 429 errors, per user decision.
**Warning signs:** 429 responses from Gemini API; increasing error rates during peak hours.

### Pitfall 5: Gemini Response Format Varies
**What goes wrong:** The parsing logic for extracting bullets and paragraph from the response breaks because Gemini doesn't follow the delimiter format exactly.
**Why it happens:** LLMs are non-deterministic. Even with clear system instructions, Gemini may occasionally vary the output format (extra newlines, different heading format, etc.).
**How to avoid:** Write a resilient parser that handles variations: look for "BULLETS:" (case-insensitive), fall back to looking for lines starting with "- " or "* ". For the paragraph, look for "PARAGRAPH:" or take everything after the bullet list. Add a fallback that treats the entire response as a paragraph if parsing fails.
**Warning signs:** Summary tab shows "Failed to generate summary" for some videos despite successful Gemini API call.

### Pitfall 6: Extension localStorage Cache Grows Unbounded
**What goes wrong:** Users who summarize many videos accumulate a large localStorage cache that slows down the extension.
**Why it happens:** No cache eviction strategy. Each summary adds ~1-2KB to localStorage.
**How to avoid:** Limit the localStorage cache to the most recent 100 entries using an LRU approach (track access timestamps, evict oldest when over limit). Alternatively, since the DB is the source of truth, the localStorage cache is just a performance optimization -- a simple size limit with full eviction is acceptable.
**Warning signs:** Slow panel open times after extensive use; `chrome.storage.local` approaching the 10MB quota.

### Pitfall 7: Auto-Save Race Condition with Panel Display
**What goes wrong:** The "Saved" indicator appears before the transcript is fully rendered, or the save fires multiple times for the same video.
**Why it happens:** Auto-save and panel rendering run concurrently. If the user toggles the panel rapidly, multiple save attempts could fire.
**How to avoid:** Use the `videoId` as a deduplication key. The existing `onConflictDoNothing` in `saveTranscript()` handles duplicate DB inserts. On the extension side, track which videoIds have been saved in the current session to avoid redundant network calls. The "Saved" indicator should only appear after a successful save response.
**Warning signs:** Multiple save requests for the same video in network logs; flickering "Saved" indicator.

### Pitfall 8: Summary Tab Content Not Cleared on Video Change
**What goes wrong:** User navigates to a new video, clicks Summary tab, sees the previous video's summary.
**Why it happens:** The summary content and localStorage cache reference the old videoId. Panel destruction on SPA navigation should clear this, but if visibility toggle is used instead, stale content persists.
**How to avoid:** The existing `destroyPanel()` on `yt-navigate-finish` already handles this -- it resets all module state. When the panel is recreated for a new video, the summary tab starts fresh (empty state or CTA). Ensure the summary tab state resets in `destroyPanel()`.
**Warning signs:** Summary text does not match the currently playing video.

## Code Examples

Verified patterns from official sources and the existing codebase:

### Gemini generateContent with System Instructions (Node.js)
```typescript
// Source: https://ai.google.dev/gemini-api/docs/text-generation
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: transcriptText,
  config: {
    systemInstruction: 'You are a transcript summarizer...',
  },
});

const summaryText = response.text;
```

### Token Counting for Chunking Decision
```typescript
// Source: https://ai.google.dev/gemini-api/docs/tokens
const tokenCount = await ai.models.countTokens({
  model: 'gemini-2.5-flash',
  contents: transcriptText,
});

const MAX_INPUT_TOKENS = 900_000; // Leave margin from 1M limit
if (tokenCount.totalTokens > MAX_INPUT_TOKENS) {
  // Use chunked summarization
  return await chunkedSummarize(transcriptText);
}
```

### Summary Response Parser
```typescript
// Parse Gemini's structured response into bullets and paragraph
function parseSummaryResponse(text: string): { bullets: string; paragraph: string } {
  const bulletMatch = text.match(/BULLETS:\s*([\s\S]*?)(?=PARAGRAPH:|$)/i);
  const paragraphMatch = text.match(/PARAGRAPH:\s*([\s\S]*?)$/i);

  const bullets = bulletMatch?.[1]?.trim() ?? '';
  const paragraph = paragraphMatch?.[1]?.trim() ?? '';

  // Fallback: if parsing fails, treat entire response as paragraph
  if (!bullets && !paragraph) {
    return { bullets: '', paragraph: text.trim() };
  }

  return { bullets, paragraph };
}
```

### Chunked Summarization (Map-Reduce)
```typescript
// For transcripts exceeding context window (extremely rare for YouTube)
async function chunkedSummarize(text: string): Promise<{ bullets: string; paragraph: string }> {
  // Split into ~500K token chunks (rough estimate: 4 chars per token)
  const chunkSize = 500_000 * 4; // characters
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  // Summarize each chunk
  const chunkSummaries = await Promise.all(
    chunks.map(async (chunk) => {
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: chunk,
        config: {
          systemInstruction: 'Summarize this transcript section in 3-5 bullet points.',
        },
      });
      return res.text ?? '';
    })
  );

  // Merge chunk summaries into final summary
  const mergedInput = chunkSummaries.join('\n\n---\n\n');
  const finalRes = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: mergedInput,
    config: {
      systemInstruction: `Given these section summaries from a single video transcript, produce a unified summary:

BULLETS:
- [3-7 key takeaway bullet points]

PARAGRAPH:
[3-5 sentence cohesive paragraph summary]`,
    },
  });

  return parseSummaryResponse(finalRes.text ?? '');
}
```

### Auto-Save Integration in Background Handler
```typescript
// Modified getTranscript handler in background/index.ts
onMessage('getTranscript', async ({ data }): Promise<TranscriptResponse> => {
  const { videoId } = data;
  // ... existing transcript fetch logic ...

  // After successful fetch, auto-save in background (non-blocking)
  if (response.success) {
    autoSaveTranscript(videoId, response.transcript!, response.metadata)
      .catch(() => {}); // Best-effort, never blocks
  }

  return response;
});
```

### Saved Indicator in Panel
```typescript
// After auto-save completes, show subtle indicator
function showSavedIndicator(headerEl: HTMLElement): void {
  const indicator = document.createElement('span');
  indicator.className = 'tg-saved-indicator';
  indicator.textContent = 'Saved';

  const checkmark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  // ... small checkmark SVG ...

  indicator.prepend(checkmark);
  headerEl.appendChild(indicator);
}
```

## Discretion Recommendations

### Summary Tab Empty State: CTA Button with Brief Description
**Recommendation:** Show a centered layout with a sparkle/AI icon, the text "Get a summary of this video", a brief subtitle "AI-generated bullet points and paragraph summary", and a prominent "Summarize" button. For unauthenticated users, replace the button with a "Sign in to summarize" link.
**Reasoning:** A clear CTA drives engagement. The description sets expectations for what the user will get. Separating the auth-gated and non-auth states keeps the flow clean without needing a separate sign-in prompt in the summary tab.

### Global Summary Cache Scope
**Recommendation:** Global (not per-user).
**Reasoning:** Summaries are deterministic for a given transcript. The same video produces the same transcript, which produces the same summary. Global caching means the first user to summarize video X benefits everyone else who views video X. With Gemini free tier at 250 RPD, this is not optional -- it is a requirement for viability. The `summaries` table has no `userId` column.

### Rate Limiting: Backend Handling, No User-Facing Indicator
**Recommendation:** Handle rate limits entirely on the backend. If Gemini returns a 429, the `/api/summarize` route returns `{ success: false, error: 'Summary temporarily unavailable' }`. The extension shows this as a toast notification per the user's decision. No countdown timer, no "X requests remaining" display. For production, use a paid tier key.
**Reasoning:** The user explicitly decided against user-facing rate limit display. Backend handling keeps the UX clean. Global caching minimizes actual Gemini calls. The free tier's 250 RPD is sufficient for early adoption; paid tier ($0.30/M tokens) is cheap for scale.

### Loading State: Spinner with Progress Text
**Recommendation:** In the summary tab, show a centered spinner (reuse existing `.tg-spinner` CSS) with the text "Generating summary..." below it. The spinner should be the same size and style as the transcript loading spinner for visual consistency.
**Reasoning:** Summary generation takes 2-5 seconds. A spinner with text is the simplest indicator that sets proper expectations. No progress bar (we do not have intermediate progress from Gemini's non-streaming API).

### Segmented Control Styling: iOS-Style Pill Toggle
**Recommendation:** Two-option pill toggle (Bullets | Paragraph) with a subtle background and an active state that looks "pressed in" with a slight shadow. Matches the general YouTube/Material Design aesthetic. Uses the same border-radius and font-size as other panel controls.
**Reasoning:** The segmented control is a well-understood UI pattern. iOS-style pill toggle is widely recognized and compact. It fits naturally in the summary tab header area.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@google/generative-ai` package | `@google/genai` package | Late 2025 | New official SDK with cleaner API. Old package is still maintained but new one is recommended. |
| `gemini-1.5-flash` model | `gemini-2.5-flash` model | Mid 2025 | 2.5 series has much better reasoning, 65K output tokens (vs 8K), same 1M context window |
| Generous free tier (50+ RPD) | Reduced free tier (250 RPD for flash) | December 2025 | Caching is now essential, not optional. Global cache by videoId is critical. |
| `GoogleGenerativeAI` class constructor | `GoogleGenAI` class constructor | Late 2025 | New SDK uses `GoogleGenAI` with `ai.models.generateContent()` pattern |

**Deprecated/outdated:**
- `@google/generative-ai` package: Still works but `@google/genai` is the newer, recommended SDK
- `gemini-pro` / `gemini-1.5-flash`: Older model generations. Use `gemini-2.5-flash` for current work.
- Pre-December 2025 rate limit assumptions: Free tier was cut significantly. Do not assume high RPD availability.

## Open Questions

1. **Transcript text length vs Gemini token limits**
   - What we know: Gemini 2.5 Flash has a 1,048,576 token input limit. A typical YouTube transcript is 1,000-10,000 words (roughly 1,500-15,000 tokens). Even a 3-hour lecture transcript rarely exceeds 50,000 tokens.
   - What's unclear: Whether any edge case (extremely long video, auto-generated captions with heavy repetition) could approach the 1M limit.
   - Recommendation: Use `ai.models.countTokens()` before calling `generateContent()`. Set a threshold at 900K tokens. If exceeded, use the chunked summarization pattern. In practice, this code path will almost never execute, but it prevents failures for edge cases.

2. **Background service worker cookie attachment for cross-origin authenticated requests**
   - What we know: Background service workers with `host_permissions` can make cross-origin requests, and `credentials: 'include'` causes cookies to be attached. Multiple sources confirm this pattern works.
   - What's unclear: Whether NextAuth's cookie configuration (httpOnly, SameSite, Secure flags) could prevent the cookie from being attached to extension-initiated requests. NextAuth uses `SameSite=lax` by default for JWTs.
   - Recommendation: Test this during implementation. If `SameSite=lax` blocks the cookie on cross-origin POST requests from the extension, consider: (a) reading the cookie via `chrome.cookies.get()` and setting it manually in the request header, or (b) adding a custom auth mechanism for extension requests. Test with the actual deployed environment.

3. **Drizzle migration strategy for the new summaries table**
   - What we know: The project uses `drizzle-kit` with Neon PostgreSQL. Two migrations already exist.
   - What's unclear: Whether `drizzle-kit push` or `drizzle-kit generate + migrate` is the preferred workflow for this project.
   - Recommendation: Use `drizzle-kit generate` to create a migration file, review it, then run `drizzle-kit migrate` against the production DB. This is safer than `push` for a production database.

4. **Summary persistence alongside transcripts in history**
   - What we know: User decision says "if a summary has been generated, persist both transcript AND summary to history (available on transcriptgrab.com)."
   - What's unclear: Whether the summary should be stored in the `transcripts` table (new columns) or in the separate `summaries` table with a join. Also, how the history page on transcriptgrab.com should display summaries.
   - Recommendation: Keep summaries in the separate `summaries` table (global cache). When displaying a transcript on the history page, join with the summaries table by videoId to show the summary if it exists. This keeps the data model clean and avoids adding nullable columns to the existing transcripts table. The web app history page changes are minimal (conditional summary display if a summary exists for that videoId).

## Sources

### Primary (HIGH confidence)
- Gemini API official docs (Context7: `/websites/ai_google_dev_gemini-api`) - Model specs, token limits, generateContent API, system instructions, context caching, token counting
- Gemini API reference (Context7: `/websites/ai_google_dev_api`) - Model information endpoints, rate limits reference
- `@google/genai` npm package (https://www.npmjs.com/package/@google/genai) - Latest version 1.41.0, installation, usage patterns
- Gemini API pricing (https://ai.google.dev/gemini-api/docs/pricing) - Per-model pricing for input/output tokens, free tier details
- Existing codebase: `extension/entrypoints/background/index.ts` - Current message handler pattern, fetch structure
- Existing codebase: `extension/entrypoints/youtube.content/panel.ts` - Current panel structure, Shadow DOM pattern, toast notification
- Existing codebase: `lib/db/schema.ts` - Current DB schema, Drizzle patterns
- Existing codebase: `lib/db/queries.ts` - Current query patterns, `onConflictDoNothing` usage
- Existing codebase: `app/api/transcript/save/route.ts` - Auth wrapper pattern, request validation

### Secondary (MEDIUM confidence)
- Gemini API rate limits (https://ai.google.dev/gemini-api/docs/rate-limits) - Rate limit structure (RPM, RPD, TPM) confirmed, but exact current values for free tier require checking AI Studio dashboard
- WebSearch: Gemini free tier post-December 2025 - Multiple sources confirm 10 RPM / 250 RPD for Gemini 2.5 Flash free tier, 15 RPM / 1000 RPD for Flash-Lite
- Chrome extension MV3 authenticated fetch - Multiple sources confirm `credentials: 'include'` with `host_permissions` attaches cookies for cross-origin requests from background service workers
- Map-reduce summarization pattern - Standard LLM pattern from multiple AI/ML sources (Pinecone, Weaviate, Redis)

### Tertiary (LOW confidence)
- `SameSite=lax` cookie behavior with chrome-extension:// origin - Not directly verified. Standard browser behavior suggests lax cookies are sent on top-level navigations but may not be sent on cross-origin POST from extensions. Needs implementation-time testing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - `@google/genai` is the official SDK with clear docs. Drizzle ORM is already in use. No new patterns introduced.
- Architecture: HIGH - Summary API route follows existing `/api/transcript/save` auth-gated pattern. Extension messaging follows existing protocol. Tab UI is standard DOM manipulation extending the existing panel.
- Pitfalls: HIGH - Each pitfall is grounded in API documentation (rate limits), codebase analysis (cookie handling), or standard web development knowledge (CORS, caching).
- Auto-save auth flow: MEDIUM - The `credentials: 'include'` pattern is well-documented but the specific interaction between NextAuth cookies, SameSite policy, and extension background workers needs verification during implementation.

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days; Gemini API and SDK are stable; rate limits may change)
