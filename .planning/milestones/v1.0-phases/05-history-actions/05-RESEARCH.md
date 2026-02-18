# Phase 5: History Actions - Research

**Researched:** 2026-02-18
**Domain:** Client-side actions (copy, delete, bulk-select) on server-persisted transcript data
**Confidence:** HIGH

## Summary

Phase 5 adds three action capabilities to the existing history UI: one-click copy from history, individual delete with confirmation, and bulk-select-and-delete. The existing codebase already has a working copy pattern in `ActionButtons.tsx` (using `navigator.clipboard.writeText` with a `copied` boolean state), Sonner toasts for feedback, and an authenticated API route pattern in `app/api/transcript/save/route.ts`. The main new work is: (1) a delete API endpoint, (2) two new shadcn components (checkbox, alert-dialog), (3) converting the history list page from a pure server component to a hybrid with client interactivity for selection state and delete actions.

The history list page (`app/history/page.tsx`) is currently a server component that fetches data and renders `HistoryCard` components. `HistoryCard` is already a client component (prior decision from Phase 04), which simplifies adding click handlers for copy and checkbox selection. The transcript detail page (`app/history/[id]/page.tsx`) is a server component that renders `TranscriptViewer` with the full segment data.

**Primary recommendation:** Build a single `DELETE /api/transcript/delete` route that accepts either a single ID or an array of IDs, use `inArray` from Drizzle ORM for the batch case, add shadcn checkbox and alert-dialog components, and convert the history list to support a "selection mode" managed by a client wrapper component.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HIST-05 | User can one-click copy full transcript text from history | Existing `navigator.clipboard.writeText` + `formatTranscriptText` pattern in ActionButtons.tsx. Segments already loaded in HistoryCard (full row select, Phase 04 decision). Copy button on HistoryCard and/or detail page. |
| HIST-06 | User can delete individual transcripts from history | New DELETE API route with auth check + `db.delete(transcripts).where(and(eq(id), eq(userId)))`. shadcn alert-dialog for confirmation. `router.refresh()` to revalidate server component data after delete. |
| HIST-07 | User can bulk-select and delete multiple transcripts | shadcn checkbox on each card, selection state in parent client component, `inArray(transcripts.id, ids)` for batch delete. Same DELETE endpoint accepts array of IDs. |
| UIUX-04 | Clean copy-to-clipboard with visual feedback | Sonner toast (already wired in layout.tsx) for copy confirmation. Existing pattern: `toast("Copied to clipboard")`. Button text swap ("Copy" to "Copied!") as secondary feedback matches ActionButtons.tsx pattern. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | Delete queries with `eq`, `and`, `inArray` | Already installed, used for all DB operations |
| sonner | ^2.0.7 | Toast notifications for copy/delete feedback | Already installed and wired in layout.tsx |
| lucide-react | ^0.574.0 | Icons (Copy, Trash2, Check, CheckSquare) | Already installed, used throughout codebase |
| next/navigation | (bundled) | `useRouter().refresh()` for revalidating server data | Built into Next.js, standard pattern for post-mutation refresh |

### Supporting (new shadcn components to install)

| Component | Install Command | Purpose | When to Use |
|-----------|----------------|---------|-------------|
| checkbox | `npx shadcn@latest add checkbox` | Bulk-select checkboxes on history cards | HIST-07 bulk selection |
| alert-dialog | `npx shadcn@latest add alert-dialog` | Delete confirmation prompt | HIST-06 and HIST-07 delete confirmation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| alert-dialog (shadcn) | `window.confirm()` | Native confirm is simpler but cannot be styled, breaks dark theme, no async support. alert-dialog is the standard shadcn pattern for destructive confirmations. |
| `router.refresh()` | `revalidatePath` server action | `revalidatePath` requires a server action; `router.refresh()` is simpler for client-initiated mutations and re-fetches the same RSC payload. Both work, but `router.refresh()` keeps the pattern client-side. |
| Single delete + batch delete endpoints | One unified endpoint | A single endpoint accepting `{ ids: string[] }` is simpler. Single delete is just `ids: ["one-id"]`. No need for two routes. |

**Installation:**
```bash
npx shadcn@latest add checkbox alert-dialog
```

## Architecture Patterns

### Recommended Changes to Existing Structure

