# Architecture Research

**Domain:** YouTube transcript tool with user accounts and persistent storage
**Researched:** 2026-02-17
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Client Layer (React)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Home Page   │  │ History Page │  │ Auth Pages   │  │ Components   │ │
│  │ (public)    │  │ (protected)  │  │ (public)     │  │ (shared UI)  │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └──────────────┘ │
│         │                │                  │                            │
├─────────┴────────────────┴──────────────────┴────────────────────────────┤
│                        Middleware Layer                                  │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  middleware.ts (renamed from proxy.ts in Next.js 16+)              │ │
│  │  - Session validation via Auth.js                                  │ │
│  │  - Route protection (redirect logic)                               │ │
│  │  - Optimistic auth checks (encrypted cookie)                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│                        API Route Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ /api/        │  │ /api/        │  │ /api/auth/   │                  │
│  │ transcript   │  │ metadata     │  │ [...nextauth]│                  │
│  │              │  │              │  │ (Auth.js)    │                  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
│         │                  │                  │                          │
├─────────┴──────────────────┴──────────────────┴──────────────────────────┤
│                        Business Logic Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ lib/youtube  │  │ lib/format   │  │ lib/db       │                  │
│  │ (fetching)   │  │ (transform)  │  │ (Drizzle)    │                  │
│  └──────────────┘  └──────────────┘  └──────┬───────┘                  │
│                                              │                           │
├──────────────────────────────────────────────┴───────────────────────────┤
│                        Data Layer                                        │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Vercel Postgres (via @vercel/postgres + Drizzle ORM)             │  │
│  │  - users (Auth.js adapter)                                         │  │
│  │  - accounts (OAuth data)                                           │  │
│  │  - sessions (optional, for database strategy)                      │  │
│  │  - transcripts (user history)                                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **middleware.ts** | Session validation and route protection | Auth.js `auth()` export as middleware; checks encrypted session cookie; redirects unauthenticated users from protected routes |
| **auth.ts** | NextAuth.js configuration | Exports `handlers`, `auth`, `signIn`, `signOut`; configures Google OAuth provider; sets up Drizzle adapter; defines JWT/session callbacks |
| **/api/auth/[...nextauth]/route.ts** | Auth.js HTTP handlers | Imports `handlers` from `auth.ts` and exports as `GET` and `POST` route handlers |
| **/api/transcript/route.ts** | Transcript fetching + optional saving | Fetches transcript via existing logic; if user authenticated, saves to DB with `userId` FK; returns transcript data |
| **lib/db/index.ts** | Database client initialization | Drizzle instance initialized with `drizzle()` from `drizzle-orm/vercel-postgres`; auto-detects `POSTGRES_URL` from env |
| **lib/db/schema.ts** | Database schema definitions | Drizzle `pgTable` definitions for users, accounts, sessions (Auth.js adapter), and transcripts (custom) |
| **app/history/page.tsx** | Protected history page | Server Component that calls `auth()` to verify session; queries user's transcripts from DB; displays list with metadata |
| **Home page (app/page.tsx)** | Public transcript tool interface | Existing client component; no auth required; optionally shows "Save" UI if user authenticated |

## Recommended Project Structure

```
app/
├── api/
│   ├── auth/
│   │   └── [...nextauth]/
│   │       └── route.ts          # Auth.js route handlers (GET/POST)
│   ├── transcript/
│   │   └── route.ts              # Enhanced with DB save logic
│   └── metadata/
│       └── route.ts              # Unchanged (video metadata)
├── history/
│   └── page.tsx                  # NEW: Protected page showing user's transcript history
├── page.tsx                      # Existing home page (public)
└── layout.tsx                    # Existing root layout

lib/
├── db/
│   ├── index.ts                  # NEW: Drizzle client instance
│   └── schema.ts                 # NEW: Auth.js adapter tables + transcripts table
├── youtube.ts                    # Existing transcript fetching logic
├── format.ts                     # Existing formatting utilities
└── types.ts                      # Extended with DB types

middleware.ts                     # NEW: Auth.js middleware for route protection
auth.ts                           # NEW: NextAuth.js configuration
drizzle.config.ts                 # NEW: Drizzle Kit configuration for migrations
```

### Structure Rationale

