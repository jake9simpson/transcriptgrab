# Phase 4: History List - Research

**Researched:** 2026-02-18
**Domain:** Server-side data fetching, card-based list UI, dynamic routing, transcript detail view, navigation
**Confidence:** HIGH

## Summary

This phase builds the user-facing history library -- the first feature that makes the database work from Phases 2-3 visible. The scope is well-defined: a server component at `/history` that queries the user's saved transcripts, renders them as cards, and links each card to a detail page that renders the full transcript from stored JSONB segments.

No new libraries are needed. The entire phase uses the existing stack: Drizzle ORM for database queries, Next.js App Router server components for data fetching, shadcn/ui Card components for the list layout, `next/image` for thumbnails, and `next/link` for navigation. The transcript detail page reuses the existing `TranscriptViewer` component (or a variant of it) to render segments already stored in the database, and the existing `lib/format.ts` utilities for formatting.

The technical risk is low. The database schema is stable, auth works, and the transcript data shape is known. The main decisions are architectural: how to structure the detail route (dynamic segment vs query param), where to place the "get transcripts" query, and how to handle the navigation between the main tool and history.

**Primary recommendation:** Build two server components (`/history` list page and `/history/[id]` detail page), add two Drizzle query functions (`getUserTranscripts` and `getTranscriptById`), create a `HistoryCard` client component for the card UI, wire navigation via `next/link` in the header and AuthButton dropdown, and reuse `TranscriptViewer` for the detail view.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HIST-01 | Signed-in user can view all saved transcripts on a dedicated history page | Server component at `/history` calls `auth()` for session, queries `getUserTranscripts(userId)` ordered by `savedAt desc`, renders list; redirects unauthenticated users (already exists in stub) |
| HIST-02 | History displays as cards with video title, thumbnail, save date, and text preview | `HistoryCard` component using shadcn Card primitives, `next/image` for thumbnails, formatted date via `toLocaleDateString()`, text preview generated from first N characters of segment text |
| HIST-03 | Cards sorted by most recent first | Drizzle `.orderBy(desc(transcripts.savedAt))` in the query function |
| HIST-04 | User can click a card to view the full transcript | Card wrapped in `next/link` to `/history/[id]`; detail page server component fetches transcript by ID, verifies ownership, renders segments via `TranscriptViewer` |
| UIUX-01 | Navigation between main transcript tool and history page | Add "History" link in header (visible when signed in), enable the disabled "History" dropdown item in `AuthButton`, add "Back to TranscriptGrab" link on history pages |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `drizzle-orm` | 0.45.1 | SELECT queries with where/orderBy/limit | Installed |
| `@neondatabase/serverless` | 1.0.2 | Neon PostgreSQL driver | Installed |
| `next-auth` | 5.0.0-beta.30 | `auth()` for server-side session in page components | Installed |
| `next` | 16.1.6 | App Router server components, `next/link`, `next/image`, dynamic routes | Installed |
| `lucide-react` | 0.574.0 | Icons (arrow-left, clock, etc.) | Installed |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Card | - | Card, CardContent, CardHeader, CardTitle, CardDescription | History card layout |
| shadcn/ui Badge | - | Optional: display duration or segment count | Card metadata display |
| shadcn/ui Separator | - | Visual dividers if needed | Between cards or sections |

### New (to install)
None. No new dependencies required for this phase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server component data fetch | API route + client-side fetch | Adds unnecessary client JS, loading states, and an extra API endpoint; server components are simpler for read-only pages |
| Dynamic route `/history/[id]` | Query param `/history?id=xxx` | Dynamic routes give cleaner URLs, proper back button behavior, and are the Next.js convention for entity detail pages |
| `toLocaleDateString()` for dates | `date-fns` or `dayjs` | Overkill for simple "Feb 18, 2026" display; native Intl is sufficient and zero-dependency |
| Reuse existing `TranscriptViewer` | Build new detail component | Existing component already handles segments + timestamps with ScrollArea; reuse is correct |

## Architecture Patterns

