# Phase 6: Advanced History - Research

**Researched:** 2026-02-18
**Domain:** Client-side search filtering, transcript format switching, export/download, timestamp toggle in history context
**Confidence:** HIGH

## Summary

Phase 6 adds three feature areas to the existing history UI: (1) instant search/filter across saved transcripts by title or URL, (2) format switching and export on the transcript detail page, and (3) a timestamp visibility toggle on the transcript viewer in history. All three areas are well-supported by existing patterns in the codebase.

Search filtering can be implemented entirely client-side since the history list already loads all transcripts (including segments) in a single server-component fetch. The `HistoryActions` client wrapper (built in Phase 5) is the natural place to add search state and filter logic. For users with typical transcript counts (under 100), client-side filtering with `String.includes()` is fast enough that no server-side search or debouncing is needed.

Format switching and export on the detail page reuses the exact pattern from the main page (`app/page.tsx`): the `ActionButtons` component already has copy, download .txt, and download .srt functions, and the `TimestampToggle` component already toggles timestamp visibility. The detail page currently hardcodes `showTimestamps={true}` and has a minimal `TranscriptDetailActions` component with only copy and delete. The work is converting the detail page to use state for timestamps and format, and wiring in the existing components (or their patterns). The JSONB `segments` column stores raw `TranscriptSegment[]` data, so all format conversions happen client-side from that data with zero re-fetching.

For UIUX-03 (polished card layout), the existing `HistoryCard` is already functional. Polish means refining spacing, adding visual hierarchy, and ensuring the search empty state looks good.

**Primary recommendation:** Add a search `Input` above the history list in `HistoryActions`, filter transcripts client-side with case-insensitive string matching on `videoTitle` and `videoUrl`, convert the detail page from server-rendered actions to a client component with format/timestamp state, and reuse existing `formatTranscriptText`, `generateSRT`, and `TimestampToggle` patterns from the main page.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HIST-08 | User can search history by video title or URL | Client-side filter in `HistoryActions` using `String.toLowerCase().includes()` on `videoTitle` and `videoUrl`. shadcn `Input` component already installed. Filter applied on every keystroke via controlled input state. No debounce needed for typical list sizes. |
| HIST-09 | User can export transcript from history in any format (plain, timestamps, SRT) | Existing `formatTranscriptText(segments, showTimestamps)` and `generateSRT(segments)` in `lib/format.ts`. Existing download pattern in `ActionButtons.tsx` (Blob + createObjectURL + anchor click). Wire into detail page actions. |
| HIST-10 | User can switch transcript format in history view without re-fetching from YouTube | Segments stored as JSONB `TranscriptSegment[]` in database. Already loaded on detail page. All format conversion is client-side via `lib/format.ts` functions. State change triggers re-render with new format, zero network requests. |
| UIUX-02 | Show/hide timestamps toggle on transcript viewer | Existing `TimestampToggle` component (uses shadcn Switch). Existing `TranscriptViewer` accepts `showTimestamps` prop. Detail page currently hardcodes `showTimestamps={true}`. Convert to state-driven. |
| UIUX-03 | Polished card layout for history items | Existing `HistoryCard` layout with thumbnail, title, preview, date, duration badge. Polish: consistent spacing, hover states already working, search highlighting optional, empty state for filtered results. |
</phase_requirements>

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.2.3 | `useState` for search term, timestamp toggle, format selection | Already installed, core framework |
| lucide-react | 0.574.0 | Icons (Search, Download, FileText, Clock) | Already installed, used throughout codebase |
| sonner | 2.0.7 | Toast feedback for copy/export actions | Already installed and wired in layout.tsx |

### Supporting (already installed shadcn components)

| Component | Purpose | When to Use |
|-----------|---------|-------------|
| Input | Search text input on history page | HIST-08 search box |
| Switch | Timestamp toggle (via TimestampToggle component) | UIUX-02 toggle |
| Select | Format picker (plain text / timestamps / SRT) | HIST-09, HIST-10 format switching |
| Button | Export/download buttons | HIST-09 export actions |
| Card | History card layout | UIUX-03 polish |

### New (to install)

