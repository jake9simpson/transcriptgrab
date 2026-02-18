# Codebase Concerns

**Analysis Date:** 2026-02-17

## Tech Debt

**Hardcoded InnerTube API Key in Source Code:**
- Issue: `INNERTUBE_API_KEY` is hardcoded in `lib/youtube.ts` line 5 as a public constant. This key is visible in the source repository and client bundles.
- Files: `lib/youtube.ts:5`
- Impact: Key exposure in git history; vulnerable to abuse if attacker scrapes the public repo; no way to rotate without code change.
- Fix approach: Move to `process.env.INNERTUBE_API_KEY`, set via Vercel environment variables with `npx vercel env add`. Implement fallback if key is missing.

**Bare Error Catching with `unknown` Type:**
- Issue: Multiple catch blocks use `catch (err: unknown)` without proper narrowing before accessing `.message`.
- Files: `app/api/transcript/route.ts:29`, `app/page.tsx:80,107`
- Impact: Runtime errors if non-Error objects are thrown; inconsistent error messaging.
- Fix approach: Use consistent error narrowing pattern: `catch (err) { const msg = err instanceof Error ? err.message : String(err); }` or import/use a dedicated error utility.

**Supadata API Dependency Not Enforced:**
- Issue: `fetchTranscript()` in `lib/youtube.ts` silently fails InnerTube and falls back to Supadata, but Supadata is only called if `SUPADATA_API_KEY` env var is set (line 259). On Vercel without the key, both methods fail and return InnerTube error.
- Files: `lib/youtube.ts:258-272`
- Impact: Vague error messages; user may not understand why Supadata fallback didn't work. CLAUDE.md states Supadata is "not optional on Vercel" but the code doesn't enforce this or document it in errors.
- Fix approach: Early validation: if InnerTube fails and `SUPADATA_API_KEY` is missing, throw specific error like `"InnerTube failed and SUPADATA_API_KEY is not configured. Supadata fallback unavailable."`.

## Known Issues

**Metadata API Uses Unreliable Fallback Chain:**
- Issue: `app/api/metadata/route.ts` tries noembed.com first, then YouTube oembed. Both services are external and can fail unpredictably. Silent catch blocks (lines 49, 65) swallow errors.
- Files: `app/api/metadata/route.ts:40-67`
- Impact: Metadata fetch silently fails and returns 502, but UI already handles this gracefully as "nice-to-have". Still, debugging why metadata isn't showing is difficult.
- Workaround: UI gracefully handles null metadata. No immediate user impact, but consider adding fallback to extracting title from URL or cached data in future.

**No Request Timeout Protection:**
- Issue: All `fetch()` calls lack timeout configuration. No `AbortController` with timeout limits.
- Files: `lib/youtube.ts:56,112,182`, `app/api/metadata/route.ts:41,55`, `app/page.tsx:40,91`
- Impact: Slow external APIs can block requests indefinitely, causing poor user experience and potential deployment timeouts on Vercel (30s limit on pro).
- Fix approach: Implement fetch wrapper with AbortController: `fetch(url, { signal: AbortSignal.timeout(10000) })` for Vercel compatibility (requires Node 20.4+, which Vercel supports).

**Overly Broad Error Type Unions in API Responses:**
- Issue: `TranscriptAPIResponse` union in `lib/types.ts:42` has errorType with `'UNKNOWN'` that's never generated. The route at `app/api/transcript/route.ts:33-43` infers error types but doesn't have a catch-all, so truly unknown errors would have undefined errorType.
- Files: `lib/types.ts:42`, `app/api/transcript/route.ts:29-49`
- Impact: Type safety issue; client code assumes errorType is always set but could receive undefined in edge cases. Makes error handling in UI fragile.
- Fix approach: Either add explicit `'UNKNOWN'` case in error handling or remove from union. Add type guard in client code.

## Security Considerations

**Inferred Error Type Detection is Brittle:**
- Issue: Error messages are detected via `.toLowerCase().includes()` patterns (line 35-40 in transcript route), relying on YouTube's error message strings.
- Files: `app/api/transcript/route.ts:31-43`
- Impact: YouTube could change error messages without notice, breaking error detection. Attackers could craft errors to trigger false error types (though impact is low — just wrong HTTP status).
- Recommendations: Add structured error classes in `lib/youtube.ts` that throw typed errors (e.g., `VideoUnavailableError`, `RateLimitError`) instead of relying on message strings. Pass error type as metadata.

