# Phase 3: Transcript Persistence - Research

**Researched:** 2026-02-18
**Domain:** Auto-save transcripts, duplicate detection, toast notifications, sign-in nudge
**Confidence:** HIGH

## Summary

This phase wires transcript persistence into the existing app flow. The database schema (Phase 2) and auth infrastructure (Phase 1) are already in place. The core work is: (1) a new API endpoint that accepts transcript data and writes it to the `transcripts` table, (2) client-side logic that fires a delayed save after a transcript displays for signed-in users, (3) toast notifications via Sonner for save feedback, and (4) an upgraded sign-in nudge that appears contextually after transcript generation.

The database already has the `transcripts` table with a `uniqueIndex("transcript_user_video_idx")` on `(userId, videoId)`. The user decision specifies "skip saving entirely" on duplicates (preserve original save date), which maps cleanly to PostgreSQL's `INSERT ... ON CONFLICT DO NOTHING ... RETURNING`. When the RETURNING clause returns an empty array, the row already existed -- this is the signal for the "Already in history" toast. When it returns the inserted row, that triggers the "Transcript saved to history" toast.

Video duration is a new field to store (user decision). The InnerTube player API already returns `videoDetails.lengthSeconds` in its response, but the current `innertubePlayer()` function doesn't extract it. A small addition to the existing transcript API can surface this value. For the Supadata fallback path, duration may not be available -- the field should be nullable.

**Primary recommendation:** Add a `POST /api/transcript/save` endpoint that uses `onConflictDoNothing` + `.returning()` to detect new-vs-duplicate. Client fires save via `setTimeout` after transcript displays. Install Sonner for toast feedback. Add `videoDuration` column to schema. No schema migration needed for core save logic (schema exists), only for the new duration column.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Save fires after a short delay (2-3 seconds) once the transcript displays -- not immediately on API response
- If the user already has this video saved (duplicate detection via userId+videoId unique index), skip saving entirely -- preserve the original save date
- Save failures: Claude's discretion on retry strategy
- Save path (client-side vs server-side): Claude's discretion based on architecture
- Successful new save: toast notification (e.g., "Transcript saved to history")
- Duplicate detected (already saved): different toast -- "Already in history" (possibly with link to saved version)
- Save failure: silent -- don't interrupt the user's workflow
- Show a nudge to unauthenticated users after a transcript displays -- they see the transcript value first, then the pitch to sign in
- Nudge visual style: Claude's discretion (inline banner vs subtle text)
- Dismissability: Claude's discretion (always present vs dismissable per session)
- Nudge copy: Claude's discretion (specific value prop vs minimal)
- Store video duration alongside existing fields (title, URL, thumbnail, segments, save date)
- Do NOT store language/locale -- not needed for current phases
- Formatted output storage vs regeneration from segments: Claude's discretion
- Word count storage vs on-demand computation: Claude's discretion

### Claude's Discretion
- Save retry strategy on failure
- Client-side vs server-side save path
- Toast design and whether it links to /history
- Sign-in nudge visual treatment, dismissability, and copy
- Whether to store pre-formatted output or regenerate from segments
- Whether to denormalize word count

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERS-01 | Transcript auto-saved to database when signed-in user generates one | Client-side delayed save (2-3s timeout) calls `POST /api/transcript/save`; server checks session, inserts with `onConflictDoNothing` |
| PERS-02 | Stored data includes full transcript text, timestamps, video title, video URL, thumbnail URL, and save date | Existing schema has all fields as JSONB segments + metadata columns; add `videoDuration` integer column via migration |
| PERS-03 | Unauthenticated users can still generate and copy transcripts without signing in | Save logic gates on `useSession()` -- no session means save never fires; transcript generation and copy remain untouched |
| PERS-05 | No artificial limits on number of saved transcripts | No limits in schema or API; Neon free tier 512MB is sufficient for text-heavy data |
</phase_requirements>

## Discretionary Decisions (Recommendations)