None. Every component and library needed is already installed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side search filtering | Server-side search with API route + Drizzle `ilike` | Server-side is overkill for < 200 transcripts. Adds API route, loading state, debouncing. Client-side is instant, zero latency, simpler implementation. Switch to server-side only if users accumulate thousands of transcripts. |
| `String.includes()` matching | `ilike` SQL query via Drizzle | SQL `ilike` query: `or(ilike(transcripts.videoTitle, \`%${term}%\`), ilike(transcripts.videoUrl, \`%${term}%\`))`. Reserve for when client-side filtering becomes a performance concern. |
| Controlled Input for search | Debounced input with `useDeferredValue` | For list sizes under 200 items, instant filtering with every keystroke is perceptibly instant. No debounce needed. If needed later, React 19's `useDeferredValue` is the simplest approach (no third-party debounce library). |
| Separate export buttons per format | Single "Export" dropdown with format options | Separate buttons (Download .txt, Download .srt) match the existing `ActionButtons` pattern on the main page. Dropdown adds complexity for only 2-3 options. Keep it simple. |

## Architecture Patterns

### Recommended Changes to Existing Structure

```
components/
  HistoryActions.tsx       # MODIFY: add search input + filter logic
  HistoryCard.tsx          # MODIFY: minor polish (UIUX-03)
  TranscriptDetailActions.tsx  # MODIFY: add format select, download buttons, timestamp toggle
  TranscriptViewer.tsx     # NO CHANGE: already accepts showTimestamps prop
  TimestampToggle.tsx      # NO CHANGE: already works as-is
  ActionButtons.tsx        # REFERENCE ONLY: reuse download pattern, don't import directly
app/
  history/
    page.tsx               # NO CHANGE: server component passes transcripts to HistoryActions
    [id]/page.tsx           # MODIFY: wrap actions + viewer in client component for state
```

### Pattern 1: Client-Side Search Filtering

**What:** A controlled `Input` component at the top of the history list. On every keystroke, filter the `transcripts` array by checking if `videoTitle` or `videoUrl` contains the search term (case-insensitive). Render only matching transcripts.
**When to use:** HIST-08 search functionality.

```typescript
// In HistoryActions.tsx
"use client";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

// Inside component:
const [searchTerm, setSearchTerm] = useState("");

const filteredTranscripts = useMemo(() => {
  if (!searchTerm.trim()) return transcripts;
  const term = searchTerm.toLowerCase();
  return transcripts.filter(
    (t) =>
      t.videoTitle.toLowerCase().includes(term) ||
      t.videoUrl.toLowerCase().includes(term)
  );
}, [transcripts, searchTerm]);

// In JSX:
<div className="relative">
  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  <Input
    placeholder="Search transcripts..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="pl-9"
  />
</div>

// Then render filteredTranscripts instead of transcripts
```

**Source:** Codebase `components/ui/input.tsx` (already installed), standard React filtering pattern.

### Pattern 2: Format Switching on Detail Page

**What:** A `Select` component on the detail page that lets users choose between "Plain Text", "With Timestamps", and "SRT" formats. The selection controls what gets copied and downloaded. The `TranscriptViewer` shows the transcript with or without timestamps based on the current mode.
**When to use:** HIST-09 and HIST-10 format switching.

```typescript
// In TranscriptDetailActions.tsx (or new detail client wrapper)
type TranscriptFormat = "plain" | "timestamps" | "srt";

const [format, setFormat] = useState<TranscriptFormat>("plain");
const showTimestamps = format === "timestamps";

// Copy uses current format:
function handleCopy() {
  let text: string;
  if (format === "srt") {
    text = generateSRT(segments);
  } else {
    text = formatTranscriptText(segments, format === "timestamps");
  }
  navigator.clipboard.writeText(text).then(() => {
    toast("Copied to clipboard");
  });
}

// Download uses current format:
function handleDownload() {
  const baseName = sanitizeFilename(videoTitle);
  if (format === "srt") {
    downloadFile(generateSRT(segments), `${baseName}.srt`, "text/srt");
  } else {
    const text = formatTranscriptText(segments, format === "timestamps");
    downloadFile(text, `${baseName}.txt`, "text/plain");
  }
}
```

**Source:** Existing `components/ActionButtons.tsx` patterns for `downloadFile`, `sanitizeFilename`, `formatTranscriptText`, and `generateSRT`.

### Pattern 3: Client-Side File Download

**What:** Create a Blob from text content, generate an object URL, create a temporary anchor element, trigger a click, and revoke the URL. This is the existing pattern from `ActionButtons.tsx`.
**When to use:** HIST-09 export/download.

```typescript
// Source: existing components/ActionButtons.tsx
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

This function should be extracted to a shared utility if used in both ActionButtons and TranscriptDetailActions, or duplicated (it is only 6 lines). Extracting to `lib/format.ts` or a new `lib/download.ts` is cleaner.

### Pattern 4: Timestamp Toggle via State

**What:** The detail page currently passes `showTimestamps={true}` as a hardcoded prop. Convert to a `useState(true)` and wire a `TimestampToggle` component to control it.
**When to use:** UIUX-02 timestamp toggle in history view.

```typescript
// In detail page client wrapper:
const [showTimestamps, setShowTimestamps] = useState(true);

