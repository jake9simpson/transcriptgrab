# External Integrations

**Analysis Date:** 2026-02-17

## APIs & External Services

**YouTube Transcript Extraction (Primary):**
- InnerTube ANDROID Client API (YouTube)
  - What it's used for: Fetches caption/subtitle tracks and timedtext transcripts from YouTube videos
  - Implementation: `lib/youtube.ts` - `innertubePlayer()` and `fetchTimedText()` functions
  - API Key: `AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8` (hardcoded public InnerTube API key)
  - User-Agent: Android client spoofing (`com.google.android.youtube/19.09.37`) to bypass cloud IP restrictions
  - Endpoint: `https://www.youtube.com/youtubei/v1/player?key={INNERTUBE_API_KEY}`
  - Format: JSON request with ANDROID client context; returns captions object with caption tracks and playability status

**YouTube Transcript Extraction (Fallback):**
- Supadata API
  - What it's used for: Fallback transcript extraction when InnerTube fails (required on Vercel where cloud IPs are blocked by YouTube)
  - SDK/Client: Direct HTTP calls via `fetch()`
  - Auth: `SUPADATA_API_KEY` environment variable (via `x-api-key` header)
  - Endpoint: `https://api.supadata.ai/v1/transcript?url=https://youtu.be/{videoId}&lang={lang}`
  - Format: JSON response with `lang` and `content` array containing `{text, offset, duration, lang}` objects
  - Fallback mechanism: `fetchTranscript()` tries InnerTube first; if it fails and `SUPADATA_API_KEY` is configured, attempts Supadata
  - Note: Not optional on Vercel (YouTube blocks cloud provider IP ranges)

**Video Metadata Extraction (Primary):**
- noembed API
  - What it's used for: Fetches YouTube video metadata (title, author, thumbnail)
  - Endpoint: `https://noembed.com/embed?url={encodedUrl}`
  - Format: JSON response with `title`, `author_name`, `author_url`, `thumbnail_url` fields
  - Implementation: `app/api/metadata/route.ts`

**Video Metadata Extraction (Fallback):**
- YouTube oEmbed API
  - What it's used for: Fallback metadata if noembed fails
  - Endpoint: `https://www.youtube.com/oembed?url={encodedUrl}&format=json`
  - Format: JSON response with same structure as noembed
  - No authentication required

## Data Storage

**Databases:**
- None - This is a stateless application. No persistent data storage.

**File Storage:**
- Local filesystem only - Deployed to Vercel with serverless functions; no file persistence between requests

**Caching:**
- None - No caching layer configured. Each API call triggers fresh fetches.

## Authentication & Identity

**Auth Provider:**
- None - Application is unauthenticated and public
- YouTube API access uses:
  - Public InnerTube API key (no user authentication required)
  - Supadata API key (server-side only, via environment variable)

## Monitoring & Observability

**Error Tracking:**
- None detected in codebase

**Logs:**
- Console logging only via `console.log()`
- Log messages in `lib/youtube.ts`:
  - `[transcriptgrab] InnerTube succeeded for {videoId}`
  - `[transcriptgrab] InnerTube failed for {videoId}: {error}`
  - `[transcriptgrab] Supadata fallback succeeded for {videoId}`
  - `[transcriptgrab] Supadata fallback also failed for {videoId}: {error}`

## CI/CD & Deployment

**Hosting:**
- Vercel (Next.js native platform)
- Deployment command: `npx vercel --prod --yes`

**CI Pipeline:**
- None detected - deployment is manual via CLI

## Environment Configuration

**Required env vars:**
- `SUPADATA_API_KEY` - API key for Supadata fallback service (required on Vercel, optional in development)

**Optional env vars:**
- None detected

**Secrets location:**
- `.env.local` - Local development (not committed to git per `.gitignore`)
- Vercel Environment Secrets - Production (set via `npx vercel env add SUPADATA_API_KEY`)

## Webhooks & Callbacks

**Incoming:**
- None - Application is read-only, no webhook receivers

**Outgoing:**
- None - Application makes only request-response calls, no webhooks to external services

---

*Integration audit: 2026-02-17*