### Client-side save path (not server-side)
**Recommendation:** Fire the save from the client after transcript display, not from the server-side transcript API.

**Rationale:** The transcript API (`POST /api/transcript`) is currently stateless and serves both authenticated and unauthenticated users identically. Mixing persistence logic into it would add auth checks, metadata gathering, and error handling to a fast-path endpoint. A separate client-side save call keeps concerns separated: the transcript API fetches data, a separate `POST /api/transcript/save` endpoint persists it. This also naturally implements the "2-3 second delay" requirement -- a `setTimeout` in the React component.

**Trade-off:** Two API calls instead of one for signed-in users. Acceptable because the save is non-blocking (fire-and-forget with toast feedback) and the delay means the calls are staggered, not concurrent.

### No retry on save failure
**Recommendation:** Do not retry failed saves. Log the error client-side and fail silently.

**Rationale:** The user decision explicitly states save failures should be silent. Retrying adds complexity (exponential backoff, retry state, race conditions with new transcript requests) for a non-critical path. If the database is temporarily unavailable, the user can simply re-generate the transcript later. The transcript data is ephemeral (always re-fetchable from YouTube). A single failed save is not worth the complexity of retry logic.

### Do NOT store pre-formatted output -- regenerate from segments
**Recommendation:** Do not store formatted text. Regenerate from JSONB segments on demand.

**Rationale:** The existing `lib/format.ts` functions (`formatTranscriptText`, `generateSRT`) operate on `TranscriptSegment[]` and are fast (string concatenation over an array). Storing formatted output would duplicate data (~2x storage), require updating stored output if formatting logic changes, and still need segments for format switching (Phase 6 HIST-10). The segments column already captures everything needed.

### Do NOT denormalize word count -- compute on demand
**Recommendation:** Compute word count from segments when needed, don't store it.

**Rationale:** Word count is a simple `.reduce()` over segment text split by whitespace. Computing this is trivially fast for any transcript size. Storing it adds a column, requires keeping it in sync, and provides no query benefit (no one filters by word count). If needed for history card display, compute client-side when rendering.

### Toast with action link to /history
**Recommendation:** The "Transcript saved to history" toast should include an action button linking to `/history`. The "Already in history" toast should also link to `/history`.

**Rationale:** Sonner's `action` parameter supports an `onClick` callback, which can call `router.push('/history')`. This provides a natural discovery path for the history page (Phase 4) and follows the principle of progressive disclosure. Even though `/history` is a placeholder until Phase 4, the link can be added now and will work once Phase 4 is built. In the interim, the protected route redirect will send users to `/` -- harmless.

### Sign-in nudge: inline banner, session-dismissable, specific value prop
**Recommendation:** Replace the current `SignInHint` component with a more prominent inline banner that appears below the transcript viewer when a transcript is displayed. Make it dismissable per session (sessionStorage flag). Use specific copy: "Sign in to automatically save transcripts to your history".

**Rationale:** The current `SignInHint` is a single line of muted text at the bottom of the page (always visible, even before transcripts load). For Phase 3, the nudge should appear contextually -- only after the user sees a transcript, demonstrating the value before the ask. An inline banner (using the existing `Alert` component from shadcn/ui) with a dismiss button provides the right balance: visible but not annoying. Session-based dismissal means it reappears on next visit but doesn't nag during a single session.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `drizzle-orm` | 0.45.1 | ORM for insert/conflict queries | Installed |
| `@neondatabase/serverless` | 1.0.2 | Neon PostgreSQL driver | Installed |
| `next-auth` | 5.0.0-beta.30 | Session access via `auth()` and `useSession()` | Installed |

### New (to install)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sonner` | latest | Toast notifications (Sonner) | shadcn/ui's blessed toast solution; replaces old `@radix-ui/react-toast` |

### Not Needed
| Library | Why Not |
|---------|---------|
| `next-themes` | Already using custom theme logic in layout.tsx; Sonner works without next-themes if theme prop is set manually |

**Installation:**
```bash
npx shadcn@latest add sonner
```