// JSX:
<TimestampToggle enabled={showTimestamps} onToggle={setShowTimestamps} />
<TranscriptViewer segments={segments} showTimestamps={showTimestamps} />
```

**Source:** Existing `app/page.tsx` lines 30 and 149-153 (exact same pattern).

### Pattern 5: Detail Page Client Wrapper

**What:** The detail page (`app/history/[id]/page.tsx`) is a server component that fetches data. To add interactive state (format selection, timestamp toggle), create a client component that receives segments and video metadata as props and manages the interactive state.
**When to use:** Converting the static detail page to support format switching and timestamp toggle.

The current detail page renders:
1. Back link (static)
2. Video info header (static)
3. `TranscriptDetailActions` (client - copy + delete)
4. `TranscriptViewer` (client - segment display)

The challenge is that `TranscriptDetailActions` and `TranscriptViewer` need to share state (`showTimestamps`, `format`). Two approaches:

**Approach A: Expand TranscriptDetailActions to wrap TranscriptViewer**
Make TranscriptDetailActions the single client boundary that manages all interactive state and renders both the actions bar and the viewer.

**Approach B: Lift state to a new wrapper component**
Create a `TranscriptDetail` client component that wraps both and manages shared state.

**Recommendation:** Approach B (new wrapper) is cleaner because TranscriptDetailActions is focused on actions, and TranscriptViewer is focused on display. A wrapper keeps them both reusable.

```typescript
// components/TranscriptDetail.tsx ("use client")
// Receives: segments, transcriptId, videoTitle
// Manages: showTimestamps, format state
// Renders: TimestampToggle, format Select, copy/delete/download buttons, TranscriptViewer
```

### Anti-Patterns to Avoid

- **Server-side search for small datasets:** Adding a search API route with Drizzle `ilike` queries, loading states, and debouncing is overengineered when the entire dataset is already loaded client-side. The history page already loads all transcripts.
- **Re-fetching segments for format switching:** The entire point of storing segments as JSONB is to enable client-side format conversion. Never call the YouTube API or a server endpoint to change format.
- **Separate pages per format:** Do not create `/history/[id]/srt` or `/history/[id]/plain` routes. Format is UI state, not a URL concern.
- **Debouncing search for small lists:** Filtering 50-100 objects with `String.includes()` is sub-millisecond. Adding debounce or `useDeferredValue` adds complexity for zero perceived benefit.
- **Extracting ActionButtons and importing on detail page:** `ActionButtons` is tightly coupled to the main page context (it assumes a freshly-fetched transcript). Better to duplicate the 6-line `downloadFile` helper and compose a new set of actions for the detail page context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Search input with icon | Custom div + input + positioning | shadcn Input with absolute-positioned Lucide icon | Already have Input component, standard pattern for search with icon |
| Format selection dropdown | Custom radio group or tabs | shadcn Select component | Already installed, consistent with LanguageSelector pattern |
| Timestamp toggle | Custom checkbox or button | Existing TimestampToggle component (shadcn Switch) | Already built and working in main page |
| File download | Custom fetch + save logic | Blob + createObjectURL pattern from ActionButtons | Already proven in codebase, 6 lines of code |
| Text format conversion | Custom string builders | Existing `formatTranscriptText` and `generateSRT` from `lib/format.ts` | Already built, tested, handles HTML entity decoding |

**Key insight:** Every feature in this phase has a working implementation or pattern already in the codebase. The work is composing existing pieces into the history context. No novel UI development or library integration is needed.

## Common Pitfalls

### Pitfall 1: Search Not Clearing When Entering/Exiting Selection Mode

**What goes wrong:** User searches for "react", sees filtered results, enters selection mode, selects items, then exits selection mode. The search term is still active but the selected items may not match the filter.
**Why it happens:** Search state and selection state are independent but interact visually.
**How to avoid:** Clear search when entering selection mode, or clear selection when search term changes. The simpler approach: keep them independent but filter the selected set to only include visible (filtered) items when performing bulk actions.
**Warning signs:** Bulk delete deletes items the user cannot see because they are filtered out.

### Pitfall 2: Empty Search Results Without Feedback

**What goes wrong:** User types a search term that matches nothing and sees a blank page. No indication of why there are no results.
**Why it happens:** Rendering an empty array produces nothing visible.
**How to avoid:** Check `filteredTranscripts.length === 0` when `searchTerm` is non-empty and show a "No transcripts match your search" message. Differentiate from "no transcripts at all" empty state.
**Warning signs:** Blank content area when searching with no matches.

### Pitfall 3: Server/Client Boundary on Detail Page

**What goes wrong:** Trying to add `useState` in the server component `app/history/[id]/page.tsx` causes a build error.
**Why it happens:** Server components cannot use React hooks or browser APIs.
**How to avoid:** Keep the server component for data fetching and auth. Pass data as props to a "use client" wrapper component that manages all interactive state. This is the same pattern used for `HistoryActions` on the list page.
**Warning signs:** Build errors about hooks in server components.

### Pitfall 4: Format State Not Affecting Both Copy and Viewer

**What goes wrong:** User switches format to "SRT" but the copy button still copies plain text, or the viewer still shows timestamps.
**Why it happens:** Format state is not shared between the actions bar and the viewer.
**How to avoid:** Use a single client wrapper component that owns the format state and passes it to both the actions and the viewer. This is why Pattern 5 (client wrapper) is recommended.
**Warning signs:** Inconsistent behavior between what the user sees and what gets copied/downloaded.

### Pitfall 5: SRT Format in TranscriptViewer

**What goes wrong:** User selects "SRT" format and expects the viewer to show SRT-formatted text, but `TranscriptViewer` does not have an SRT rendering mode.
**Why it happens:** `TranscriptViewer` only supports two modes: with timestamps and without. SRT is a different format with sequence numbers and time ranges.
**How to avoid:** Two options: (A) When SRT is selected, show SRT as a preformatted text block instead of using `TranscriptViewer`'s per-segment rendering. (B) Keep the viewer always showing the segment-based view (with or without timestamps) and only use SRT format for copy/download. Option B is simpler and avoids confusing the viewer's purpose. The viewer shows the transcript; the export format is a separate concern.
**Recommendation:** Option B. The viewer always renders segments with optional timestamps. The format select controls what gets copied and downloaded, not what is displayed. This avoids building a third rendering mode for TranscriptViewer.

## Code Examples

Verified patterns from codebase and official sources:

### Client-Side Search Filter (composing existing patterns)
```typescript
// Source: standard React pattern + existing codebase components
import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const [searchTerm, setSearchTerm] = useState("");