### Recommended Project Structure (additions)
```
app/
├── history/
│   ├── page.tsx              # History list (server component)
│   └── [id]/
│       └── page.tsx          # Transcript detail (server component)
lib/
├── db/
│   └── queries.ts            # ADD: getUserTranscripts, getTranscriptById
components/
├── HistoryCard.tsx            # NEW: card for history list
├── AuthButton.tsx             # MODIFY: enable History dropdown item as Link
app/
└── layout.tsx                 # MODIFY: add History link in header (conditional)
```

### Pattern 1: Server Component Data Fetching with Auth Guard
**What:** History pages are async server components that call `auth()` for the session and query the database directly. No API route needed for read-only data.
**When to use:** Any page that reads data for the authenticated user.
**Example:**
```typescript
// app/history/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserTranscripts } from "@/lib/db/queries";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const transcripts = await getUserTranscripts(session.user.id);

  return (
    <div>
      <h1>History</h1>
      {transcripts.map((t) => (
        <HistoryCard key={t.id} transcript={t} />
      ))}
    </div>
  );
}
```
**Source:** Context7 `/vercel/next.js` -- Server Component fetching data pattern; codebase `app/history/page.tsx` existing auth guard pattern.

### Pattern 2: Drizzle Select with Where + OrderBy
**What:** Query the transcripts table filtered by userId, ordered by savedAt descending.
**When to use:** The `getUserTranscripts` query function.
**Example:**
```typescript
// lib/db/queries.ts
import { eq, desc } from "drizzle-orm";

export async function getUserTranscripts(userId: string) {
  return db
    .select({
      id: transcripts.id,
      videoId: transcripts.videoId,
      videoTitle: transcripts.videoTitle,
      videoUrl: transcripts.videoUrl,
      thumbnailUrl: transcripts.thumbnailUrl,
      videoDuration: transcripts.videoDuration,
      savedAt: transcripts.savedAt,
      // Exclude segments from list query -- too large for card display
    })
    .from(transcripts)
    .where(eq(transcripts.userId, userId))
    .orderBy(desc(transcripts.savedAt));
}
```
**Source:** Context7 `/drizzle-team/drizzle-orm-docs` -- select with where, orderBy(desc()), partial select.

**Critical detail:** The list query should NOT select the `segments` column. Segments contain the full transcript data (potentially 100KB+ per row). Loading all segments for every saved transcript on the list page would be wasteful. Use a partial select that omits segments. The detail page query will fetch segments for a single transcript.

For the text preview on cards, there are two approaches:
1. **Compute preview from segments in the list query using SQL** -- `sql<string>\`left(segments->0->>'text', 120)\``
2. **Add a separate preview/summary column** -- requires migration, over-engineered for Phase 4
3. **Include just the first few segments in the list query** -- still involves pulling JSONB data

**Recommendation:** Fetch segments only for the detail page. For the list view, either add a `textPreview` column (simple `text` field populated at save time) OR skip text preview on cards for now and add it in Phase 6 (Advanced History) when UIUX-03 calls for "polished card layout." The cards already have title, thumbnail, save date, and duration -- that is enough for HIST-02. However, since HIST-02 explicitly requires "text preview," the simplest approach is to include a limited number of segments in the list query. Use a raw SQL subquery or accept pulling the full JSONB and truncating client-side. Given typical transcript sizes (50-200KB JSONB), pulling 20-30 transcripts with segments is acceptable for an MVP history page with a reasonable number of transcripts. If performance becomes an issue, add a `textPreview` column later.

**Revised recommendation for MVP:** Select all columns including segments in the list query. Generate the text preview client-side from the first few segments. This avoids a migration and keeps the implementation simple. Optimize later if needed.

### Pattern 3: Dynamic Route for Transcript Detail
**What:** A `[id]` dynamic segment under `/history/` for the individual transcript view.
**When to use:** The detail page that shows a full transcript.
**Example:**
```typescript
// app/history/[id]/page.tsx
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getTranscriptById } from "@/lib/db/queries";

export default async function TranscriptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const { id } = await params;
  const transcript = await getTranscriptById(id, session.user.id);

  if (!transcript) {
    notFound();
  }

  return (
    <div>
      <h1>{transcript.videoTitle}</h1>
      {/* Render transcript with existing TranscriptViewer */}
    </div>
  );
}
```
**Source:** Context7 `/vercel/next.js` -- dynamic route params with `Promise<{ slug: string }>` pattern (Next.js 16 uses async params).

