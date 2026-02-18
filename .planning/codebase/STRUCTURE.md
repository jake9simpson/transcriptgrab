# Codebase Structure

**Analysis Date:** 2026-02-17

## Directory Layout

```
transcriptgrab/
├── app/                    # Next.js App Router - pages and API routes
│   ├── api/                # REST API endpoints
│   │   ├── transcript/     # POST /api/transcript - fetch captions
│   │   └── metadata/       # GET /api/metadata - fetch video info
│   ├── globals.css         # Global Tailwind + theme color tokens
│   ├── layout.tsx          # Root layout with theme script + header
│   └── page.tsx            # Home page (main app entry point)
├── components/             # React components (UI)
│   ├── ui/                 # shadcn/ui primitive components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── select.tsx
│   │   ├── switch.tsx
│   │   ├── alert.tsx
│   │   ├── scroll-area.tsx
│   │   ├── separator.tsx
│   │   └── badge.tsx
│   ├── ActionButtons.tsx   # Copy/Download transcript buttons
│   ├── ErrorMessage.tsx    # Error alert component
│   ├── LanguageSelector.tsx# Dropdown to select caption language
│   ├── ThemeToggle.tsx     # Dark/light mode toggle
│   ├── TimestampToggle.tsx # Toggle to show/hide [HH:MM:SS]
│   ├── TranscriptInput.tsx # URL input form
│   ├── TranscriptViewer.tsx# Scrollable transcript display
│   └── VideoInfo.tsx       # Video title, author, thumbnail
├── lib/                    # Shared utilities and business logic (Server + Client)
│   ├── format.ts           # Transcript formatting (plain text, SRT, timestamps)
│   ├── types.ts            # TypeScript interfaces (shared across app)
│   ├── utils.ts            # Class name merging utility
│   └── youtube.ts          # YouTube transcript fetching (InnerTube + Supadata)
├── public/                 # Static assets (if any)
├── .next/                  # Next.js build output (generated)
├── node_modules/           # Dependencies (generated)
├── package.json            # NPM dependencies and scripts
├── package-lock.json       # Lock file
├── tsconfig.json           # TypeScript compiler options
├── next.config.ts          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration (if present)
├── components.json         # shadcn/ui configuration
└── CLAUDE.md               # Project instructions and gotchas
```

## Directory Purposes

**`app/`:**
- Purpose: Next.js App Router application structure (pages + layouts + API routes)
- Contains: Entry point (`page.tsx`), layout hierarchy, API endpoints
- Key files: `page.tsx` (main UI), `layout.tsx` (root wrapper with theme), `globals.css` (styles)

**`app/api/`:**
- Purpose: Backend API routes (serverless functions)
- Contains: POST /api/transcript, GET /api/metadata
- Key files: `transcript/route.ts`, `metadata/route.ts`

**`components/`:**
- Purpose: Reusable React components for UI
- Contains: Feature components (`TranscriptInput`, `ActionButtons`, etc.) + shadcn/ui primitives
- Key files: All `.tsx` files; UI components have shadcn prefix, feature components are domain names

**`components/ui/`:**
- Purpose: shadcn/ui component library (design system primitives)
- Contains: Button, Input, Card, Select, Switch, Alert, ScrollArea, Badge, Separator
- Pattern: Imported by feature components; styling via Tailwind classes

**`lib/`:**
- Purpose: Shared utility and business logic (used by both server and client)
- Contains: Type definitions, fetch logic, formatting utilities, helper functions
- Key files: `types.ts` (source of truth for all interfaces), `youtube.ts` (fetch strategy), `format.ts` (output generation)

**`public/`:**
- Purpose: Static files served at root (favicon, images, etc.)
- Generated: No
- Committed: Yes

**.next/:**
- Purpose: Next.js build output and dev server artifacts
- Generated: Yes (auto-created by `npm run build` and `npm run dev`)
- Committed: No (in .gitignore)

## Key File Locations

**Entry Points:**

- `app/page.tsx`: Client-side root page; orchestrates all app state and API calls
- `app/layout.tsx`: Root HTML structure; injects theme prevention script
- `app/api/transcript/route.ts`: Backend endpoint for transcript fetching
- `app/api/metadata/route.ts`: Backend endpoint for video metadata

**Configuration:**

- `package.json`: Dependencies (React 19, Next.js 16, Tailwind 4, shadcn/ui)
- `tsconfig.json`: TypeScript strict mode, path alias `@/*` → root
- `next.config.ts`: Image domain whitelist for `i.ytimg.com`
- `components.json`: shadcn/ui config (component paths, aliases)
- `app/globals.css`: Theme variables (oklch colors), Tailwind imports

**Core Logic:**

- `lib/youtube.ts`: All YouTube transcript fetching (InnerTube primary + Supadata fallback)
- `lib/format.ts`: Transcript formatting (plain text, SRT, timestamps, HTML entity decoding)
- `lib/types.ts`: All TypeScript interfaces (TranscriptSegment, CaptionTrack, API contracts)

