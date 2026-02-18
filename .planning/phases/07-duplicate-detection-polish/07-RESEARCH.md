# Phase 7: Duplicate Detection & Polish - Research

**Researched:** 2026-02-18
**Domain:** Pre-save duplicate detection, user-facing duplicate warnings, existing transcript lookup, auto-save edge cases
**Confidence:** HIGH

## Summary

Phase 7 elevates duplicate detection from a silent backend mechanism to a visible, user-facing feature. The foundation is already solid: the `transcripts` table has a `uniqueIndex("transcript_user_video_idx")` on `(userId, videoId)`, and the `saveTranscript` query uses `onConflictDoNothing` + `.returning()` to detect duplicates atomically. The `SaveTranscript` component already shows an "Already in your history" toast when a duplicate is detected during the save operation.

What is missing is the proactive experience described in the success criteria. Currently, the duplicate check happens _during_ the save operation (2.5 seconds after transcript display), and the only feedback is a dismissible toast. The phase requires: (1) a duplicate check _before_ the save fires, (2) a visible warning UI element (not just a toast), and (3) an action that lets the user view the existing saved transcript or proceed with a re-save. This means adding a new query to check for an existing transcript by `(userId, videoId)`, calling it from the client when a transcript loads, and conditionally rendering a warning banner in place of (or in addition to) the auto-save toast.

The key architectural question is how much the current auto-save flow changes. The simplest approach: add a lightweight "check" API endpoint that returns the existing transcript ID if one exists, call it when a transcript first loads (before the 2.5s save delay), and render an inline Alert banner with "View saved version" and "Save again" actions. If the user does nothing, the existing `onConflictDoNothing` behavior silently skips the save (no data loss, no race condition). If the user clicks "Save again", a future enhancement could use `onConflictDoUpdate` to overwrite with fresh data, but the current phase only requires the warning + view action.

**Primary recommendation:** Add a `GET /api/transcript/check?videoId=X` endpoint that returns `{ exists: boolean, transcriptId: string | null }`. Call it in `SaveTranscript` before the save timer fires. If the video exists, show an inline Alert banner with a link to `/history/{transcriptId}` and suppress the auto-save. If it does not exist, proceed with the current auto-save flow unchanged. Keep `onConflictDoNothing` as the database-level safety net regardless.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERS-04 | Duplicate detection warns or prevents saving the same video transcript twice | New `getTranscriptByVideoId(userId, videoId)` query returns existing transcript ID. New check API endpoint called before save timer fires. Inline Alert banner shown when duplicate detected. User can view existing transcript or dismiss. Auto-save suppressed for duplicates. `onConflictDoNothing` remains as database-level safety net. |
</phase_requirements>

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `drizzle-orm` | 0.45.1 | Query for existing transcript by userId + videoId | Installed |
| `next-auth` | 5.0.0-beta.30 | Session access for authenticated check endpoint | Installed |
| `sonner` | 2.0.7 | Toast notifications (already integrated) | Installed |
| `lucide-react` | 0.574.0 | Icons for warning banner (AlertTriangle, ExternalLink) | Installed |

### Supporting (already installed shadcn components)

| Component | Purpose | When to Use |
|-----------|---------|-------------|
| Alert, AlertTitle, AlertDescription | Duplicate warning banner | When existing transcript detected |
| Button | "View saved" and "Save again" actions | Inside duplicate warning banner |

### New (to install)

None. Every component and library needed is already installed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate check API endpoint | Client-side check against history page data | Would require loading all user transcripts on main page, heavy payload, unnecessary coupling between main page and history data |
| Inline Alert banner | Modal/dialog for duplicate warning | Modal is too aggressive for an informational warning. Inline banner is visible without being interruptive. Matches the "it just works" philosophy. |
| Suppress auto-save on duplicate | Still auto-save but show warning | Auto-saving a duplicate does nothing (onConflictDoNothing), but calling the save API for a known duplicate wastes a round trip. Suppressing is cleaner. |
| Pre-check query before save | Rely solely on onConflictDoNothing response | Current approach already detects duplicates post-save. But the success criteria explicitly require the check to happen "before save operation." A pre-check satisfies this requirement and enables showing the warning earlier (immediately when transcript loads vs. 2.5s later). |

## Architecture Patterns

### Recommended Changes to Existing Structure

