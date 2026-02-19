---
phase: 10-ai-summaries-auto-save
verified: 2026-02-19T09:30:00Z
status: gaps_found
score: 3/5 success criteria verified
re_verification: false
gaps:
  - truth: "Requesting a summary for the same video a second time returns the cached result without hitting the Gemini API again"
    status: partial
    reason: "In-session module-level caching (currentSummary) works for panel re-open on same video within same DOM lifecycle. However the plan's localStorage cross-session caching was removed due to WXT storage.defineItem hangs. A user who navigates away and returns to the same video will re-call Groq. The server-side DB cache exists but is not used by the extension's direct Groq path."
    artifacts:
      - path: "extension/entrypoints/youtube.content/panel.ts"
        issue: "currentSummary is a module-level variable that resets when destroyPanel() is called (SPA navigation). No persistent cache survives panel destruction."
      - path: "extension/entrypoints/background/index.ts"
        issue: "summarize handler calls Groq directly on every request; no cache check before Groq call."
    missing:
      - "Persistent cross-session summary caching (localStorage or background script Map) for the direct Groq path"
  - truth: "Gemini API key never appears in the extension bundle; all AI calls proxy through the backend"
    status: failed
    reason: "The extension bypasses the backend /api/summarize endpoint entirely and calls api.groq.com directly with a hardcoded Groq API key embedded in extension/entrypoints/background/index.ts. This deviates from the stated success criterion and AI-04 requirement. Accepted for personal use per Phase 10 context note; will be remediated in Phase 11."
    artifacts:
      - path: "extension/entrypoints/background/index.ts"
        issue: "Line 124: GROQ_KEY hardcoded literal '[REDACTED]' in source — will appear in built extension bundle."
    missing:
      - "Move Groq API key server-side (either proxy through /api/summarize or use server-stored env var)"
      - "Or update AI-04 requirement text to reflect the approved Groq-direct architecture"
human_verification:
  - test: "Navigate to a YouTube video, open TranscriptGrab panel, click Summary tab, click Summarize, navigate away, return to same video, open panel, click Summary again"
    expected: "Second summarize request either loads instantly (cached) or re-calls Groq within ~2 seconds"
    why_human: "Verifying the UX acceptability of re-calling Groq vs a cache miss depends on perceived latency"
  - test: "Open two Chrome profiles — one signed in, one not. Fetch transcript in both and verify auto-save behavior."
    expected: "Signed-in profile shows Saved indicator and transcript appears in transcriptgrab.com/history. Unsigned profile sees no Saved indicator."
    why_human: "Auth-state-dependent behavior and network save to live Vercel deployment cannot be verified statically"
---

# Phase 10: AI Summaries + Auto-Save Verification Report

**Phase Goal:** User can generate AI summaries of video transcripts and have transcripts automatically saved to their history
**Verified:** 2026-02-19T09:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can click a summarize button and see 3-7 bullet point takeaways | VERIFIED | `tg-summarize-btn` in panel.ts L481; `handleSummarize()` calls Groq and renders bullets via `renderBullets()` |
| 2 | User can toggle between bullet point and paragraph summary formats | VERIFIED | `bulletsOption`/`paragraphOption` segmented control at L527-573; format toggle handlers fully wired |
| 3 | Same-video second request returns cached result without hitting API again | PARTIAL | In-session `currentSummary` module variable provides within-session cache. Cross-session cache removed (WXT storage.defineItem caused hangs). Re-call occurs after panel destruction. |
| 4 | When signed-in user fetches a transcript, it auto-saves to history | VERIFIED | `autoSaveTranscript()` fires non-blocking after `getTranscript` handler (background/index.ts L104-108); `sendMessage('autoSave', ...)` also sent from panel.ts L689-704 with saved indicator on success |
| 5 | Gemini API key never appears in extension bundle; all AI calls proxy through backend | FAILED | Extension calls api.groq.com directly. Groq key `[REDACTED]` hardcoded at background/index.ts L124. Server-side /api/summarize exists but is bypassed by extension. |

**Score:** 3/5 success criteria fully verified (SC1, SC2, SC4 pass; SC3 partial; SC5 failed due to approved architectural deviation)

---

### Required Artifacts