```
app/
  api/transcript/
    delete/route.ts      # NEW: DELETE endpoint (single + batch)
  history/
    page.tsx             # MODIFY: wrap card list in client component for selection
    [id]/page.tsx        # MODIFY: add copy + delete buttons
components/
  HistoryCard.tsx        # MODIFY: add checkbox, copy button, delete button
  HistoryActions.tsx     # NEW: client wrapper managing selection state + bulk actions toolbar
  ui/
    checkbox.tsx         # NEW: shadcn component
    alert-dialog.tsx     # NEW: shadcn component
lib/db/
  queries.ts             # MODIFY: add deleteTranscript and deleteTranscripts functions
```

### Pattern 1: Unified Delete API Route

**What:** A single `POST /api/transcript/delete` endpoint that accepts `{ ids: string[] }` and deletes all matching transcripts owned by the authenticated user.
**When to use:** Both individual delete (one ID) and bulk delete (multiple IDs) hit the same endpoint.

```typescript
// Source: Drizzle ORM docs + existing save route pattern
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { deleteTranscripts } from "@/lib/db/queries";

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Missing transcript IDs" }, { status: 400 });
  }

  const deleted = await deleteTranscripts(ids, req.auth.user.id);
  return NextResponse.json({ deleted });
});
```

Note: Uses POST method rather than DELETE because Next.js `auth()` wrapper with App Router works cleanly with POST, and the request body carries the IDs array. This matches the existing `save/route.ts` pattern.

### Pattern 2: Drizzle Batch Delete with Ownership Check

**What:** Delete query that combines `inArray` for batch IDs with `eq` for userId ownership, preventing users from deleting other users' transcripts.
**When to use:** Every delete operation.

```typescript
// Source: Drizzle ORM docs (delete + inArray operators)
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { transcripts } from "@/lib/db/schema";

export async function deleteTranscripts(ids: string[], userId: string) {
  const rows = await db
    .delete(transcripts)
    .where(and(inArray(transcripts.id, ids), eq(transcripts.userId, userId)))
    .returning({ id: transcripts.id });

  return rows.length;
}
```

### Pattern 3: Client-Side Selection State with Parent Wrapper

**What:** A client component that wraps the history card list, manages a `Set<string>` of selected IDs, and passes selection callbacks to each card. Enables bulk operations toolbar.
**When to use:** History list page needs interactive selection without making the data-fetching server component a client component.

```typescript
// Pattern: Server component fetches data, passes to client wrapper
// app/history/page.tsx (server component)
const transcripts = await getUserTranscripts(session.user.id);
return <HistoryActions transcripts={transcripts} />;

// components/HistoryActions.tsx (client component)
"use client";
const [selected, setSelected] = useState<Set<string>>(new Set());
const [selectionMode, setSelectionMode] = useState(false);
```

### Pattern 4: Copy from History Card

**What:** Each HistoryCard already has full segments data (Phase 04 decision: full row select). Copy builds plain text from segments using existing `formatTranscriptText` and writes to clipboard.
**When to use:** HIST-05 one-click copy from history list.

```typescript
// Reuse existing pattern from ActionButtons.tsx
import { formatTranscriptText } from "@/lib/format";

function handleCopy(segments: TranscriptSegment[]) {
  const text = formatTranscriptText(segments, false);
  navigator.clipboard.writeText(text).then(() => {
    toast("Copied to clipboard");
  });
}
```

### Pattern 5: Post-Delete Refresh with router.refresh()

**What:** After a successful delete API call, call `router.refresh()` to re-fetch the server component data on `/history`. This causes Next.js to re-execute the server component (including the DB query) and update the UI without a full page navigation.
**When to use:** After any delete operation on the history list page.

```typescript
import { useRouter } from "next/navigation";

const router = useRouter();
// After successful delete:
router.refresh();
```

### Anti-Patterns to Avoid