**UI Components:**

- `app/page.tsx`: Main app container with state management + layout
- `components/TranscriptInput.tsx`: Form for URL input
- `components/TranscriptViewer.tsx`: Scrollable transcript display
- `components/ActionButtons.tsx`: Copy/Download controls
- `components/LanguageSelector.tsx`: Caption language picker
- `components/ErrorMessage.tsx`: Error alert
- `components/VideoInfo.tsx`: Video metadata display
- `components/ThemeToggle.tsx`: Dark/light mode button
- `components/TimestampToggle.tsx`: Show/hide timestamps toggle

**Testing:**

- Not present in current codebase

## Naming Conventions

**Files:**

- **Components:** PascalCase + `.tsx` extension (e.g., `TranscriptInput.tsx`, `ActionButtons.tsx`)
- **Utilities/Libraries:** camelCase + `.ts` extension (e.g., `youtube.ts`, `format.ts`, `utils.ts`)
- **Types/Interfaces:** Exported from `types.ts` in PascalCase (e.g., `TranscriptSegment`, `AppState`)
- **API Routes:** Lowercase directory + `route.ts` file (e.g., `transcript/route.ts`, `metadata/route.ts`)

**Directories:**

- **Components:** PascalCase directories (feature name) + PascalCase file names (e.g., `components/TranscriptInput.tsx`)
- **UI Primitives:** Kebab-case directory + PascalCase file (e.g., `components/ui/button.tsx`)
- **API Routes:** Kebab-case route names (e.g., `app/api/transcript/`, `app/api/metadata/`)
- **Core Libs:** Lowercase names (e.g., `lib/youtube.ts`, `lib/format.ts`)

**Functions:**

- **React Components:** PascalCase, default export (e.g., `export default function TranscriptInput() {}`)
- **Utilities:** camelCase, named export (e.g., `export function extractVideoId() {}`)
- **API Handlers:** Named `POST` or `GET` export (e.g., `export async function POST(request: NextRequest)`)

**Variables:**

- **React State:** camelCase (e.g., `url`, `appState`, `segments`, `showTimestamps`)
- **Constants:** UPPER_SNAKE_CASE when all-caps (e.g., `ANDROID_USER_AGENT`, `INNERTUBE_API_KEY`)
- **Props Interfaces:** ComponentNameProps pattern (e.g., `TranscriptInputProps`, `ActionButtonsProps`)

## Where to Add New Code

**New Feature (e.g., new export format):**

1. **Add formatter function to `lib/format.ts`:**
   ```typescript
   export function generateJSON(segments: TranscriptSegment[]): string {
     // Implementation
   }
   ```

2. **Add button to `components/ActionButtons.tsx`:**
   ```typescript
   function handleDownloadJSON() {
     const json = generateJSON(segments);
     downloadFile(json, `${baseName}.json`, 'application/json');
   }
   ```

3. **Import from `lib/format.ts` at top of component**

**New API Endpoint (e.g., `/api/translate`):**

1. **Create directory:** `app/api/translate/`
2. **Create file:** `app/api/translate/route.ts`
3. **Implement:** `export async function POST(request: NextRequest) { ... }`
4. **Call from client:** `fetch('/api/translate', { method: 'POST', body: ... })`

**New Component (e.g., `TranscriptSearch`):**

1. **Create file:** `components/TranscriptSearch.tsx`
2. **Define props interface:** `interface TranscriptSearchProps { ... }`
3. **Export default function:** `export default function TranscriptSearch() { ... }`
4. **Import + use in `app/page.tsx`**

**New Utility (e.g., URL validation):**

1. **Add to `lib/youtube.ts`** (if YouTube-related) or **`lib/utils.ts`** (if generic)
2. **Export as named function:** `export function validateUrl() { ... }`
3. **Import where needed:** `import { validateUrl } from '@/lib/utils'`

**Shared Type (e.g., new API contract):**

1. **Add interface to `lib/types.ts`:**
   ```typescript
   export interface NewType {
     // Fields
   }
   ```
2. **Import in relevant files:** `import type { NewType } from '@/lib/types'`

## Special Directories

**`.next/`:**
- Purpose: Next.js build artifacts (development server cache, production build output)
- Generated: Yes (auto-created by build/dev commands)
- Committed: No

**`node_modules/`:**
- Purpose: Installed npm dependencies
- Generated: Yes (created by `npm install`)
- Committed: No

**`app/api/`:**
- Purpose: Serverless functions deployed to Vercel
- Auto-exported: All `route.ts` files become endpoints (no manual routing)
- HTTP methods: One `export async function POST/GET/etc()` per route file

**`components/ui/`:**
- Purpose: Design system primitives (shadcn/ui library)
- Auto-managed: Use `npx shadcn-ui add [component]` to add new primitives
- Do not edit: Shadcn components are regenerated on update