#### Plan 01 (Backend)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/summarize/route.ts` | Auth-gated POST endpoint | VERIFIED | Auth check at L9, DB cache at L25-31, generateSummary call at L34, saveSummary at L37, 429 handling at L47-51 |
| `lib/summarize.ts` | Groq SDK integration, parseSummaryResponse | VERIFIED (DEVIATION) | Uses Groq SDK (not Gemini). `parseSummaryResponse` at L21, `generateSummary` at L65. Functional and substantive. |
| `lib/db/schema.ts` | summaries table definition | VERIFIED | `summaries` pgTable at L76-90 with unique index on videoId |
| `lib/db/queries.ts` | getSummaryByVideoId, saveSummary helpers | VERIFIED | `getSummaryByVideoId` at L66, `saveSummary` at L75 |
| `drizzle/0002_conscious_sister_grimm.sql` | Migration SQL for summaries table | VERIFIED | Creates `summaries` table with `summary_video_idx` unique index |

#### Plan 02 (Extension)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/utils/messaging.ts` | summarize and autoSave message types | VERIFIED | ProtocolMap includes `summarize` and `autoSave` at L5-9 |
| `extension/utils/types.ts` | SummaryData type | VERIFIED | `SummaryData`, `SummaryResponse`, `SaveResult` at L24-37 |
| `extension/entrypoints/background/index.ts` | summarize handler (Groq direct), autoSave handler | VERIFIED | `onMessage('summarize', ...)` at L120, `onMessage('autoSave', ...)` at L174, `autoSaveTranscript()` at L9 |
| `extension/entrypoints/youtube.content/panel.ts` | Tabbed panel UI with transcript/summary tabs | VERIFIED | Tab bar at L334-346, both tab contents, `handleSummarize`, format toggle, saved indicator |
| `extension/entrypoints/youtube.content/style.css` | Tab bar, summary tab, segmented control, saved indicator CSS | VERIFIED | tg-tab-bar L362, tg-tab L373, tg-format-toggle L514, tg-summary-empty L420, tg-summarize-btn L454, tg-saved-indicator L605 |

---

### Key Link Verification

#### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/summarize/route.ts` | `lib/summarize.ts` | `generateSummary()` call | VERIFIED | L34: `const { bullets, paragraph } = await generateSummary(transcriptText)` |
| `app/api/summarize/route.ts` | `lib/db/queries.ts` | `getSummaryByVideoId` cache check | VERIFIED | L25: `const cached = await getSummaryByVideoId(videoId)` |
| `lib/summarize.ts` | `groq-sdk` | Groq SDK chat completion | VERIFIED (DEVIATION) | Plan specified `@google/genai`; implemented with `groq-sdk`. `groq.chat.completions.create()` at L75. |

#### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `panel.ts` | `messaging.ts` | `sendMessage('summarize', ...)` | VERIFIED | panel.ts L604; WXT auto-imports `sendMessage` from `utils/messaging.ts` (confirmed in `.wxt/types/imports.d.ts`) |
| `background/index.ts` | `api.groq.com` (DEVIATION: not `/api/summarize`) | fetch to Groq API directly | VERIFIED (DEVIATION) | background/index.ts L129: `fetch('https://api.groq.com/openai/v1/chat/completions', ...)` |
| `background/index.ts` | `/api/transcript/save` | autoSaveTranscript with credentials: include | VERIFIED | L26-38: POST to `${apiBase}/api/transcript/save` with `credentials: 'include'` |
| `panel.ts` | `background/index.ts` | `sendMessage('autoSave', ...)` after transcript fetch | VERIFIED | panel.ts L689-704: `sendMessage('autoSave', { videoId, transcript, metadata })` fires after successful transcript load |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AI-01 | 10-01, 10-02 | User can generate AI summary of video transcript | SATISFIED | End-to-end summary generation: panel Summarize button → background sendMessage → Groq API → parsed result displayed |
| AI-02 | 10-01, 10-02 | Summary displays as bullet points (3-7 key takeaways) | SATISFIED | `renderBullets()` at panel.ts L179, BULLETS: delimiter parsing in both lib/summarize.ts and background/index.ts |
| AI-03 | 10-01, 10-02 | User can toggle between bullet points and paragraph summary | SATISFIED | Segmented control (bulletsOption/paragraphOption) at panel.ts L527-574, format handlers fully wired |
| AI-04 | 10-01 | Summaries proxy through backend `/api/summarize` route (Gemini key server-side only) | NOT MET AS WRITTEN | Extension calls Groq directly (api.groq.com) with hardcoded key. Backend `/api/summarize` exists and uses Groq server-side but is not used by the extension. Approved deviation for Phase 10 personal use; remediation planned for Phase 11. |
| AI-05 | 10-01 | Summaries cached by videoId to avoid redundant API calls | PARTIAL | Server-side DB cache (lib/db/queries.ts getSummaryByVideoId) exists for /api/summarize endpoint only. Extension direct Groq path has in-session module-level cache (`currentSummary`) but no persistent cross-session cache. localStorage caching was removed due to WXT storage.defineItem hang. |
| AUTH-02 | 10-02 | Transcript auto-saves to history when user is signed in | SATISFIED | autoSaveTranscript fires non-blocking after getTranscript; sendMessage('autoSave') from panel shows saved indicator on success |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `extension/entrypoints/background/index.ts` | 124 | Hardcoded API key literal `[REDACTED]` | WARNING | Key will appear in built extension bundle. Acceptable for personal use per plan context; must be remediated before Chrome Web Store publishing (Phase 11). |

