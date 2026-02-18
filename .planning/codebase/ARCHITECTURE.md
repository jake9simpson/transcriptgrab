# Architecture

**Analysis Date:** 2026-02-17

## Pattern Overview

**Overall:** Client-Server with Layered API Abstraction

**Key Characteristics:**
- Next.js App Router (server-side rendering + API routes)
- Client-side state management with React hooks
- Dual transcript-fetching strategy (InnerTube primary + Supadata fallback)
- Clear separation between API layer, utility layer, and UI layer
- Decoupled format utilities from fetch logic

## Layers

**API Layer (Server):**
- Purpose: Handle HTTP requests, validate input, orchestrate external service calls, error mapping
- Location: `app/api/`
- Contains: Route handlers for `/api/transcript` and `/api/metadata`
- Depends on: `lib/youtube.ts` (fetching), `lib/types.ts` (type definitions)
- Used by: Browser fetch calls from client components

**Data Fetching Layer (Server):**
- Purpose: Encapsulate YouTube transcript and metadata retrieval strategies
- Location: `lib/youtube.ts`
- Contains: `extractVideoId()`, `fetchTranscript()`, `innertubePlayer()`, `fetchViaSupadata()`, `fetchTimedText()`
- Depends on: External YouTube APIs (InnerTube), external Supadata API, `lib/types.ts`
- Used by: API routes in `app/api/`

**Format Layer (Shared):**
- Purpose: Transform transcript segments into various output formats (plain text, SRT, timestamps)
- Location: `lib/format.ts`
- Contains: `formatTimestamp()`, `formatTranscriptText()`, `generateSRT()`, `decodeHtmlEntities()`
- Depends on: `lib/types.ts`
- Used by: Server API routes and client components (`ActionButtons`, `TranscriptViewer`)

**Type Layer (Shared):**
- Purpose: Centralized type definitions for transcript data, API contracts, app state
- Location: `lib/types.ts`
- Contains: All TypeScript interfaces (TranscriptSegment, CaptionTrack, TranscriptResult, AppState, etc.)
- Depends on: Nothing
- Used by: All other layers (API, fetch, format, components)

**UI/Presentation Layer (Client):**
- Purpose: Render user interface, manage client-side interaction state, fetch from API
- Location: `app/page.tsx` + `components/`
- Contains: Page layout, component tree, form handling, client-side state (url, appState, segments, etc.)
- Depends on: API routes, `lib/types.ts`, `lib/format.ts` (for output generation), shadcn/ui components
- Used by: Browser

**Utility Layer (Shared):**
- Purpose: Reusable helper functions for styling
- Location: `lib/utils.ts`
- Contains: `cn()` (class name merging)
- Depends on: clsx, tailwind-merge
- Used by: Components throughout the codebase

## Data Flow

**Happy Path (Get Transcript):**

1. User enters YouTube URL into `<TranscriptInput>`
2. `page.tsx` calls `POST /api/transcript` with URL + optional languageCode
3. API route extracts video ID using `extractVideoId()`
4. API calls `fetchTranscript(videoId, languageCode)` from `lib/youtube.ts`
5. `fetchTranscript()` attempts InnerTube API:
   - Calls `innertubePlayer()` → YouTube InnerTube API
   - Returns available caption tracks and selects best match
   - Calls `fetchTimedText()` to parse XML segments
6. If InnerTube succeeds, return TranscriptResult with segments + tracks
7. If InnerTube fails AND `SUPADATA_API_KEY` exists, fallback to `fetchViaSupadata()`
8. API returns `{ success: true, data: TranscriptResult }` or error response
9. `page.tsx` receives response, updates state (segments, availableTracks, selectedLanguage)
10. UI renders `<TranscriptViewer>`, `<ActionButtons>`, `<LanguageSelector>`

**Parallel Flow (Get Metadata):**
- Simultaneous with transcript fetch, `page.tsx` also calls `GET /api/metadata?url=...`
- Metadata API tries noembed.com first, falls back to YouTube oembed
- Returns VideoMetadata (title, author, thumbnail) for display in `<VideoInfo>`
- If metadata fails, page still shows transcript (metadata is optional)

**Language Change Flow:**
1. User selects different language in `<LanguageSelector>`
2. `handleLanguageChange()` calls `POST /api/transcript` with same URL + new languageCode
3. `fetchTranscript()` re-runs with language preference, returns new segments
4. UI updates transcript display

**Export/Copy Flow:**
1. User clicks Copy/Download in `<ActionButtons>`
2. `formatTranscriptText()` converts segments to plain text (with optional timestamps)
3. Or `generateSRT()` converts to SRT subtitle format
4. Client-side download or clipboard copy

**State Management:**