```
lib/db/
  queries.ts            # ADD: getTranscriptByVideoId(userId, videoId) query
app/api/transcript/
  check/
    route.ts            # NEW: GET endpoint to check for existing transcript
components/
  SaveTranscript.tsx    # MODIFY: pre-check before save, show warning banner on duplicate
  DuplicateWarning.tsx  # NEW: inline Alert banner for duplicate detection
```

### Pattern 1: Duplicate Check Query

**What:** A simple SELECT query that checks if a transcript exists for a given userId + videoId combination. Returns the transcript ID and savedAt date if found.
**When to use:** Called by the check API endpoint before the auto-save fires.

```typescript
// lib/db/queries.ts (addition)
export async function getTranscriptByVideoId(userId: string, videoId: string) {
  const rows = await db
    .select({
      id: transcripts.id,
      savedAt: transcripts.savedAt,
    })
    .from(transcripts)
    .where(
      and(eq(transcripts.userId, userId), eq(transcripts.videoId, videoId))
    )
    .limit(1);

  return rows[0] ?? null;
}
```

**Source:** Existing `getTranscriptById` in `lib/db/queries.ts` uses the same pattern (select + where + limit 1). The `(userId, videoId)` unique index ensures this query is fast (index scan, not table scan).

### Pattern 2: Check API Endpoint

**What:** A lightweight GET endpoint that returns whether a transcript exists for the authenticated user and a given videoId.
**When to use:** Called from SaveTranscript component when a transcript first loads, before the save timer fires.

```typescript
// app/api/transcript/check/route.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getTranscriptByVideoId } from "@/lib/db/queries";

export const GET = auth(async function GET(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ exists: false, transcriptId: null });
  }

  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ exists: false, transcriptId: null });
  }

  const existing = await getTranscriptByVideoId(req.auth.user.id, videoId);

  return NextResponse.json({
    exists: !!existing,
    transcriptId: existing?.id ?? null,
  });
});
```

Design decisions:
- GET (not POST) because this is a read operation with no side effects.
- Returns `{ exists: false }` for unauthenticated users rather than 401, since the component should just skip the check silently.
- The videoId parameter is in the query string, making it simple to call from the client.

### Pattern 3: Pre-Check in SaveTranscript Component

**What:** Before starting the 2.5s save timer, call the check endpoint. If the video already exists, set state to show a duplicate warning and skip the save. If it does not exist, proceed with the current save flow.
**When to use:** Replacing the current immediate-timer-start behavior in SaveTranscript.

```typescript
// Conceptual flow in SaveTranscript.tsx
useEffect(() => {
  if (!session?.user?.id) return;
  if (savedRef.current === videoId) return;

  let cancelled = false;

  async function checkAndSave() {
    // Step 1: Check for existing transcript
    try {
      const checkRes = await fetch(`/api/transcript/check?videoId=${videoId}`);
      const checkData = await checkRes.json();

      if (cancelled) return;

      if (checkData.exists) {
        // Duplicate found - show warning, skip save
        setDuplicateInfo({ transcriptId: checkData.transcriptId });
        savedRef.current = videoId;
        return;
      }
    } catch {
      // Check failed - proceed with save (fail-open)
    }

    if (cancelled) return;

    // Step 2: No duplicate - wait 2.5s then save (existing behavior)
    await new Promise((resolve) => {
      timerRef.current = setTimeout(resolve, 2500);
    });

    if (cancelled) return;

    // Step 3: Save (existing code)
    savedRef.current = videoId;
    // ... existing save logic
  }

  checkAndSave();

  return () => {
    cancelled = true;
    if (timerRef.current) clearTimeout(timerRef.current);
  };
}, [session?.user?.id, videoId]);
```

Key design: The check is **fail-open**. If the check API fails or is slow, the save proceeds normally and `onConflictDoNothing` handles any duplicate at the database level. The check is an optimization for better UX, not a critical path.

### Pattern 4: Duplicate Warning Banner

**What:** An inline Alert component that appears where SaveTranscript renders (currently returns null). Shows a message like "This video is already in your history" with a "View saved transcript" link button.
**When to use:** When the pre-check detects an existing transcript.