**Critical detail:** In Next.js 16, `params` is a Promise that must be awaited. This is a change from Next.js 14/15 where params was a plain object. The pattern is `const { id } = await params;`.

### Pattern 4: Ownership Verification on Detail Page
**What:** The `getTranscriptById` query must verify the transcript belongs to the requesting user.
**When to use:** Always, for the detail page query.
**Example:**
```typescript
// lib/db/queries.ts
import { and, eq } from "drizzle-orm";

export async function getTranscriptById(id: string, userId: string) {
  const rows = await db
    .select()
    .from(transcripts)
    .where(and(eq(transcripts.id, id), eq(transcripts.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}
```
**Source:** Context7 `/drizzle-team/drizzle-orm-docs` -- combining filters with `and()`.

**Why ownership check matters:** Without it, any authenticated user could access any transcript by guessing/iterating UUIDs. The `and(eq(id), eq(userId))` filter ensures users can only view their own transcripts. This is standard row-level access control.

### Pattern 5: Navigation Integration
**What:** Add navigation links between the main tool and history page.
**When to use:** Header and AuthButton dropdown.
**Example changes:**
```typescript
// In AuthButton dropdown, change:
<DropdownMenuItem disabled>History</DropdownMenuItem>
// To:
<DropdownMenuItem asChild>
  <Link href="/history">History</Link>
</DropdownMenuItem>

// In layout.tsx header, add conditional history link:
// (This requires knowing session state -- use a client component or
// move the link into AuthButton which already has useSession)
```

### Anti-Patterns to Avoid
- **Fetching data client-side when server components work:** The history page is read-only data display. Server components eliminate loading states, reduce client JS, and allow direct database access. Do not build an API route + `useEffect` fetch.
- **Returning segments in the list query without good reason:** If the list grows to 50+ transcripts, pulling full JSONB segments for all of them is wasteful. For MVP this is acceptable, but be aware of the scaling concern.
- **Skipping ownership verification on the detail page:** Checking only `where(eq(id))` without `eq(userId)` is an authorization bypass. Always include the userId filter.
- **Using `useRouter` for navigation instead of `next/link`:** Links provide prefetching, proper anchor semantics, and work with browser back/forward. Only use `useRouter` for programmatic navigation (e.g., after form submission).
- **Building pagination before it's needed:** Phase 4 requirements don't mention pagination. Users would need 50+ transcripts before pagination matters. Ship without it; add in Phase 6 or 7 if needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date formatting | Custom date formatting | `Intl.DateTimeFormat` / `toLocaleDateString()` | Handles locale, timezone, and format options natively; zero dependency |
| Thumbnail display | Custom image component | `next/image` with `unoptimized` (existing pattern) | Already used in `VideoInfo.tsx`; handles remote images from ytimg.com |
| Text truncation for preview | Complex text splitting logic | CSS `line-clamp` or simple `.slice(0, 150)` on joined segment text | Preview is display-only; does not need perfect word boundaries |
| Auth guard on pages | Manual JWT checking | `auth()` from `@/auth` + `redirect()` | Already working pattern in existing `/history/page.tsx` stub |
| Scrollable transcript view | Custom scroll implementation | Existing `TranscriptViewer` with `ScrollArea` | Already built and working for the main tool |

**Key insight:** This phase is mostly UI assembly from existing parts. The database, auth, data model, and key UI components all exist. The work is querying, displaying, and linking.

## Common Pitfalls

### Pitfall 1: Next.js 16 Async Params
**What goes wrong:** Accessing `params.id` directly without awaiting the params Promise, causing a runtime error.
**Why it happens:** Next.js 16 changed `params` from a synchronous object to a Promise. Code copied from Next.js 14/15 tutorials will break.
**How to avoid:** Always use `const { id } = await params;` in page components with dynamic segments.
**Warning signs:** Runtime error "Cannot read properties of Promise" or TypeScript error about params type.