- **Optimistic delete without server confirmation:** Always wait for the API response before removing items from the UI. Premature removal creates confusing UX if the delete fails.
- **Separate endpoints for single vs. batch delete:** Unnecessary complexity. One endpoint with `ids: string[]` handles both cases.
- **Making the history page a full client component:** Loses RSC benefits (server-side data fetching, no client-side waterfall). Keep the page as a server component; delegate interactivity to a client wrapper.
- **Storing selection state in URL params:** Overkill for transient UI state. `useState` in the client wrapper is sufficient.
- **Using `window.confirm()` for delete confirmation:** Cannot be styled, breaks dark theme consistency, looks unprofessional.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Delete confirmation dialog | Custom modal with portal/focus-trap | shadcn alert-dialog (Radix AlertDialog) | Focus management, ESC key, backdrop click, screen reader support are all handled by Radix primitives |
| Styled checkbox | Custom div with click handler | shadcn checkbox (Radix Checkbox) | Keyboard navigation, indeterminate state, accessibility labels handled automatically |
| Toast notifications | Custom notification system | Sonner (already installed) | Already wired in layout, has action buttons, auto-dismiss, stacking |
| Clipboard write | Custom textarea selection trick | `navigator.clipboard.writeText()` | Modern API, already used in ActionButtons.tsx, supported by all target browsers |

**Key insight:** Every UI primitive needed for this phase either already exists in the codebase or is available as a shadcn component. The phase is almost entirely wiring and composition, not novel UI development.

## Common Pitfalls

### Pitfall 1: Forgetting userId in Delete WHERE Clause
**What goes wrong:** Deleting by `id` alone without checking `userId` allows any authenticated user to delete any transcript by guessing UUIDs.
**Why it happens:** The ID is a UUID so it feels "unguessable," but security-by-obscurity is not acceptable.
**How to avoid:** Always include `eq(transcripts.userId, userId)` in the delete WHERE clause. This mirrors the existing `getTranscriptById` pattern.
**Warning signs:** Delete query with only one condition instead of two.

### Pitfall 2: Not Clearing Selection State After Bulk Delete
**What goes wrong:** After deleting selected items, the `selected` Set still contains the deleted IDs. If new items happen to get the same IDs (unlikely with UUIDs but still), they would appear pre-selected. More practically, the selection count badge shows stale numbers.
**How to avoid:** Clear the selection set and exit selection mode after a successful bulk delete.
**Warning signs:** Selection count badge still showing after delete completes.

### Pitfall 3: Clipboard API Requires Secure Context
**What goes wrong:** `navigator.clipboard.writeText()` fails silently or throws on HTTP (non-HTTPS) origins.
**Why it happens:** The Clipboard API requires a secure context (HTTPS or localhost).
**How to avoid:** This app is deployed to Vercel (HTTPS) and dev uses localhost, so both are secure contexts. No action needed, but worth noting. The existing `ActionButtons.tsx` copy already works, confirming the pattern is safe.
**Warning signs:** Copy button does nothing on non-secure origins.

### Pitfall 4: Event Propagation with Nested Interactive Elements
**What goes wrong:** Clicking a copy or delete button on a HistoryCard also triggers the `<Link>` navigation to the detail page, because the card is wrapped in a `<Link>`.
**Why it happens:** Click events bubble up from buttons to the parent Link.
**How to avoid:** Call `e.stopPropagation()` and `e.preventDefault()` on button click handlers, or restructure the card so buttons are outside the Link wrapper.
**Warning signs:** Clicking "Copy" or "Delete" navigates to the detail page.

### Pitfall 5: Race Condition on Rapid Multiple Deletes
**What goes wrong:** User clicks delete on several items quickly before first delete completes. Each `router.refresh()` call triggers a re-render, potentially causing flickering or stale data.
**How to avoid:** Disable delete buttons while a delete is in flight (loading state). For bulk delete, batch all IDs into a single API call rather than calling delete per-item.
**Warning signs:** Multiple simultaneous fetch calls to the delete endpoint.

## Code Examples

Verified patterns from official sources and existing codebase:

### Delete Query (Drizzle ORM)
```typescript
// Source: Drizzle ORM docs + existing queries.ts patterns
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { transcripts } from "@/lib/db/schema";

export async function deleteTranscripts(ids: string[], userId: string) {
  const rows = await db
    .delete(transcripts)
    .where(and(inArray(transcripts.id, ids), eq(transcripts.userId, userId)))
    .returning({ id: transcripts.id });

  return rows.length;
}
```

### Alert Dialog for Delete Confirmation (shadcn)
```typescript
// Source: shadcn/ui docs - alert-dialog component
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="icon">
      <Trash2 className="h-4 w-4" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete transcript?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently remove this transcript from your history.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Controlled Checkbox (shadcn)
```typescript
// Source: shadcn/ui docs - checkbox component
import { Checkbox } from "@/components/ui/checkbox";