```typescript
// components/DuplicateWarning.tsx
"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface DuplicateWarningProps {
  transcriptId: string;
}

export default function DuplicateWarning({ transcriptId }: DuplicateWarningProps) {
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Already in your history</AlertTitle>
      <AlertDescription>
        <p>You have already saved a transcript for this video.</p>
        <Button variant="outline" size="sm" className="mt-2" asChild>
          <Link href={`/history/${transcriptId}`}>
            View saved transcript
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

### Pattern 5: SaveTranscript Renders Content Conditionally

**What:** Currently `SaveTranscript` is a renderless component (returns `null`). For Phase 7, it needs to conditionally render the `DuplicateWarning` banner when a duplicate is detected. This changes its rendering behavior from "always null" to "null or warning banner."
**When to use:** The component already sits in the success state of `app/page.tsx` between `SaveTranscript` and `VideoInfo`.

```typescript
// SaveTranscript now returns either null (saving/saved) or DuplicateWarning
if (duplicateInfo) {
  return <DuplicateWarning transcriptId={duplicateInfo.transcriptId} />;
}
return null;
```

This is a minimal change to the page layout. The warning banner appears in the same position where SaveTranscript was already mounted. No changes needed to `app/page.tsx`.

### Anti-Patterns to Avoid

- **Blocking transcript display on duplicate check:** The check must be non-blocking. The transcript should display immediately; the warning banner appears asynchronously when the check completes.
- **Removing onConflictDoNothing from the save query:** The database-level conflict handling is the safety net. Even if the pre-check has a race condition (another tab saves between check and save), the database prevents actual duplicates. Keep both layers.
- **Showing a modal/dialog for duplicate detection:** Too aggressive. This is an informational notice, not an error. An inline banner matches the app's existing patterns (SignInNudge uses the same positioning concept).
- **Pre-loading all user transcripts on the main page:** Fetching the entire history to check duplicates client-side would be wasteful. A targeted query by videoId is a single index lookup.
- **Making "Save again" actually overwrite:** The success criteria say "user can choose to save again or view existing." The simplest interpretation is that the existing `onConflictDoNothing` behavior is sufficient. If the user generates a transcript for the same video, the new transcript data is identical to what they would save (same YouTube source). There is no user value in overwriting. "Save again" could be interpreted as just dismissing the warning and letting the save proceed (which will no-op at the database level). Or it could be omitted entirely, since the real user need is "see your existing saved version."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplicate detection | Client-side history lookup | Server-side query on `(userId, videoId)` unique index | Single index scan, no data transfer, atomic |
| Warning banner UI | Custom positioned div | shadcn Alert component (already installed) | Accessible (`role="alert"`), styled, handles icon layout |
| Navigation to saved transcript | Custom onClick + router.push | Next.js `<Link>` component | Prefetching, client-side navigation, standard pattern |
| Race condition prevention | Complex locking or mutex | `onConflictDoNothing` at database level + simple `savedRef` in component | PostgreSQL handles the hard concurrency case; React ref handles the client-side case |

**Key insight:** This phase is primarily a UX enhancement to existing infrastructure. The database already prevents actual duplicates. The work is surfacing that information to the user _before_ the save fires, through a check query and a visible banner.

## Common Pitfalls

### Pitfall 1: Check and Save Race Condition

**What goes wrong:** User opens video in two tabs simultaneously. Tab A checks (no duplicate), Tab B checks (no duplicate), Tab A saves (success), Tab B saves (should be duplicate but check said no).
**Why it happens:** The check and save are not atomic. Between the check response and the save request, another save can complete.
**How to avoid:** This is a non-issue because of `onConflictDoNothing`. Tab B's save silently no-ops at the database level. The only consequence is that Tab B shows a "Transcript saved to history" toast instead of the duplicate warning. This is acceptable. The data integrity is maintained by the unique index regardless.
**Warning signs:** None that would matter. The worst case is a slightly inaccurate toast message, not data corruption.

### Pitfall 2: Check Endpoint Latency Delaying Save

**What goes wrong:** The check API is slow (cold start, slow database), adding perceptible delay before the save or before the duplicate warning appears.
**Why it happens:** Additional round trip to the server before the save timer starts.
**How to avoid:** Fire the check immediately (no delay). If the check takes less than 2.5 seconds (likely, since it is a single index lookup), the result arrives before the save timer would have fired anyway. If the check is unusually slow, use the fail-open approach: start the save timer regardless and cancel it if the check returns "exists." Net timing impact is near zero for the normal case.
**Warning signs:** Duplicate warning appearing after the "Transcript saved" toast (check returned slower than save completed).

### Pitfall 3: SaveTranscript Becoming a Visible Component

**What goes wrong:** SaveTranscript currently returns `null` and is treated as a renderless component. Adding a visible render (the warning banner) changes its contract. If the parent layout does not expect visible content from SaveTranscript, the banner may appear in an unexpected position.
**Why it happens:** The component's role is changing from "invisible side-effect" to "conditional UI."
**How to avoid:** Check the position of `<SaveTranscript />` in `app/page.tsx`. Currently it is rendered first inside the success block, before `VideoInfo`. An Alert banner in this position would appear above the video info and below the input form, which is a good natural position for a warning. Verify this looks correct during implementation. Alternatively, extract the warning to a sibling component and use a callback/state-lift to coordinate.
**Warning signs:** Warning banner appearing in unexpected position or breaking layout flow.

### Pitfall 4: Unauthenticated Users Seeing Flash of Warning

**What goes wrong:** The check endpoint returns `{ exists: false }` for unauthenticated users, so no warning shows. But if there is a brief moment where `session` is loading (null), the check might not fire, and the component might flash or behave oddly.
**Why it happens:** `useSession()` has a loading state before the session is resolved.
**How to avoid:** Guard on `session?.user?.id` before firing the check, same as the existing guard before the save. If no session, do nothing (no check, no save, no warning). This is the existing behavior.
**Warning signs:** Check API called without authentication, returning misleading results.

### Pitfall 5: Stale Ref After Video Change

**What goes wrong:** User loads video A (exists in history, warning shown), then loads video B. The warning from video A persists because the `duplicateInfo` state was not reset.
**Why it happens:** State is not cleared when the videoId changes.
**How to avoid:** Reset `duplicateInfo` state whenever `videoId` changes. The `useEffect` cleanup function should clear both the timer ref and the duplicate info state. Or derive the duplicate state from the effect, resetting it at the top of the effect callback.
**Warning signs:** Duplicate warning showing for a video that is not actually saved.

## Code Examples

Verified patterns from codebase and official sources:

### Existing Duplicate Handling (current behavior)
```typescript
// Source: components/SaveTranscript.tsx (current)
// This is what Phase 7 builds upon
const data: { inserted: boolean; id: string | null } = await res.json();