### Pitfall 2: Missing Ownership Check on Detail Page
**What goes wrong:** User A can view User B's transcripts by navigating to `/history/[B's-transcript-id]`.
**Why it happens:** Querying by `id` only, without filtering by `userId`.
**How to avoid:** Always include `eq(transcripts.userId, userId)` in the detail query's where clause.
**Warning signs:** No userId filter in the detail query function.

### Pitfall 3: Selecting Segments in List Query
**What goes wrong:** History page loads slowly or times out when user has many saved transcripts.
**Why it happens:** Each transcript's JSONB segments column can be 50-200KB. Loading 30 transcripts means fetching 1.5-6MB of JSON from the database.
**How to avoid:** For MVP, this is acceptable (users won't have 100+ transcripts yet). For optimization, use a partial select excluding segments and generate text preview from a dedicated column or skip preview.
**Warning signs:** Slow page loads on `/history` as transcript count grows.

### Pitfall 4: Thumbnail URL Can Be Null
**What goes wrong:** `next/image` crashes or shows broken image when `thumbnailUrl` is null.
**Why it happens:** The schema allows null thumbnailUrl (save can happen before metadata loads, or metadata fetch can fail).
**How to avoid:** Conditionally render the `Image` component only when `thumbnailUrl` is not null. Show a placeholder (gray div or icon) when null.
**Warning signs:** React error about null `src` prop on Image.

### Pitfall 5: Empty State Not Handled
**What goes wrong:** Signed-in user with no saved transcripts sees a blank page.
**Why it happens:** No empty state UI is built; the map over an empty array renders nothing.
**How to avoid:** Check `transcripts.length === 0` and render a helpful empty state: "No saved transcripts yet. Grab a transcript from the main page to see it here."
**Warning signs:** Blank page at `/history` for new users.

### Pitfall 6: Header Navigation Conditional Rendering
**What goes wrong:** Showing "History" link to unauthenticated users leads to redirect loop or confusing UX.
**Why it happens:** Header navigation is rendered in `layout.tsx` which is a server component, but session state needs to be checked.
**How to avoid:** The "History" link already lives in `AuthButton` dropdown (which uses `useSession` and only shows the dropdown for authenticated users). For the header link, either place it inside `AuthButton` or use a small client component that checks session. The simplest approach: just enable the existing disabled "History" dropdown item in `AuthButton` -- it's already gated behind auth.
**Warning signs:** "History" link visible to signed-out users.

## Code Examples

Verified patterns from official sources:

### Drizzle Select with Where + OrderBy + Partial Select
```typescript
// Source: Context7 /drizzle-team/drizzle-orm-docs
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { transcripts } from "@/lib/db/schema";

// List query: all columns (segments included for text preview)
const rows = await db
  .select()
  .from(transcripts)
  .where(eq(transcripts.userId, userId))
  .orderBy(desc(transcripts.savedAt));

// Detail query: single transcript with ownership check
const rows = await db
  .select()
  .from(transcripts)
  .where(and(eq(transcripts.id, id), eq(transcripts.userId, userId)))
  .limit(1);
```

### Next.js 16 Dynamic Route with Async Params
```typescript
// Source: Context7 /vercel/next.js -- page.tsx params convention
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  // use id...
}
```

### Next.js Server Component with Auth Guard
```typescript
// Source: Existing codebase pattern (app/history/page.tsx stub)
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  // fetch data, render...
}
```

### Next.js Link for Navigation
```typescript
// Source: Context7 /vercel/next.js -- Link component
import Link from "next/link";

// In card list
<Link href={`/history/${transcript.id}`}>
  <Card>...</Card>
</Link>

// In header/dropdown
<Link href="/history">History</Link>
```

### Next/Image for Thumbnails (existing pattern)
```typescript
// Source: Existing codebase (components/VideoInfo.tsx)
import Image from "next/image";

<Image
  src={thumbnailUrl}
  alt={videoTitle}
  width={120}
  height={68}
  unoptimized
  className="shrink-0 rounded-md"
