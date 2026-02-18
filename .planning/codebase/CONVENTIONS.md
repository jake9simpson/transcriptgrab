# Coding Conventions

**Analysis Date:** 2026-02-17

## Naming Patterns

**Files:**
- Components: PascalCase, e.g., `TranscriptInput.tsx`, `ActionButtons.tsx`
- Library modules: camelCase, e.g., `youtube.ts`, `format.ts`, `types.ts`
- API routes: kebab-case in directory structure, e.g., `app/api/transcript/route.ts`, `app/api/metadata/route.ts`
- UI primitives from shadcn: kebab-case, e.g., `alert.tsx`, `button.tsx`, `input.tsx` in `components/ui/`

**Functions:**
- camelCase with descriptive verb-noun pattern
- Examples: `extractVideoId()`, `fetchTranscript()`, `formatTimestamp()`, `generateSRT()`, `handleSubmit()`
- Private helper functions: declared as standalone functions in same file
- Handler functions (React event handlers): prefix with `handle`, e.g., `handleSubmit()`, `handleCopy()`, `handleLanguageChange()`

**Variables:**
- Local state and props: camelCase
- React state: `const [variableName, setVariableName] = useState(...)`
- Boolean variables: prefix with `is` or `show`, e.g., `isLoading`, `showTimestamps`
- DOM references: descriptive camelCase, e.g., `selectedLanguage`, `availableTracks`, `error`

**Types and Interfaces:**
- PascalCase for interface and type names
- Examples: `TranscriptSegment`, `CaptionTrack`, `TranscriptResult`, `VideoMetadata`, `AppState`
- Discriminated unions use `success` field: `TranscriptResponse | TranscriptErrorResponse`
- Error types use discriminated `errorType` field for specific error classification

**Constants:**
- UPPER_SNAKE_CASE for module-level constants
- Examples: `VIDEO_ID_REGEX`, `ANDROID_USER_AGENT`, `INNERTUBE_API_KEY`, `HTML_ENTITIES`

## Code Style

**Formatting:**
- ESLint v9 with Next.js config (`eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`)
- No explicit Prettier config detected; ESLint handles formatting via `eslint.config.mjs`
- Line length: No strict limit observed; code is readable with natural breaks