This installs `sonner` as a dependency and creates `components/ui/sonner.tsx` wrapper component.

## Architecture Patterns

### Recommended Project Structure (additions)
```
app/
├── api/
│   └── transcript/
│       ├── route.ts          # Existing transcript fetch API
│       └── save/
│           └── route.ts      # NEW: transcript save API
lib/
├── db/
│   ├── index.ts              # Existing DB client
│   ├── schema.ts             # MODIFY: add videoDuration column
│   └── queries.ts            # NEW: transcript save query
components/
├── SaveTranscript.tsx         # NEW: auto-save hook/component
├── SignInNudge.tsx            # NEW: contextual sign-in banner (replaces SignInHint)
├── ui/
│   └── sonner.tsx            # NEW: added by shadcn CLI
app/
└── layout.tsx                # MODIFY: add <Toaster /> component
```

### Pattern 1: Save API Endpoint with Session Check
**What:** A dedicated API route that accepts transcript data and saves it for the authenticated user.
**When to use:** Called from client-side after transcript display delay.
**Example:**
```typescript
// app/api/transcript/save/route.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { saveTranscript } from "@/lib/db/queries";

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const result = await saveTranscript({
    userId: req.auth.user.id,
    videoId: body.videoId,
    videoUrl: body.videoUrl,
    videoTitle: body.videoTitle,
    thumbnailUrl: body.thumbnailUrl,
    videoDuration: body.videoDuration,
    segments: body.segments,
  });

  // result.inserted: true if new, false if duplicate
  return NextResponse.json(result);
});
```