/>
```

### Date Formatting (no library needed)
```typescript
// Native Intl API
const formatted = new Date(savedAt).toLocaleDateString("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});
// Output: "Feb 18, 2026"
```

### Text Preview from Segments
```typescript
// Generate preview from first segments
function getTextPreview(segments: TranscriptSegment[], maxLength = 150): string {
  let text = "";
  for (const seg of segments) {
    text += seg.text + " ";
    if (text.length >= maxLength) break;
  }
  return text.trim().slice(0, maxLength) + (text.length > maxLength ? "..." : "");
}
```

### CSS Line Clamp for Truncation
```typescript
// Tailwind v4 line-clamp utility
<p className="text-sm text-muted-foreground line-clamp-2">
  {previewText}
</p>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getServerSideProps` for data | Async server components with direct DB calls | Next.js 13+ App Router | No API layer needed for read-only pages |
| `params` as plain object | `params` as Promise (must await) | Next.js 15+ (enforced in 16) | All dynamic route pages must `await params` |
| Client-side data fetching with SWR/React Query | Server components for initial render | Next.js 13+ | Eliminates loading spinners for initial data; client fetching reserved for mutations and real-time updates |
| Custom auth middleware | `auth()` call in server components | Auth.js v5 | Direct session access without middleware complexity |

**Deprecated/outdated:**
- `getServerSideProps` / `getStaticProps`: Replaced by async server components in App Router
- Synchronous `params` access: Must use `await params` in Next.js 16
- `useRouter` for simple navigation: `next/link` is preferred for static navigation; `useRouter` is for programmatic navigation only

## Open Questions

1. **Text preview source for history cards**
   - What we know: HIST-02 requires "text preview" on cards. Segments are stored as JSONB. Loading all segments for every card works but is not optimal at scale.
   - What's unclear: Whether to pull full segments for the list or add a `textPreview` column.
   - Recommendation: Pull full rows including segments for MVP. Generate preview client-side from the first few segments. Revisit when users accumulate 50+ transcripts. Adding a column would require a migration for a display-only concern.

2. **Header navigation placement for unauthenticated users**
   - What we know: UIUX-01 requires "navigation between main transcript tool and history page." The `AuthButton` dropdown already has a disabled "History" item. The header has the "TranscriptGrab" brand text.
   - What's unclear: Whether to add a separate "History" link in the header visible to all users (with redirect for unsigned-in) or only make it visible to signed-in users.
   - Recommendation: Enable the "History" dropdown item in `AuthButton` (already gated behind auth). Optionally make the "TranscriptGrab" brand text a `Link` to `/` for easy navigation back from history. On the history page, add a back link. This keeps the header clean without adding visible links that don't work for unsigned-in users.

3. **Duration display format on cards**
   - What we know: `videoDuration` is stored as seconds (nullable integer). Cards need to show duration alongside other metadata.
   - What's unclear: Exact display format (e.g., "12:34" vs "12 min" vs "12m 34s").
   - Recommendation: Use the existing `formatTimestamp()` from `lib/format.ts` which already outputs `M:SS` or `H:MM:SS` format. This is consistent with the timestamp display in the transcript viewer.

## Sources

### Primary (HIGH confidence)
- Context7 `/drizzle-team/drizzle-orm-docs` -- select queries with where, orderBy(desc()), partial select, and/or filter composition
- Context7 `/vercel/next.js` -- server components, async params in dynamic routes, Link component, next/image
- Codebase inspection -- `lib/db/schema.ts` (transcripts table shape), `lib/db/queries.ts` (existing save query), `app/history/page.tsx` (stub with auth guard), `components/VideoInfo.tsx` (thumbnail display pattern), `components/TranscriptViewer.tsx` (segment rendering), `components/AuthButton.tsx` (dropdown with disabled History item), `app/layout.tsx` (header structure), `lib/format.ts` (formatTimestamp utility)

### Secondary (MEDIUM confidence)
- Next.js 16 async params requirement -- verified via Context7, but worth testing since the project was set up on Next.js 16

### Tertiary (LOW confidence)
- None. All patterns are verified against the existing codebase and official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed; everything is already installed and proven in prior phases
- Architecture: HIGH -- patterns directly from Context7 (Drizzle, Next.js) and verified against existing codebase patterns
- Pitfalls: HIGH -- async params, ownership checks, and null handling are well-documented; empty state is a standard UX concern

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable stack, 30 days)