**Missing Rate Limiting:**
- Issue: No rate limiting on `/api/transcript` or `/api/metadata` endpoints. External APIs (YouTube, Supadata, noembed) may rate-limit, but client can hammer the endpoint without restriction.
- Files: `app/api/transcript/route.ts`, `app/api/metadata/route.ts`
- Impact: Abuse vector; malicious user can spam requests and exhaust Supadata quota or trigger YouTube/noembed blocks.
- Recommendations: Implement rate limiting via middleware (e.g., Upstash Redis for Vercel) or request ID tracking. Consider implementing client-side backoff (already somewhat done via Promise.all in page.tsx line 39).

**No Input Validation on Request Body:**
- Issue: `app/api/transcript/route.ts:7-8` destructures body without schema validation. Only basic null/type check for `url` field (line 10).
- Files: `app/api/transcript/route.ts:7-15`
- Impact: Extra fields in request body are silently ignored. Could mask mistakes or allow unexpected behavior. No protection against malformed JSON.
- Recommendations: Use Zod or similar schema library to validate request shape. Would also protect against future field additions by accident.

## Performance Bottlenecks

**Sequential XML Parsing with Regex Fallthrough:**
- Issue: `fetchTimedText()` in `lib/youtube.ts:128-164` tries standard regex first (line 129-141), then ASR regex (line 146-162). Both patterns scan the entire XML document if first pattern yields results. If XML is large and ASR format, first regex matches nothing but still scans full doc.
- Files: `lib/youtube.ts:111-164`
- Impact: Unnecessary regex scans on large transcripts. Minimal impact for typical videos (captions <50KB) but could degrade on very long videos (3+ hours with dense captions).
- Improvement path: Detect format upfront (e.g., check for `<text start=` vs `<p t=` in first 1KB), then use only the matching parser.

**Parallel Metadata Fetch Masks Errors:**
- Issue: `app/page.tsx:39-48` uses `Promise.all()` with catch handler on metadata only. If transcript fetch fails, metadata is never fetched due to Promise.all semantics. If metadata fetch is slow, transcript response is blocked.
- Files: `app/page.tsx:39-48`
- Impact: Slow metadata API can delay transcript display. Not critical since metadata is optional, but user waits for both even though they could load independently.
- Improvement path: Use `Promise.allSettled()` to fetch both in parallel and handle failures independently. Transcript loads immediately while metadata loads silently.

**No Caching of Transcript Results:**
- Issue: Each request to the same video with same language re-fetches from InnerTube/Supadata. No client-side or server-side caching.
- Files: `app/page.tsx:30-111`, `lib/youtube.ts:221-273`
- Impact: Redundant API calls; slower repeat usage; wasted quota if using Supadata.
- Improvement path: Add localStorage cache on client (with expiry), or implement server-side cache (e.g., Redis on Vercel) keyed by videoId+lang.

## Fragile Areas