Client-side only (React hooks in `page.tsx`):
- `url`: Current input value
- `appState`: 'idle' | 'loading' | 'success' | 'error' (controls UI rendering)
- `error`: Error message string
- `segments`: Array of TranscriptSegment
- `availableTracks`: Array of CaptionTrack
- `selectedLanguage`: Currently selected language code
- `metadata`: VideoMetadata | null
- `showTimestamps`: Boolean toggle for timestamp display

## Key Abstractions

**TranscriptSegment:**
- Purpose: Represents a single caption/subtitle unit
- Examples: `{ text: "Hello world", start: 5.2, duration: 3.1 }`
- Pattern: Immutable data struct; used throughout fetch → format → render pipeline

**CaptionTrack:**
- Purpose: Metadata about available subtitle track (language, auto-generated flag, etc.)
- Examples: `{ languageCode: "en", name: "English", baseUrl: "...", isAutoGenerated: false }`
- Pattern: Used by API to return available options to client; client selects one

**TranscriptResult:**
- Purpose: Complete response from transcript fetch (segments + available tracks + video ID)
- Used by: API routes to construct TranscriptAPIResponse

**TranscriptAPIResponse / TranscriptErrorResponse:**
- Purpose: Standardized API contract with success/error discriminator
- Pattern: Discriminated union `{ success: true, data: ... } | { success: false, error: ... }`
- Used by: All API responses; type-safe pattern matching on client

**AppState:**
- Purpose: State machine for UI rendering
- Values: 'idle' (initial) → 'loading' (during fetch) → 'success' or 'error'
- Pattern: Drives conditional rendering in page.tsx (skeleton, error message, transcript)

## Entry Points

**Browser (Client):**
- Location: `app/page.tsx` (root page via Next.js App Router)
- Triggers: User navigates to app URL
- Responsibilities: Manage all client-side state, orchestrate API calls, coordinate component tree

**API - Transcript Endpoint:**
- Location: `app/api/transcript/route.ts`
- Triggers: POST request from client with YouTube URL
- Responsibilities: Validate input, call fetch logic, map errors to standardized error types, return JSON

**API - Metadata Endpoint:**
- Location: `app/api/metadata/route.ts`
- Triggers: GET request from client with YouTube URL query param
- Responsibilities: Attempt noembed, fallback to YouTube oembed, map response to VideoMetadata schema

**Root Layout:**
- Location: `app/layout.tsx`
- Triggers: Next.js hydration on every page
- Responsibilities: Define HTML structure, inject theme script (prevents flash), load global styles

## Error Handling

**Strategy:** Layered error mapping with type discrimination

**Patterns:**

1. **Fetch Layer** (`lib/youtube.ts`):
   - Raw errors from YouTube/Supadata APIs are caught
   - Re-thrown as Error with descriptive message (e.g., "This video is private or unavailable")
   - No error type mapping — raw messages used for diagnostics

2. **API Layer** (`app/api/transcript/route.ts`):
   - Catches errors from fetch layer
   - Maps error messages to errorType enum: 'INVALID_URL', 'NO_CAPTIONS', 'VIDEO_UNAVAILABLE', 'RATE_LIMITED', 'NETWORK_ERROR', 'UNKNOWN'
   - Returns HTTP status code (400 default, 429 for rate limit)
   - Standardized TranscriptErrorResponse type

3. **Client Layer** (`page.tsx`):
   - Receives API response with discriminated union type
   - Checks `success` flag before accessing `data`
   - Renders `<ErrorMessage>` component with user-friendly error string
   - Sets appState to 'error' to show error UI

4. **Metadata API** (`app/api/metadata/route.ts`):
   - Graceful fallback chain (noembed → YouTube oembed → error)
   - Returns error response if both fail, but transcript still shows (metadata is optional)
   - Client silently ignores failed metadata fetch

## Cross-Cutting Concerns

**Logging:**
- Ad-hoc console.log in `lib/youtube.ts` for debugging InnerTube vs Supadata decisions
- No structured logging framework

**Validation:**
- URL validation in two places: `extractVideoId()` (regex + URL parsing) and API route (basic string check)
- Language code passed directly to external APIs (no local validation)

**HTML Decoding:**
- YouTube captions contain HTML entities (`&amp;`, `&#123;`, etc.)
- `decodeHtmlEntities()` in `lib/format.ts` handles all three formats (named, decimal, hex)
- Applied in TranscriptViewer + export functions to clean display

**Theme Management:**
- Inline script in `app/layout.tsx` runs before hydration to prevent light-mode flash
- Checks localStorage 'theme' key or prefers-color-scheme media query
- Adds 'dark' class to `<html>` root
- Global CSS in `app/globals.css` defines oklch color tokens for light/dark

**External Service Resilience:**
- InnerTube is primary (cloud-safe), Supadata is fallback (cloud-safe)
- Both can fail independently; app tries both before giving up
- Metadata fetch is optional (silently fails, transcripts still work)