**Linting:**
- Config: `eslint.config.mjs` (flat config format)
- Extends: `nextVitals` (core web vitals) and `nextTs` (TypeScript rules)
- Ignored: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`

**TypeScript:**
- Target: ES2017
- `strict: true` enforced
- JSX: React 19 with `react-jsx` transform (no React import required in JSX files)
- Module resolution: bundler (Next.js Turbopack)
- Path alias: `@/*` maps to root directory
- Type imports: Use `import type` for types, e.g., `import type { TranscriptSegment } from './types'`

## Import Organization

**Order:**
1. External packages (Next.js, React, third-party)
2. Internal types (prefixed with `import type`)
3. Internal utilities and components (prefixed with `@/`)
4. Relative imports (in rare cases)

**Example from `app/page.tsx`:**
```typescript
import { useState } from 'react';
import type {
  AppState,
  TranscriptSegment,
  CaptionTrack,
  VideoMetadata,
  TranscriptAPIResponse,
  MetadataAPIResponse,
} from '@/lib/types';
import TranscriptInput from '@/components/TranscriptInput';
import ErrorMessage from '@/components/ErrorMessage';
```

**Path Aliases:**
- Use `@/` prefix for all internal imports (not relative paths)
- Examples: `@/lib/youtube`, `@/components/TranscriptInput`, `@/lib/types`

## Error Handling

**Pattern:**
- Discriminated union types with `success` boolean field
- Error responses include `error` string (user-facing message) and `errorType` string (machine-readable category)
- API routes use discriminated union response types (`TranscriptAPIResponse | MetadataAPIResponse`)

**Error Classification:**
- `INVALID_URL`: URL parsing failed or invalid format
- `NO_CAPTIONS`: Video exists but has no captions or they're disabled
- `VIDEO_UNAVAILABLE`: Video is private, deleted, or geoblocked
- `RATE_LIMITED`: API quota exceeded; return HTTP 429
- `NETWORK_ERROR`: Network or connectivity issue (default fallback)
- `UNKNOWN`: Used in fallback cases

**Example from `app/api/transcript/route.ts`:**
```typescript
if (!data.success) {
  setError(data.error);
  setAppState('error');
  return;
}
```

**Pattern for Promise errors:**
- Catch with `err: unknown`
- Check if `err instanceof Error` before accessing `.message`
- Example: `supadataErr instanceof Error ? supadataErr.message : supadataErr`

## Logging

**Framework:** Native `console` (no external logging library)

**Patterns:**
- Informational logs prefixed with `[transcriptgrab]`
- Used for tracking fallback behavior and API success/failure
- Examples from `lib/youtube.ts`:
  ```typescript
  console.log(`[transcriptgrab] InnerTube succeeded for ${videoId}`);
  console.log(`[transcriptgrab] InnerTube failed for ${videoId}: ${innertubeError.message}`);
  console.log(`[transcriptgrab] Supadata fallback succeeded for ${videoId}`);
  ```

## Comments

**When to Comment:**
- Document public functions with JSDoc comments
- Document complex regex patterns and parsing logic
- Explain non-obvious algorithm decisions (e.g., track selection strategy)

**JSDoc/TSDoc:**
- Used for exported functions and types
- Example from `lib/youtube.ts`:
  ```typescript
  /**
   * Extract a YouTube video ID from a URL or bare ID string.
   */
  export function extractVideoId(url: string): string | null {
  ```

**No comments needed for:**
- Self-documenting code (clear function names)
- Simple loops and map operations
- State updates with clear intent

## Function Design

**Size:** Functions are focused and typically 10-50 lines
- `extractVideoId()`: 35 lines with multiple conditional branches
- `innertubePlayer()`: 55 lines with complex response parsing
- `formatTimestamp()`: 10 lines pure utility
- `handleSubmit()`: 45 lines managing async state and parallel requests

**Parameters:**
- Use specific typed parameters, not generic `options` objects
- Examples: `fetchTranscript(videoId: string, languageCode?: string)`
- Props interfaces: `interface ComponentNameProps { ... }`
- One-off utility functions use destructuring: `mapToMetadata(data: NoembedResponse)`

**Return Values:**
- Explicit return types on all exported functions
- Use discriminated unions for operations that can fail
- Async functions return Promises with explicit types
- Example: `async function fetchTimedText(baseUrl: string): Promise<TranscriptSegment[]>`

**Async/Await:**
- Async functions used for all I/O operations
- Error handling with try/catch blocks
- Waterfall fallback pattern: try primary method, catch and retry fallback (see `fetchTranscript()`)
- `Promise.all()` used for parallel independent requests (see `app/page.tsx` line 39)

## Module Design

**Exports:**
- Named exports for utility functions: `export function`, `export interface`
- Default exports for React components: `export default function ComponentName`
- Type exports: `export type` and `export interface`

**Barrel Files:**
- No barrel files used in this codebase
- Imports use direct file paths: `from '@/lib/types'` not `from '@/lib'`

**Module Responsibilities:**
- `lib/types.ts`: All shared TypeScript interfaces and discriminated union types
- `lib/youtube.ts`: YouTube API integration (InnerTube + Supadata fallback)
- `lib/format.ts`: Text formatting, timestamp conversion, SRT generation
- `lib/utils.ts`: Utility function `cn()` for merging CSS classes (Tailwind + clsx)
- `components/`: React components organized by feature
- `app/api/`: Next.js API routes (transcript and metadata endpoints)

## React Patterns

**Component Type:**
- Functional components with React 19
- No class components used
- `'use client'` directive for interactive components

**Hooks:**
- `useState()` for local state
- No custom hooks in this codebase
- Props passed down from parent to child

**Props Interface:**
- Define interface ending with `Props`, e.g., `TranscriptInputProps`, `ActionButtonsProps`
- Optional props use `?` operator
- Callback props use function type, e.g., `onSubmit: (url: string) => void`

**Example from `components/TranscriptInput.tsx`:**
```typescript
interface TranscriptInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export default function TranscriptInput({ onSubmit, isLoading }: TranscriptInputProps) {
  const [url, setUrl] = useState('');
  // ...
}
```

---

*Convention analysis: 2026-02-17*