if (data.inserted) {
  toast("Transcript saved to history", {
    action: {
      label: "View",
      onClick: () => { window.location.href = "/history"; },
    },
  });
} else {
  toast("Already in your history");
}
```

### Existing Database Constraint
```typescript
// Source: lib/db/schema.ts
// The unique index that prevents actual duplicates at the database level
(transcript) => [
  uniqueIndex("transcript_user_video_idx").on(
    transcript.userId,
    transcript.videoId
  ),
]
```

### Existing onConflictDoNothing
```typescript
// Source: lib/db/queries.ts
// This remains the safety net regardless of Phase 7 changes
const rows = await db
  .insert(transcripts)
  .values(data)
  .onConflictDoNothing({
    target: [transcripts.userId, transcripts.videoId],
  })
  .returning({ id: transcripts.id });

return { inserted: rows.length > 0, id: rows[0]?.id ?? null };
```

### Drizzle Select with Multiple Where Conditions
```typescript
// Source: existing lib/db/queries.ts getTranscriptById pattern
import { eq, and } from "drizzle-orm";

const rows = await db
  .select({ id: transcripts.id, savedAt: transcripts.savedAt })
  .from(transcripts)
  .where(and(eq(transcripts.userId, userId), eq(transcripts.videoId, videoId)))
  .limit(1);
```

### Auth.js GET Handler with Query Params
```typescript
// Source: existing app/api/transcript/save/route.ts pattern adapted to GET
export const GET = auth(async function GET(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ exists: false, transcriptId: null });
  }

  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");
  // ... query and respond
});
```

### shadcn Alert Component (already installed)
```typescript
// Source: components/ui/alert.tsx (already in codebase)
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

<Alert>
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle>Already in your history</AlertTitle>
  <AlertDescription>
    You have already saved a transcript for this video.
  </AlertDescription>