### Pattern 2: onConflictDoNothing + Returning for Duplicate Detection
**What:** Insert with conflict handling that skips duplicates and returns empty array when skipped.
**When to use:** The core save query.
**Example:**
```typescript
// lib/db/queries.ts
import { db } from "@/lib/db";
import { transcripts } from "@/lib/db/schema";
import type { TranscriptSegment } from "@/lib/types";

export async function saveTranscript(data: {
  userId: string;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  thumbnailUrl: string | null;
  videoDuration: number | null;
  segments: TranscriptSegment[];
}) {
  const rows = await db
    .insert(transcripts)
    .values(data)
    .onConflictDoNothing({
      target: [transcripts.userId, transcripts.videoId],
    })
    .returning({ id: transcripts.id });

  // PostgreSQL RETURNING returns empty array when ON CONFLICT DO NOTHING fires
  return { inserted: rows.length > 0, id: rows[0]?.id ?? null };
}
```
**Source:** [PostgreSQL INSERT docs](https://www.postgresql.org/docs/current/sql-insert.html) -- RETURNING computes values based on each row actually inserted. [Drizzle ORM docs](https://context7.com/drizzle-team/drizzle-orm-docs/llms.txt) -- onConflictDoNothing with target.

### Pattern 3: Delayed Client-Side Save with useEffect
**What:** A React component/hook that fires the save API call after a timeout when a transcript is displayed.
**When to use:** Embedded in the main page when transcript is in success state.
**Example:**
```typescript
// components/SaveTranscript.tsx (conceptual)
"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface SaveTranscriptProps {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  thumbnailUrl: string | null;
  videoDuration: number | null;
  segments: TranscriptSegment[];
}

export function SaveTranscript(props: SaveTranscriptProps) {
  const { data: session } = useSession();
  const savedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (savedRef.current === props.videoId) return; // already saved this video in this session

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/transcript/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(props),
        });

        if (!res.ok) return; // silent failure

        const data = await res.json();
        savedRef.current = props.videoId;

        if (data.inserted) {
          toast("Transcript saved to history", {
            action: { label: "View", onClick: () => { /* router.push('/history') */ } },
          });
        } else {
          toast("Already in your history");
        }
      } catch {
        // Silent failure per user decision
      }
    }, 2500); // 2.5 second delay

    return () => clearTimeout(timer);
  }, [session, props.videoId]);

  return null; // renderless component
}
```

### Pattern 4: Sonner Toast Integration in Layout
**What:** Add the Sonner `<Toaster />` component to the root layout.
**When to use:** One-time setup, enables `toast()` calls anywhere in the app.
**Example:**
```typescript
// app/layout.tsx (addition)
import { Toaster } from "@/components/ui/sonner";

// Inside the body element, after </Providers>:
<Toaster />
```
**Source:** [shadcn/ui Sonner docs](https://ui.shadcn.com/docs/components/radix/sonner) -- verified via Context7.

### Pattern 5: Schema Migration for videoDuration
**What:** Add a nullable `videoDuration` integer column to the transcripts table.
**When to use:** One-time migration before deploying Phase 3.
**Example:**
```typescript
// lib/db/schema.ts (addition to transcripts table)
videoDuration: integer("videoDuration"), // seconds, nullable (Supadata fallback may not have this)
```

Then:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Pattern 6: Extracting Duration from InnerTube Response
**What:** The InnerTube player API returns `videoDetails.lengthSeconds` in its response. Extend the existing code to extract it.
**When to use:** When fetching transcripts via the InnerTube path.
**Example:**
```typescript
// In innertubePlayer() function, after parsing captions:
const lengthSeconds = data?.videoDetails?.lengthSeconds
  ? parseInt(data.videoDetails.lengthSeconds, 10)
  : null;

// Return alongside tracks
return { tracks, rawTracks, lengthSeconds };
```
**Source:** InnerTube API response structure -- `videoDetails.lengthSeconds` is a string representation of duration in seconds. Verified via [multiple InnerTube documentation sources](https://github.com/LuanRT/YouTube.js).

### Anti-Patterns to Avoid
- **Saving inside the transcript fetch API:** Mixes fetching and persistence concerns. The transcript API should remain stateless and fast.
- **Using `onConflictDoUpdate` for duplicate handling:** The user decision says "skip saving entirely, preserve the original save date." `DoUpdate` would overwrite the original record, changing `savedAt`. Use `DoNothing`.
- **Blocking transcript display on save completion:** The save is fire-and-forget. Never `await` the save in the rendering path.
- **Retrying saves with complex logic:** User decision says failures are silent. Don't build retry infrastructure for a non-critical path.
- **Storing formatted text in addition to segments:** Wastes storage and creates sync problems. Segments are the source of truth.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom notification system | Sonner via `shadcn@latest add sonner` | Handles animation, stacking, auto-dismiss, action buttons, dark mode |
| Duplicate detection | Manual SELECT-before-INSERT | `onConflictDoNothing` + `.returning()` | Atomic, race-free, single round trip; RETURNING tells you if insert happened |
| Session checking in API routes | Manual JWT decoding | `auth()` wrapper from next-auth | Already configured, returns typed session with user.id |
| Delayed execution | Custom timer management | `setTimeout` in `useEffect` with cleanup | Standard React pattern, cleanup prevents memory leaks on unmount |

**Key insight:** The hardest part of this phase is already done (schema exists, auth works). The remaining work is plumbing: connecting the UI event (transcript displayed) to the database (insert row) through a narrow API surface.

## Common Pitfalls

### Pitfall 1: Race Condition on Rapid Re-submissions
**What goes wrong:** User submits URL, transcript loads, save timer starts. User immediately submits a different URL. Both timers fire, potentially saving stale data or creating duplicate requests.
**Why it happens:** The 2-3 second delay means the save is in-flight while the user may have moved on.
**How to avoid:** Use a ref to track the current videoId. In the timeout callback, check that the videoId hasn't changed before saving. Clear the previous timeout on re-render (useEffect cleanup).
**Warning signs:** Save API called with videoId that doesn't match what's currently displayed.

### Pitfall 2: Auth Wrapper Changes POST Handler Signature
**What goes wrong:** Wrapping a route handler with `auth()` changes the function signature. The `req` parameter gains an `auth` property but is otherwise a standard `NextRequest`.
**Why it happens:** Auth.js v5's `auth()` wrapper for App Router routes extends the request object.
**How to avoid:** Export `POST = auth(async function POST(req) { ... })` -- the `req` parameter has both `NextRequest` properties and `req.auth` for session data. Verified via Context7 Auth.js docs.
**Warning signs:** TypeScript errors about missing `auth` property on request.

### Pitfall 3: Sonner Theme Mismatch
**What goes wrong:** Toasts appear with wrong background color (light toast on dark background or vice versa).
**Why it happens:** Sonner defaults to light theme. The project uses a custom theme toggle (not `next-themes`), so Sonner's automatic theme detection may not work.
**How to avoid:** Pass the `theme` prop to `<Toaster />` or use `richColors` for theme-aware styling. Since the project uses a `.dark` class on `<html>`, Sonner should detect this automatically, but verify during implementation. Alternatively, set `theme="system"` on the Toaster.
**Warning signs:** Toasts that look "off" in dark mode.

### Pitfall 4: Missing videoDuration from Supadata Fallback
**What goes wrong:** Saving a transcript fetched via Supadata with `null` duration when the schema expects a value.
**Why it happens:** The Supadata API response doesn't include video duration. The InnerTube path provides it via `videoDetails.lengthSeconds`, but Supadata doesn't.
**How to avoid:** Make `videoDuration` nullable in the schema (`integer("videoDuration")` without `.notNull()`). The save endpoint and client code must handle `null` duration gracefully.
**Warning signs:** Insert errors for transcripts fetched through the fallback path.

### Pitfall 5: JSONB Column Size with Large Transcripts
**What goes wrong:** Very long videos (3+ hours) produce large segment arrays that could approach practical limits.
**Why it happens:** A 3-hour video at 5-second intervals produces ~2,160 segments. At ~80 bytes each, that's ~170KB of JSONB -- well within PostgreSQL's 1GB JSONB limit, but worth being aware of.
**How to avoid:** No special handling needed. 170KB is negligible. The Neon free tier's 512MB limit is the real constraint, holding ~3,000 maximum-length transcripts. This is sufficient for Phase 3.
**Warning signs:** Neon storage approaching 512MB (monitor via Neon dashboard).

### Pitfall 6: Save Component Re-mounting on Format Toggle
**What goes wrong:** Toggling timestamps or changing language re-renders the page, potentially re-triggering the save.
**Why it happens:** If the save component depends on `segments` (which changes on language switch), the useEffect fires again.
**How to avoid:** Key the save effect on `videoId` only, not on `segments`. Use a ref to track whether a save has already been attempted for the current videoId. Language switching shouldn't trigger a re-save.
**Warning signs:** Multiple save API calls for the same video in quick succession.

## Code Examples

Verified patterns from official sources:

### Drizzle onConflictDoNothing with Returning
```typescript
// Source: Drizzle ORM docs (Context7 /drizzle-team/drizzle-orm-docs)
// PostgreSQL: RETURNING returns empty array when conflict fires and row is skipped
const rows = await db
  .insert(transcripts)
  .values({ userId, videoId, videoUrl, videoTitle, thumbnailUrl, videoDuration, segments })
  .onConflictDoNothing({ target: [transcripts.userId, transcripts.videoId] })
  .returning({ id: transcripts.id });

const wasInserted = rows.length > 0;
```

### Auth.js Session in App Router API Route
```typescript
// Source: Auth.js docs (Context7 /nextauthjs/next-auth)
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const POST = auth(async function POST(req) {
  if (!req.auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = req.auth.user.id;
  // ... use userId
});
```

### Sonner Toast with Action
```typescript
// Source: shadcn/ui Sonner docs (Context7 /shadcn-ui/ui)
import { toast } from "sonner";

// Simple toast
toast("Transcript saved to history");

// Toast with action button
toast("Transcript saved to history", {
  action: {
    label: "View",
    onClick: () => router.push("/history"),
  },
});
```

### Sonner Setup in Layout
```tsx
// Source: shadcn/ui Sonner docs (Context7 /shadcn-ui/ui)
import { Toaster } from "@/components/ui/sonner";

// In layout.tsx body, after main content:
<Toaster />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@radix-ui/react-toast` + custom wrapper | Sonner via `shadcn@latest add sonner` | shadcn/ui Dec 2023 | Sonner is now the blessed toast solution for shadcn/ui |
| Manual SELECT-before-INSERT for duplicates | `onConflictDoNothing` + `.returning()` | PostgreSQL 9.5+ | Atomic duplicate detection in single query |
| `getServerSession()` in API routes | `auth()` wrapper function | Auth.js v5 / next-auth 5.x | Simpler API, typed session, works with App Router |

**Deprecated/outdated:**
- `@radix-ui/react-toast` with shadcn: The old toast component still works but Sonner is the recommended replacement.
- `getServerSession(authOptions)`: Replaced by `auth()` in Auth.js v5.
- `getToken()` for API route auth: Replaced by `auth()` wrapper which provides full session.

## Open Questions

1. **Sonner theme detection with custom `.dark` class**
   - What we know: The project uses a custom inline script to add `.dark` to `<html>` based on localStorage. Sonner checks for `.dark` class on the root element.
   - What's unclear: Whether Sonner auto-detects this or needs explicit `theme` prop.
   - Recommendation: Test during implementation. If detection fails, pass `theme="system"` to `<Toaster />`. LOW risk -- easy to fix.

2. **Video duration availability through Supadata**
   - What we know: InnerTube returns `videoDetails.lengthSeconds`. Supadata's response schema doesn't include duration in its documented fields.
   - What's unclear: Whether Supadata's API has an undocumented duration field.
   - Recommendation: Make `videoDuration` nullable. Populate from InnerTube when available, leave null for Supadata fallback. This is fine -- duration is display-only metadata, not critical. LOW impact.

3. **Toast display when /history doesn't exist yet**
   - What we know: Phase 4 builds the history page. Phase 3 adds toasts that may link to `/history`.
   - What's unclear: Whether the "View" action button on toast should exist before the history page does.
   - Recommendation: Include the action button now. The proxy already redirects unauthenticated users from `/history` to `/`. For authenticated users hitting a non-existent page, Next.js returns 404. This is acceptable for a brief period between Phase 3 and Phase 4 deployment. Alternatively, omit the action button and add it in Phase 4. Planner's call.

## Sources

### Primary (HIGH confidence)
- Context7 `/drizzle-team/drizzle-orm-docs` -- `onConflictDoNothing`, `onConflictDoUpdate`, `.returning()`, insert patterns
- Context7 `/shadcn-ui/ui` -- Sonner toast setup, `npx shadcn@latest add sonner`, `<Toaster />` in layout, `toast()` API with actions
- Context7 `/nextauthjs/next-auth` -- `auth()` wrapper for App Router API routes, `req.auth.user.id` access pattern
- [PostgreSQL INSERT docs](https://www.postgresql.org/docs/current/sql-insert.html) -- RETURNING behavior with ON CONFLICT DO NOTHING
- Codebase inspection -- `lib/db/schema.ts`, `auth.ts`, `app/api/transcript/route.ts`, `app/page.tsx`, `components/SignInHint.tsx`

### Secondary (MEDIUM confidence)
- [YouTube InnerTube videoDetails.lengthSeconds](https://github.com/LuanRT/YouTube.js) -- duration field availability verified through multiple InnerTube client implementations
- [shadcn/ui Sonner docs](https://ui.shadcn.com/docs/components/radix/sonner) -- installation and usage patterns

### Tertiary (LOW confidence)
- Sonner theme auto-detection behavior with custom `.dark` class -- needs implementation-time verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries beyond Sonner; all existing stack is proven
- Architecture: HIGH -- patterns directly from official docs (Drizzle, Auth.js, shadcn/ui) and verified against existing codebase
- Pitfalls: HIGH -- race conditions and theme issues are well-documented; JSONB and duration concerns verified against actual data shapes

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable stack, 30 days)