---

### Human Verification Required

#### 1. Auto-Save End-to-End

**Test:** Sign in to transcriptgrab.com, open Chrome extension, navigate to any YouTube video with captions, open the TranscriptGrab panel, wait for transcript to load, look for "Saved" indicator in the panel header, then visit transcriptgrab.com/history.
**Expected:** Transcript appears in history. "Saved" (green checkmark) indicator visible in panel header.
**Why human:** Requires a live Vercel deployment, authenticated session, and network save to Neon DB.

#### 2. Summary Generation Flow

**Test:** With the panel open and transcript loaded, click the "Summary" tab, then click "Summarize". Wait for generation. Toggle between Bullets and Paragraph. Click Copy.
**Expected:** Loading spinner appears, then 3-7 bullet points render. Paragraph toggle shows cohesive summary. Copy pastes correct format to clipboard.
**Why human:** Requires live Groq API call and visual rendering verification.

#### 3. Unauthenticated Summary Tab

**Test:** Open panel while not signed in to transcriptgrab.com. Click "Summary" tab.
**Expected:** "Sign in to summarize" link appears instead of the Summarize button. No Saved indicator in header. Transcript still loads normally.
**Why human:** Auth-state-conditional rendering depends on live cookie check.

#### 4. Cross-Session Caching Behavior

**Test:** Open panel on a YouTube video, click Summarize, wait for result. Navigate away to a different YouTube video. Navigate back to the original video and reopen the panel. Click Summary tab and Summarize again.
**Expected:** Per approved deviation, second request will re-call Groq (~2 second response). Verify this is acceptable UX given the sub-2s response time.
**Why human:** Assessing whether re-calling Groq on panel re-creation is acceptable UX — this is a subjective judgment the user explicitly approved.

---

### Gaps Summary

Two gaps prevent full goal achievement as originally specified:

**Gap 1 — AI-05 Caching (partial):** The plan required localStorage-persisted summary caching so same-video second requests return instantly. WXT's `storage.defineItem` caused background script hangs and was removed. The replacement is an in-session module-level `currentSummary` variable in panel.ts, which only survives as long as the panel DOM exists. Navigation to a new video destroys the panel and clears the cache. Re-summarizing the same video after navigating away re-calls Groq. Given Groq's sub-2s response time, this is functionally acceptable but does not satisfy the "loads from cache instantly" truth.

**Gap 2 — AI-04 / SC5 API key security (approved deviation):** The success criterion stated "Gemini API key never appears in extension bundle; all AI calls proxy through the backend." The implementation switched from Gemini to Groq and calls Groq directly from the extension background worker with a hardcoded API key in source. This deviates from both the success criterion text and AI-04 requirement as written. The deviation was intentional (Gemini free tier was unreliable) and approved per the phase context note. The key must be moved server-side before Chrome Web Store publishing (Phase 11 planned work). REQUIREMENTS.md should be updated to reflect the approved architectural change.

These gaps are intentional deviations documented in the Phase 10 context and summaries, not oversights. The core user-facing goal (summarization works, auto-save works) is achieved. The gaps are about persistence scope and API key handling.

---

_Verified: 2026-02-19T09:30:00Z_
_Verifier: Claude (gsd-verifier)_
