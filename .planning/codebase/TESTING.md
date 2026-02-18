# Testing Patterns

**Analysis Date:** 2026-02-17

## Test Framework

**Runner:** Not detected

**Assertion Library:** Not applicable

**Run Commands:** No test commands configured in `package.json`

**Configuration:** No test config files found (`jest.config.js`, `vitest.config.ts`, etc.)

## Test Coverage Status

**Current State:** No automated tests in codebase

**Test Files:** None present
- Search for `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` returns zero results in source code (excluding `node_modules/`)

**Note:** This is a production application with no test infrastructure. All code operates without automated test coverage.

## Code Testability Observations

**Testable Modules:**
- `lib/youtube.ts`: Utility functions (`extractVideoId()`, `fetchTranscript()`, `fetchAvailableTracks()`) are exported and could be unit tested
- `lib/format.ts`: Pure functions (`decodeHtmlEntities()`, `formatTimestamp()`, `formatTranscriptText()`, `generateSRT()`) are highly testable — no dependencies, deterministic
- `lib/types.ts`: Type definitions only — no runtime tests needed

**API Routes (Hard to Test Without Framework):**
- `app/api/transcript/route.ts`: POST handler with complex error classification logic
- `app/api/metadata/route.ts`: GET handler with fallback pattern (noembed → YouTube oEmbed)
- These require HTTP testing framework (e.g., supertest, nexttest)

**React Components (Require Testing Library):**
- `app/page.tsx`: Main component with state management and async behavior
- All components in `components/`: Interactive UI with handlers and conditional rendering

## Testing Gaps

**Critical Areas Without Tests:**

1. **YouTube ID Extraction:** `extractVideoId()` handles:
   - Bare video IDs
   - Multiple YouTube URL formats (youtube.com, youtu.be, m.youtube.com, shorts, live, embed)
   - Invalid URLs
   - No validation that this works correctly across all formats

2. **Transcript Parsing:** `fetchTimedText()` uses two different XML formats:
   - Standard timedtext: `<text start="..." dur="...">` format
   - ASR format: `<p t="..." d="..."><s>...</s></p>` format
   - Fallback between formats if first finds nothing
   - No tests verify both parsers work or fallback triggers correctly

3. **Text Formatting:**
   - HTML entity decoding (named, decimal, hex entities)
   - Timestamp formatting for both plain text and SRT
   - No verification of edge cases (very long videos, special characters, zero-duration segments)

4. **Error Handling:** API routes classify errors by message inspection:
   - Substring matching on lowercased error messages
   - Maps to error types (NO_CAPTIONS, VIDEO_UNAVAILABLE, RATE_LIMITED, NETWORK_ERROR)
   - No test coverage for error message classification logic

5. **Integration:** Waterfall fallback pattern (InnerTube → Supadata) has no test coverage
   - Can't verify InnerTube failure triggers Supadata attempt
   - Can't verify both failures throws original InnerTube error

## Recommended Testing Strategy

**Phase 1: Unit Tests (lib/)**
```typescript
// Test candidates
describe('lib/youtube', () => {
  test('extractVideoId handles bare video IDs')
  test('extractVideoId extracts from youtube.com/watch?v=...')
  test('extractVideoId extracts from youtu.be short URLs')
  test('extractVideoId extracts from shorts URLs')
  test('extractVideoId returns null for invalid input')
})

describe('lib/format', () => {
  test('decodeHtmlEntities converts named entities')
  test('decodeHtmlEntities converts numeric entities')
  test('decodeHtmlEntities converts hex entities')
  test('formatTimestamp formats seconds under 1 hour as M:SS')
  test('formatTimestamp formats seconds over 1 hour as H:MM:SS')
  test('generateSRT produces valid subtitle format')
})
```

**Phase 2: Integration Tests (API Routes)**
- Mock fetch calls using MSW (Mock Service Worker) or similar
- Test both success and error paths
- Verify error classification logic

**Phase 3: Component Tests**
- Mock API calls
- Test state transitions (idle → loading → success/error)
- Test user interactions (input, button clicks, language selection)

## Setup Recommendation

If tests are to be added:

1. Install test runner:
   ```bash
   npm install --save-dev vitest @vitest/ui
   ```

2. Add test config (`vitest.config.ts`):
   ```typescript
   import { defineConfig } from 'vitest/config';
   export default defineConfig({
     test: {
       globals: true,
       environment: 'jsdom',
       coverage: { provider: 'v8' }
     }
   });
   ```

3. Organize tests:
   - `lib/__tests__/youtube.test.ts`
   - `lib/__tests__/format.test.ts`
   - `components/__tests__/ActionButtons.test.tsx`

4. Add to `package.json`:
   ```json
   "test": "vitest",
   "test:ui": "vitest --ui",
   "test:coverage": "vitest --coverage"
   ```

## Current Risk Profile

**High Risk (No Test Coverage):**
- YouTube ID extraction — multiple URL formats not verified
- Transcript XML parsing — fallback logic untested
- Error classification — regex-based message inspection untested

**Medium Risk:**
- Text formatting — edge cases not validated (special characters, very long content)
- Component state management — no verification user interactions work correctly

**Low Risk:**
- Type safety — TypeScript compiler catches many errors
- API responses — both endpoints have typed responses checked with discriminated unions

---

*Testing analysis: 2026-02-17*