</Alert>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SELECT before INSERT (two queries, race-prone) | `onConflictDoNothing` + `.returning()` (single query, atomic) | PostgreSQL 9.5+ | Atomic duplicate detection, no race conditions at database level |
| Modal dialogs for warnings | Inline banners (Alert components) | Modern UX practice | Less disruptive, does not block user flow, dismissable by scrolling past |
| Custom duplicate tracking with localStorage | Server-side query against unique index | N/A | Authoritative source of truth (database), works across devices and sessions |

**Deprecated/outdated:**
- Client-side duplicate tracking (localStorage, sessionStorage): Unreliable across devices, cleared by user, not authoritative. Server-side check against database is the correct approach.
- `SELECT ... FOR UPDATE` locking for duplicate prevention: Overkill for this use case. `ON CONFLICT DO NOTHING` achieves the same result with less complexity and no lock contention.

## Open Questions

1. **Should "Save again" actually overwrite the existing transcript?**
   - What we know: The success criteria say "User can choose to save again or view existing saved transcript." The current `onConflictDoNothing` means a "save again" action would silently no-op at the database level.
   - What's unclear: Whether "save again" means overwriting with potentially updated transcript data (YouTube may have updated captions), or simply means "dismiss the warning and proceed" (which no-ops).
   - Recommendation: For v1, "save again" can be interpreted as dismissing the warning. The actual save will no-op via `onConflictDoNothing`, which is fine because YouTube transcripts rarely change. If overwrite is desired later, change `onConflictDoNothing` to `onConflictDoUpdate` with `set: { segments, savedAt: new Date() }` for just the "save again" code path. This is a one-line change and can be deferred.

2. **Should the duplicate warning replace the toast, or coexist?**
   - What we know: Currently a toast says "Already in your history." Phase 7 adds an inline Alert banner.
   - What's unclear: Whether to keep the toast as well.
   - Recommendation: Replace the toast with the banner. The banner is more visible and actionable (has a link to the saved transcript). Showing both would be redundant. The toast is still useful as a fallback if the pre-check fails and the save path detects the duplicate (fail-open scenario).

3. **Should the check endpoint be authenticated-only or fail-open?**
   - What we know: Unauthenticated users cannot have saved transcripts. The check for them would always return `{ exists: false }`.
   - What's unclear: Whether to return 401 for unauthenticated requests or silently return "not found."
   - Recommendation: Return `{ exists: false, transcriptId: null }` for unauthenticated requests. This avoids error handling on the client for a non-error case (unauthenticated users simply have no duplicates). The SaveTranscript component already guards on session before calling anything.

## Sources

### Primary (HIGH confidence)
- Codebase inspection (verified by reading source):
  - `lib/db/schema.ts` -- `uniqueIndex("transcript_user_video_idx")` on `(userId, videoId)` confirms database-level duplicate prevention
  - `lib/db/queries.ts` -- `saveTranscript` with `onConflictDoNothing` + `.returning()` confirms current duplicate handling
  - `components/SaveTranscript.tsx` -- Current auto-save flow with 2.5s delay, `savedRef` for client-side dedup, toast on duplicate
  - `app/api/transcript/save/route.ts` -- Save endpoint with auth wrapper pattern
  - `app/page.tsx` -- SaveTranscript position in render tree (first element in success block)
  - `components/ui/alert.tsx` -- Alert component already installed with AlertTitle, AlertDescription
  - `lib/db/queries.ts` -- `getTranscriptById` pattern for SELECT with and() + eq() + limit(1)
- PostgreSQL `ON CONFLICT DO NOTHING` with `RETURNING` behavior -- verified in Phase 3 research

### Secondary (MEDIUM confidence)
- shadcn/ui Alert component usage patterns -- standard composition with Lucide icons
- Auth.js v5 `auth()` wrapper for GET endpoints -- same pattern as existing POST endpoints in codebase

### Tertiary (LOW confidence)
- None. All findings verified against source code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies. Every component, utility, and pattern already exists in the codebase.
- Architecture: HIGH -- Builds directly on existing patterns (queries, API endpoints, component composition). The check endpoint follows the exact same auth wrapper pattern used by save and delete endpoints.
- Pitfalls: HIGH -- Race conditions analyzed against database constraints. Edge cases (stale state, auth loading, multi-tab) have clear mitigations. The dual-layer approach (pre-check + onConflictDoNothing) provides defense in depth.

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable domain; no fast-moving dependencies)