**Language Track Selection Logic:**
- Files: `lib/youtube.ts:231-239`
- Why fragile: The logic prefers non-ASR tracks but falls back to `rawTracks[0]` without validation that it exists. If `rawTracks` is empty (shouldn't happen due to earlier check, but defensive), this crashes. Selection doesn't account for language-specific preference when auto-generated tracks are all available.
- Safe modification: Add guard: `selectedTrack = ... ?? rawTracks[0]!` (with non-null assertion after null check on rawTracks.length). Document the fallback order (requested lang → lang prefix match → first track).
- Test coverage: No unit tests; logic is untested. If track data structure changes, this breaks silently.

**HTML Entity Decoding Incompleteness:**
- Files: `lib/format.ts:15-32`
- Why fragile: Decoding handles common entities and numeric entities but not all named HTML entities (e.g., `&nbsp;`, `&ndash;`, `&hellip;`). YouTube may use entities not in the hardcoded list.
- Safe modification: Consider using a library like `he` for full entity decoding, or expand the HTML_ENTITIES map. Test with real YouTube transcripts that have uncommon characters.
- Test coverage: No tests; function is untested.

**XML Parsing via Regex Instead of XML Parser:**
- Files: `lib/youtube.ts:111-164`
- Why fragile: Regex parsing breaks if YouTube changes timedtext XML format (e.g., attribute order, whitespace). No structured parsing means edge cases with special characters in text are hard to handle.
- Safe modification: If reliability becomes critical, switch to `DOMParser` (not available in Node) or `fast-xml-parser` npm package. For now, ensure regex tests cover known YouTube variants.
- Test coverage: No tests; format changes would be discovered only when a user hits a video with the new format.

**Supadata API Contract Assumption:**
- Files: `lib/youtube.ts:190-202`
- Why fragile: Code assumes Supadata response always has `content` array with objects containing `text`, `offset`, `duration`. If Supadata changes response shape, the code throws "Supadata returned no transcript content" even if API succeeded.
- Safe modification: Add explicit type checking: validate response shape before accessing fields. Use Zod to validate Supadata response.
- Test coverage: No tests; API contract changes go undetected until user reports error.

## Scaling Limits

**Single InnerTube API Key:**
- Current capacity: Shared across all users, global rate limit.
- Limit: YouTube will rate-limit or block if requests spike.
- Scaling path: Consider using rotating pool of InnerTube keys, or implement exponential backoff + retry logic. Monitor quota usage. Alternatively, increase reliance on Supadata fallback by improving its error messages.

**Supadata Quota Unknown:**
- Current capacity: Determined by `SUPADATA_API_KEY` tier (unknown).
- Limit: Could exhaust quota if inbound traffic spikes.
- Scaling path: Implement caching (see Performance section). Monitor API usage logs. Consider upgrading Supadata plan or adding secondary fallback.

**Metadata Services (noembed + YouTube oembed):**
- Current capacity: External services with unknown limits.
- Limit: Both could rate-limit on traffic spike.
- Scaling path: Implement caching. Consider fallback to extracting title from OpenGraph meta tags (would require embedding YouTube iframe or scraping, not ideal).

## Dependencies at Risk

**Supadata API Dependency:**
- Risk: Service is external and could shut down, raise pricing, or change terms.
- Impact: Without Supadata, app breaks on Vercel (YouTube blocks cloud IPs). Entire product depends on it.
- Migration plan: This is a known constraint documented in CLAUDE.md. If Supadata becomes unavailable, options are limited: (1) Migrate to different transcript API (e.g., YouTube-Transcript npm package if it works from cloud), (2) Build own YouTube authentication flow with user accounts (major effort), (3) Discontinue cloud deployment.

**InnerTube API Key Reliance:**
- Risk: YouTube could deprecate InnerTube API or rotate key.
- Impact: App stops working; fallback to Supadata.
- Migration plan: Monitor YouTube API changes. Consider adding YouTube API v3 as secondary option (would require API key + quota, costs money).

## Missing Critical Features

**No Video Availability Check Before Processing:**
- Problem: App doesn't check if video exists before attempting transcript extraction. InnerTube returns error, but user waits for full request to fail.
- Blocks: Quick validation of URLs before attempting expensive operations.
- Fix: Add lightweight HEAD request to YouTube or use InnerTube's playability check response (already done on line 86-89, could surface earlier).

**No Language Auto-Detection:**
- Problem: App doesn't auto-detect video's original language or user's browser language. Always defaults to English or first non-ASR track.
- Blocks: Better UX for non-English users.
- Fix: Use `navigator.language` or add language preference to localStorage. Consider browser language as initial default.

**No Batch Transcript Export:**
- Problem: App can only export one transcript at a time. No way to bulk-download transcripts for a playlist or channel.
- Blocks: Power users (researchers, accessibility teams).
- Fix: Out of scope for current MVP but consider for future.

## Test Coverage Gaps

**No Unit Tests for Core Functions:**
- Untested area: `extractVideoId()`, `fetchTimedText()`, `formatTranscriptText()`, `generateSRT()`, HTML entity decoding.
- Files: `lib/youtube.ts`, `lib/format.ts`
- Risk: Regex changes or edge cases go undetected. Format functions may produce incorrect output for special characters.
- Priority: **High** — these are critical to product correctness. At minimum, add tests for extractVideoId() with various YouTube URL formats, and format functions with edge cases.

**No API Route Tests:**
- Untested area: Error handling, input validation, response format in `/api/transcript` and `/api/metadata`.
- Files: `app/api/transcript/route.ts`, `app/api/metadata/route.ts`
- Risk: Breaking changes in error responses go undetected. Type mismatches between API and client aren't caught.
- Priority: **Medium** — critical path but less frequently changed. Consider integration tests for happy path and common error cases.

**No E2E Tests:**
- Untested area: Full flow from URL input to transcript display.
- Files: `app/page.tsx`, integration with all APIs.
- Risk: Regressions in UI/API integration only discovered by manual testing.
- Priority: **Medium** — valuable for catch regressions but requires test video setup (could use mocked API).

**No Metadata API Fallback Testing:**
- Untested area: noembed + YouTube oembed fallback logic.
- Files: `app/api/metadata/route.ts:40-67`
- Risk: Fallback behavior changes go unnoticed. If noembed becomes unavailable, fallback correctness is unknown.
- Priority: **Low** — metadata is optional, but consider integration test with real URLs to validate both services work.

---

*Concerns audit: 2026-02-17*
