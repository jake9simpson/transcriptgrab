# TranscriptGrab

YouTube transcript extractor deployed to Vercel.

## Architecture
- Next.js 16 App Router, TypeScript, Tailwind v4, shadcn/ui
- Transcript fetching: InnerTube ANDROID primary + Supadata API fallback (see `lib/youtube.ts`)
- Supadata API keys: `SUPADATA_API_KEY` and `SUPADATA_API_KEY_2` on Vercel — randomly selected per request to distribute usage

## Key Files
- `lib/youtube.ts` - transcript fetching (InnerTube + Supadata waterfall)
- `lib/format.ts` - transcript formatting (plain text, timestamps, SRT, etc.)
- `lib/types.ts` - shared TypeScript types
- `app/api/transcript/route.ts` - transcript API endpoint
- `app/api/metadata/route.ts` - video metadata API endpoint
- 8 components in `components/`, all using shadcn/ui primitives from `components/ui/`

## Theme
- `.dark` class on `<html>`, localStorage persistence
- Inline script in `layout.tsx` prevents flash of wrong theme
- oklch colors defined in globals.css

## Commands
- Build: `npm run build` (uses Turbopack)
- Deploy: `npx vercel --prod --yes`
- Dev: `npm run dev`

## Gotchas
- YouTube blocks all cloud provider IPs from accessing transcript data. The Supadata fallback is not optional on Vercel.
- Must redeploy after adding env vars with `npx vercel env add`
- Remote image patterns configured for `i.ytimg.com` in `next.config.ts`