const filtered = useMemo(() => {
  if (!searchTerm.trim()) return transcripts;
  const term = searchTerm.toLowerCase();
  return transcripts.filter(
    (t) =>
      t.videoTitle.toLowerCase().includes(term) ||
      t.videoUrl.toLowerCase().includes(term)
  );
}, [transcripts, searchTerm]);
```

### Format Select (reusing existing shadcn Select pattern)
```typescript
// Source: existing components/LanguageSelector.tsx pattern
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TranscriptFormat = "plain" | "timestamps" | "srt";

<Select value={format} onValueChange={(v) => setFormat(v as TranscriptFormat)}>
  <SelectTrigger className="w-[180px]">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="plain">Plain Text</SelectItem>
    <SelectItem value="timestamps">With Timestamps</SelectItem>
    <SelectItem value="srt">SRT Subtitles</SelectItem>
  </SelectContent>
</Select>
```

### Download File Helper (from existing ActionButtons.tsx)
```typescript
// Source: existing components/ActionButtons.tsx
function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]+/g, "").replace(/\s+/g, " ").trim() || "transcript";
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Drizzle ilike Search (future server-side option)
```typescript
// Source: Context7 /drizzle-team/drizzle-orm-docs -- ilike + or operators
// Use this IF client-side filtering becomes too slow (hundreds of transcripts)
import { or, ilike, eq, and, desc } from "drizzle-orm";

export async function searchTranscripts(userId: string, term: string) {
  const pattern = `%${term}%`;
  return db
    .select()
    .from(transcripts)
    .where(
      and(
        eq(transcripts.userId, userId),
        or(
          ilike(transcripts.videoTitle, pattern),
          ilike(transcripts.videoUrl, pattern)
        )
      )
    )
    .orderBy(desc(transcripts.savedAt));
}
```

