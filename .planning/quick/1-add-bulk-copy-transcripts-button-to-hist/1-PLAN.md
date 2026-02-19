---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - components/HistoryActions.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "User can select multiple transcripts and copy them all to clipboard with one click"
    - "Copied text includes each video title as a header followed by its transcript text"
    - "Success toast shows the count of transcripts copied"
    - "Copy button is disabled when no transcripts are selected"
  artifacts:
    - path: "components/HistoryActions.tsx"
      provides: "Bulk copy button and handler in selection mode toolbar"
      contains: "handleBulkCopy"
  key_links:
    - from: "components/HistoryActions.tsx"
      to: "lib/format.ts"
      via: "import formatTranscriptText"
      pattern: "formatTranscriptText"
---

<objective>
Add a "Copy Selected" bulk action button to the history selection mode toolbar.

Purpose: Let users copy multiple transcripts to clipboard at once instead of one at a time.
Output: Updated HistoryActions.tsx with bulk copy functionality.
</objective>

<execution_context>
@/Users/jakesimpson/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jakesimpson/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@components/HistoryActions.tsx
@components/HistoryCard.tsx (lines 61-70 for copy pattern reference)
@lib/format.ts (formatTranscriptText function)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add bulk copy button and handler to HistoryActions</name>
  <files>components/HistoryActions.tsx</files>
  <action>
    1. Add import for `formatTranscriptText` from `@/lib/format` (same import used in HistoryCard.tsx).
    2. Add import for `Copy` icon from `lucide-react` (add to existing lucide import on line 6).
    3. Add a `handleBulkCopy` async function alongside `handleBulkDelete`. Logic:
       - Get the selected transcripts: `filteredTranscripts.filter(t => selected.has(t.id))`
       - For each selected transcript, build a block: the video title as a header line, then `formatTranscriptText(t.segments, false)` for the body
       - Join all blocks with `\n\n---\n\n` as separator (visual divider between transcripts)
       - Write combined text to clipboard via `navigator.clipboard.writeText(combined)`
       - Show toast: `Copied ${selected.size} transcript(s) to clipboard`
    4. Add the "Copy Selected" button in the selection mode toolbar (the div at line 111), positioned BEFORE the Delete Selected AlertDialog (line 123). The button should:
       - Use `variant="outline"` and `size="sm"` to match other toolbar buttons
       - Show the Copy icon with `className="mr-1.5 h-4 w-4"` (matches Trash2 icon styling)
       - Be disabled when `selected.size === 0`
       - Call `handleBulkCopy` on click
       - Text: "Copy Selected"
  </action>
  <verify>
    Run `npm run build` to confirm no type errors or build failures.
  </verify>
  <done>
    Selection mode toolbar shows "Copy Selected" button. Clicking it with transcripts selected copies all selected transcripts (with title headers and dividers) to clipboard and shows a count toast. Button is disabled when nothing is selected.
  </done>
</task>

</tasks>

<verification>
- `npm run build` passes with no errors
- In the browser: enter selection mode, select 2+ transcripts, click "Copy Selected", paste into a text editor and verify output contains each video title followed by its transcript text, separated by dividers
</verification>

<success_criteria>
- Build succeeds
- "Copy Selected" button appears in selection mode toolbar between "Deselect All" and "Delete Selected"
- Button disabled when 0 selected, enabled when 1+ selected
- Clicking copies formatted multi-transcript text to clipboard
- Toast confirms count of copied transcripts
</success_criteria>

<output>
After completion, create `.planning/quick/1-add-bulk-copy-transcripts-button-to-hist/1-SUMMARY.md`
</output>