- **lib/db/**: Centralized database concerns; schema and client instance separate for clarity
- **middleware.ts**: Standard Next.js 16 pattern for route-level auth checks (previously `proxy.ts` in beta releases)
- **app/history/**: Protected route for authenticated users; Next.js convention for route-based organization
- **auth.ts at root**: Auth.js v5 convention; exports consumed by middleware and API routes

## Architectural Patterns

### Pattern 1: Optional Authentication (Public Tool + Protected Features)

**What:** Allow unauthenticated users to use the transcript tool while offering authenticated users additional features (save history, view saved transcripts).

**When to use:** When core functionality should be public but premium/convenience features require an account.

**Trade-offs:**
- **Pro:** Low barrier to entry; users can try the tool before creating an account
- **Pro:** Simpler onboarding flow
- **Con:** Need to handle both authenticated and unauthenticated states in UI/API
- **Con:** Unauthenticated users can't access history

**Example:**
```typescript
// app/api/transcript/route.ts
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { transcripts } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  const session = await auth();
  const { url, languageCode } = await request.json();

  // Fetch transcript (works for all users)
  const data = await fetchTranscript(videoId, languageCode);

  // Optionally save to DB if user is authenticated
  if (session?.user?.id) {
    await db.insert(transcripts).values({
      userId: session.user.id,
      videoId,
      videoTitle: metadata?.title,
      languageCode: data.selectedLanguage,
      segments: JSON.stringify(data.segments),
      createdAt: new Date(),
    });
  }

  return NextResponse.json({ success: true, data });
}
```

### Pattern 2: Middleware-Based Route Protection

**What:** Use Next.js middleware with Auth.js `auth()` to protect routes before they render.

**When to use:** When you need optimistic auth checks for protected pages (like `/history`).

**Trade-offs:**
- **Pro:** Centralized route protection logic
- **Pro:** Fast redirects (happens at edge/middleware layer)
- **Con:** Middleware runs on every request (use matcher to limit scope)
- **Con:** Cannot access request body in middleware (only headers/cookies)

**Example:**
```typescript
// middleware.ts
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/history');

  if (isProtectedRoute && !req.auth) {
    return NextResponse.redirect(new URL('/api/auth/signin', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
```

### Pattern 3: Database Session Strategy vs JWT Strategy

**What:** Auth.js supports two session strategies: JWT (stateless, cookie-based) or database (server-side, requires sessions table).

**When to use:**
- **JWT**: Default; works on Edge Runtime; no DB queries for session verification; good for most use cases
- **Database**: Needed for session revocation, single sign-out across devices, or regulatory compliance

**Trade-offs:**

| Aspect | JWT Strategy | Database Strategy |
|--------|-------------|------------------|
| **Performance** | Faster (no DB query per request) | Slower (DB query required) |
| **Revocation** | Cannot revoke until expiry | Can revoke immediately |
| **Edge Runtime** | ✅ Supported | ❌ Not supported (requires DB access) |
| **Session Table** | Not required | Required |
| **Scale** | Better for high traffic | Requires DB scaling |

**Recommendation for this project:** Use JWT strategy (default). The app is deployed to Vercel Edge, and immediate session revocation is not a critical requirement.

## Data Flow

### Request Flow: Authenticated User Fetches Transcript

```
[User enters YouTube URL]
    ↓
[Client: app/page.tsx] → POST /api/transcript
    ↓
[API Route] → auth() to check session
    ↓
[lib/youtube.ts] → fetchTranscript(videoId) → InnerTube API / Supadata fallback
    ↓
[API Route] → db.insert(transcripts) if authenticated
    ↓
[Response] ← JSON with transcript data
    ↓
[Client] ← Displays transcript + "Saved to history" message
```

### Request Flow: User Views History Page

```
[User navigates to /history]
    ↓
[Middleware] → auth() checks session → redirects if unauthenticated
    ↓
[Server Component: app/history/page.tsx] → auth() gets userId
    ↓
[Drizzle Query] → db.select().from(transcripts).where(eq(transcripts.userId, userId))
    ↓
[Response] ← SSR rendered page with transcript list
    ↓
[Client] ← Displays history with video titles, timestamps, actions
```

### Authentication Flow: Google OAuth Sign-In

```
[User clicks "Sign in with Google"]
    ↓
[signIn("google")] → /api/auth/signin/google
    ↓
[Auth.js] → Redirects to Google OAuth consent screen
    ↓
[Google] → User authorizes → Callback to /api/auth/callback/google
    ↓
[Auth.js] → Verifies OAuth code → Fetches user profile from Google
    ↓
[Drizzle Adapter] → Upserts user in DB (users + accounts tables)
    ↓
[Auth.js] → Creates session (JWT or DB) → Sets httpOnly cookie
    ↓
[Client] ← Redirects to home page (authenticated)
```

### State Management

**Client State (React):**
- Transcript data (segments, metadata, selected language)
- UI state (loading, error, timestamps toggle)
- **No auth state management needed** — Auth.js handles session via server-side `auth()`

**Server State:**
- Session validation (Auth.js middleware + `auth()` calls)
- Database queries (Drizzle ORM)
- No global state — each Server Component calls `auth()` independently

**Key Data Flows:**

1. **Session validation:** Middleware → encrypted cookie → `auth()` → session object
2. **Transcript persistence:** API route → Drizzle insert → Postgres
3. **History retrieval:** Server Component → `auth()` → Drizzle query → SSR render

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-10k users** | Current architecture is sufficient; JWT sessions; single Postgres instance on Vercel |
| **10k-100k users** | Add DB indexes on `transcripts.userId` and `transcripts.createdAt`; consider caching frequently accessed transcripts in Redis/KV |
| **100k+ users** | Move to connection pooling (PgBouncer); separate read replicas for history queries; consider CDN caching for popular video transcripts |

### Scaling Priorities

1. **First bottleneck:** Database connection limits
   - **Fix:** Vercel Postgres has connection pooling built-in; for higher scale, use PgBouncer or Neon/Supabase with serverless connection pooling

2. **Second bottleneck:** Transcript fetching rate limits (InnerTube/Supadata)
   - **Fix:** Cache transcripts in DB by `videoId`; check if transcript exists before fetching externally; serve cached version for popular videos

## Anti-Patterns

### Anti-Pattern 1: Client-Side Session Checks

**What people do:** Use `useSession()` hook from Auth.js to protect routes in Client Components.

**Why it's wrong:** Client-side checks can be bypassed; user sees flash of protected content before redirect; increases bundle size.

**Do this instead:** Use middleware for route protection and Server Components with `auth()` for data access. Client-side session access should only be for UI personalization (e.g., showing username), not authorization.

### Anti-Pattern 2: Storing Full Transcript in Session/JWT

**What people do:** Include transcript segments in the session object to avoid DB queries.

**Why it's wrong:** JWT has 4KB cookie size limit; transcripts can be 50-200KB; exceeds cookie size; breaks authentication.

**Do this instead:** Store transcripts in Postgres; query only when needed on history page; use pagination for large result sets.

### Anti-Pattern 3: Using Database Sessions on Vercel Edge

**What people do:** Configure Auth.js with `session: { strategy: "database" }` for Vercel Edge Functions.

**Why it's wrong:** Edge Runtime doesn't support full Node.js APIs required for most DB drivers; breaks on deployment; slower performance.

**Do this instead:** Use JWT strategy (default) for Edge deployments; only use database sessions if deploying to Node.js runtime (not Edge) and need immediate session revocation.

### Anti-Pattern 4: Blocking Middleware on All Routes

**What people do:** Run auth middleware on every route including `_next/static`, `_next/image`, API routes, etc.

**Why it's wrong:** Increases latency for static assets; wastes Edge invocations; can cause auth loops on auth endpoints.

**Do this instead:** Use matcher config to exclude static assets and auth routes:
```typescript
export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|.*\\.png$).*)'],
};
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Google OAuth** | Auth.js GoogleProvider with `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` env vars | Callback URL: `https://yourdomain.com/api/auth/callback/google`; set in Google Cloud Console |
| **Vercel Postgres** | `drizzle-orm/vercel-postgres` with auto-detected `POSTGRES_URL` | No explicit connection string needed; Vercel injects env var automatically |
| **YouTube InnerTube API** | Existing pattern (unchanged) | Primary transcript source; public API (no auth) |
| **Supadata API** | Existing pattern (unchanged) | Fallback when InnerTube blocked; requires `SUPADATA_API_KEY` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Client ↔ API Routes** | HTTP JSON via `fetch()` | Existing pattern; add optional session token in cookie |
| **API Routes ↔ Database** | Drizzle ORM queries | Use `auth()` to get `userId`; always filter by `userId` for user-scoped data |
| **Middleware ↔ Auth.js** | `auth()` function call | Returns session object or `null`; used for route protection |
| **Server Components ↔ Database** | Direct Drizzle queries in Server Components | Next.js 16 App Router pattern; no API route needed for SSR data |

## Database Schema Design

### Auth.js Adapter Tables (Required)

```typescript
// lib/db/schema.ts
import { pgTable, text, timestamp, integer, primaryKey } from 'drizzle-orm/pg-core';

// Users table (Auth.js adapter)
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
});

// Accounts table (OAuth data)
export const accounts = pgTable('accounts', {
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (account) => ({
  compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
}));

// Sessions table (optional, only if using database session strategy)
export const sessions = pgTable('sessions', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

// Verification tokens (optional, for magic link auth)
export const verificationTokens = pgTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (vt) => ({
  compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
}));
```

### Custom Application Tables

```typescript
// Transcripts history table
export const transcripts = pgTable('transcripts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  videoId: text('videoId').notNull(),
  videoTitle: text('videoTitle'),
  languageCode: text('languageCode').notNull(),
  segments: text('segments').notNull(), // JSON stringified TranscriptSegment[]
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('transcripts_userId_idx').on(table.userId),
  createdAtIdx: index('transcripts_createdAt_idx').on(table.createdAt),
}));
```

**Schema design notes:**
- **Foreign keys with cascade delete:** When user deleted, all accounts/sessions/transcripts also deleted
- **Indexes on userId and createdAt:** Optimize history queries (`WHERE userId = ? ORDER BY createdAt DESC`)
- **JSON storage for segments:** Avoids complex relational structure; Postgres has native JSON support
- **UUIDs for primary keys:** Compatible with Auth.js Drizzle adapter defaults

## Component Build Order

To minimize dependency issues, build in this order:

### Phase 1: Database Foundation
1. Install dependencies: `drizzle-orm`, `drizzle-kit`, `@vercel/postgres`, `next-auth@beta`, `@auth/drizzle-adapter`
2. Create `lib/db/schema.ts` with Auth.js adapter tables
3. Create `lib/db/index.ts` with Drizzle client
4. Create `drizzle.config.ts` for migrations
5. Generate and push migrations: `drizzle-kit generate` → `drizzle-kit push`

**Why first:** All subsequent components depend on DB schema being in place.

### Phase 2: Authentication Setup
1. Configure Google OAuth in Google Cloud Console (get client ID/secret)
2. Create `auth.ts` with NextAuth.js config (Google provider, Drizzle adapter)
3. Create `app/api/auth/[...nextauth]/route.ts` handlers
4. Create `middleware.ts` for route protection
5. Add env vars: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `POSTGRES_URL`

**Why second:** Auth layer needed before protected routes and DB saves.

### Phase 3: Transcript Persistence
1. Extend `lib/types.ts` with DB types
2. Update `app/api/transcript/route.ts` to save transcripts if user authenticated
3. Test saving flow with authenticated user

**Why third:** Requires auth to be working to get `userId`.

### Phase 4: History Page
1. Create `app/history/page.tsx` (Server Component)
2. Implement Drizzle query to fetch user's transcripts
3. Create UI components for displaying history list
4. Add "View history" link in header/nav

**Why last:** Depends on both auth and transcript persistence being functional.

## Sources

### High Confidence (Official Documentation)

- [Next.js 16 App Router Authentication Guide](https://nextjs.org/docs/app/building-your-application/authentication) - Next.js middleware and session patterns
- [Auth.js Drizzle Adapter](https://authjs.dev/getting-started/adapters/drizzle) - Official adapter documentation
- [Drizzle ORM with Vercel Postgres](https://orm.drizzle.team/docs/tutorials/drizzle-with-vercel) - Official integration guide
- [Auth.js Google Provider Setup](https://authjs.dev/getting-started/providers/google) - OAuth configuration
- [Next.js 16 Middleware (Proxy)](https://nextjs.org/docs/app/api-reference/file-conventions/middleware) - Route protection patterns

### Medium Confidence (Community Examples)

- [Basic Next.js + Drizzle + NextAuth Setup](https://medium.com/@shan32157/basic-next-js-drizzle-docker-next-auth-google-account-setup-b803d7a02e29)
- [Authentication using Auth.js v5 and Drizzle](https://reetesh.in/blog/authentication-using-auth.js-v5-and-drizzle-for-next.js-app-router)
- [Setting up Drizzle ORM with NextAuth.js in Next.js 14](https://codevoweb.com/setting-up-drizzle-orm-with-nextauth-in-nextjs-14/)
- [GitHub: onset - Next.js 14 + Drizzle + NextAuth starter](https://github.com/nrjdalal/onset)

---
*Architecture research for: TranscriptGrab auth + database milestone*
*Researched: 2026-02-17*