<Checkbox
  checked={selected.has(transcript.id)}
  onCheckedChange={(checked) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(transcript.id);
      else next.delete(transcript.id);
      return next;
    });
  }}
/>
```

### Copy to Clipboard with Toast (existing pattern)
```typescript
// Source: existing ActionButtons.tsx + Sonner toast from SaveTranscript.tsx
import { formatTranscriptText } from "@/lib/format";
import { toast } from "sonner";

function handleCopy(segments: TranscriptSegment[]) {
  const text = formatTranscriptText(segments, false);
  navigator.clipboard.writeText(text).then(() => {
    toast("Copied to clipboard");
  });
}
```

### Auth-Protected API Route (existing pattern)
```typescript
// Source: existing app/api/transcript/save/route.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const POST = auth(async function POST(req) {
  if (!req.auth?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... handle request
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `document.execCommand('copy')` | `navigator.clipboard.writeText()` | 2020+ | Cleaner API, Promise-based, no dummy textarea needed |
| `window.confirm()` for destructive actions | Radix AlertDialog (shadcn) | 2022+ | Styleable, accessible, consistent with design system |
| Client-side data fetching with `useEffect` | RSC data fetching + `router.refresh()` | Next.js 13+ (2023) | No loading spinners, no client waterfalls, data always fresh |

**Deprecated/outdated:**
- `document.execCommand('copy')`: Deprecated, replaced by Clipboard API
- `window.confirm()`: Not deprecated but not styleable; use dialog component for consistent UX

## Open Questions

1. **Copy button placement: card vs. detail page vs. both?**
   - What we know: Segments are available in both HistoryCard (full row select) and detail page. The requirement says "one-click copy from history" which implies the list page.
   - What's unclear: Whether copy should also be on the detail page (it currently has TranscriptViewer but no ActionButtons).
   - Recommendation: Add copy to both. HistoryCard gets a small icon button; detail page gets a full "Copy Transcript" button. This is a planner decision.

2. **Selection mode UX: always-visible checkboxes vs. toggle?**
   - What we know: Always-visible checkboxes add visual clutter. A "Select" toggle button is cleaner but requires an extra click.
   - What's unclear: User preference for either approach.
   - Recommendation: Use a "Select" button in the page header that toggles checkboxes on cards. This keeps the default list clean while making bulk operations accessible. Planner can decide.

3. **Delete from detail page?**
   - What we know: HIST-06 says "delete individual transcripts from history." The detail page shows a single transcript.
   - What's unclear: Whether delete should only be on the list or also on the detail page.
   - Recommendation: Add delete to the detail page too, with redirect back to `/history` after deletion. Natural user flow.

## Sources

### Primary (HIGH confidence)
- Drizzle ORM docs (`/drizzle-team/drizzle-orm-docs`) - delete queries, inArray operator, returning clause
- shadcn/ui docs (`/shadcn-ui/ui`) - alert-dialog, checkbox components, CLI installation
- Existing codebase files (verified by reading source):
  - `components/ActionButtons.tsx` - clipboard copy pattern
  - `components/SaveTranscript.tsx` - Sonner toast pattern
  - `app/api/transcript/save/route.ts` - auth-protected API route pattern
  - `lib/db/queries.ts` - Drizzle query patterns with `eq`, `and`, `desc`
  - `lib/db/schema.ts` - transcripts table schema with userId foreign key
  - `components/HistoryCard.tsx` - client component with full segment data
  - `app/history/page.tsx` - server component data fetching pattern

### Secondary (MEDIUM confidence)
- Next.js `router.refresh()` for revalidating RSC data after mutations (well-documented Next.js pattern, verified in prior phase research at `.planning/research/PITFALLS.md`)

### Tertiary (LOW confidence)
- None. All findings verified against source code or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies needed beyond two shadcn components. All patterns already proven in codebase.
- Architecture: HIGH - Direct extension of existing patterns (API route, Drizzle queries, client components, clipboard API).
- Pitfalls: HIGH - Event propagation and auth checks are well-understood; identified from code review of existing HistoryCard Link wrapper.

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable domain; no fast-moving dependencies)