### Search Empty State
```typescript
// Pattern for differentiated empty states
{filteredTranscripts.length === 0 && searchTerm.trim() ? (
  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
    <p className="text-muted-foreground">
      No transcripts match "{searchTerm}"
    </p>
    <button
      onClick={() => setSearchTerm("")}
      className="text-sm text-primary underline underline-offset-4"
    >
      Clear search
    </button>
  </div>
) : /* existing empty state */ null}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side search with page reload | Client-side instant filtering from pre-loaded data | React 16+ (2018) | Zero latency, no loading states, simpler implementation |
| `document.createElement('a')` download hack | Same approach (still the standard) | No change | Blob + createObjectURL is still the standard browser download pattern. No newer API has replaced it. |
| Custom debounce functions | React 19 `useDeferredValue` for deferred rendering | React 19 (2024) | Built-in, no third-party library needed. But unnecessary for small list sizes. |
| Separate viewer per format | Single viewer + format-aware export | N/A | Keep display and export concerns separate. Viewer shows segments; export formats them. |

**Deprecated/outdated:**
- `document.execCommand('copy')`: Replaced by Clipboard API (already using the modern approach)
- Custom debounce with `setTimeout`/`clearTimeout`: `useDeferredValue` is the React 19 built-in alternative, but still overkill for small lists

## Open Questions

1. **Should the format select change what the viewer displays, or only what gets copied/downloaded?**
   - What we know: `TranscriptViewer` supports two display modes (with/without timestamps). SRT is a fundamentally different format (sequence numbers, time ranges).
   - What's unclear: User expectation when selecting "SRT" format.
   - Recommendation: Keep the viewer always showing segment-based rendering (with optional timestamps via toggle). The format select controls copy/download output only. This avoids building a third viewer mode and keeps the UX simple: what you see is the readable transcript, what you export is the format you selected.

2. **Should search interact with selection mode?**
   - What we know: Both features exist in `HistoryActions`. A user could search, then try to select filtered results for bulk delete.
   - What's unclear: Whether bulk operations should apply only to filtered (visible) items.
   - Recommendation: Allow both to coexist. Bulk operations only affect selected items that are currently visible. If a user selects items, then searches (hiding some selected items), the selection count should reflect visible selections. This prevents accidentally deleting hidden items.

3. **Should the downloadFile helper be extracted to a shared utility?**
   - What we know: `ActionButtons.tsx` has it. `TranscriptDetailActions.tsx` will need it.
   - What's unclear: Whether to duplicate or extract.
   - Recommendation: Extract `downloadFile` and `sanitizeFilename` to `lib/download.ts` (or add to `lib/format.ts`). Six lines of code, but used in two places. DRY is worth it here.

## Sources

### Primary (HIGH confidence)
- Context7 `/drizzle-team/drizzle-orm-docs` -- `ilike` operator, `or()` combinator, conditional filters with `and()`. Verified server-side search pattern for future scaling.
- Codebase inspection (verified by reading source):
  - `components/ActionButtons.tsx` -- download pattern, format functions, sanitizeFilename
  - `components/TimestampToggle.tsx` -- existing toggle component (shadcn Switch)
  - `components/TranscriptViewer.tsx` -- accepts `showTimestamps` prop, renders segments
  - `components/TranscriptDetailActions.tsx` -- current copy + delete actions on detail page
  - `components/HistoryActions.tsx` -- client wrapper managing selection state, natural home for search
  - `components/HistoryCard.tsx` -- current card layout, HistoryTranscript interface
  - `components/LanguageSelector.tsx` -- shadcn Select usage pattern
  - `components/ui/input.tsx` -- Input component (already installed)
  - `components/ui/select.tsx` -- Select component (already installed)
  - `app/page.tsx` -- main page with timestamp toggle + format switching pattern
  - `app/history/[id]/page.tsx` -- detail page server component, currently hardcodes showTimestamps
  - `lib/format.ts` -- `formatTranscriptText`, `generateSRT`, `formatTimestamp`, `decodeHtmlEntities`
  - `lib/db/queries.ts` -- `getUserTranscripts`, `getTranscriptById`
  - `lib/db/schema.ts` -- transcripts table with JSONB segments column

### Secondary (MEDIUM confidence)
- React 19 `useMemo` for derived state filtering -- standard React pattern, well-documented
- Blob + createObjectURL download pattern -- universal browser support, no known alternatives

### Tertiary (LOW confidence)
- None. All findings verified against source code or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies. Every component, utility, and pattern already exists in the codebase.
- Architecture: HIGH -- Direct composition of existing patterns. The main page already implements format switching and timestamp toggle; the detail page just needs the same wiring.
- Pitfalls: HIGH -- Server/client boundary is well-understood from prior phases. Search + selection interaction is the only novel concern, and the mitigation is straightforward.

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable domain; no fast-moving dependencies)
