# Phase 2: Database Infrastructure - Research

**Researched:** 2026-02-17
**Domain:** PostgreSQL database, ORM, Auth.js adapter, schema design
**Confidence:** HIGH

## Summary

This phase sets up the persistence layer for TranscriptGrab: a Neon PostgreSQL database (via Vercel Marketplace), Drizzle ORM for schema definition and queries, Auth.js Drizzle adapter tables for user/account storage, and a transcripts table for saving user transcript history.

A critical discovery: Vercel Postgres was deprecated in December 2024 and migrated to Neon. The `@vercel/postgres` SDK still works but is no longer maintained. New projects should use `@neondatabase/serverless` directly with `drizzle-orm/neon-http`. The Neon Vercel Marketplace integration provisions the database and injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) environment variables automatically. Legacy `POSTGRES_*` variables are also set for backward compatibility.

The recommended stack is Drizzle ORM with `drizzle-kit` for migrations. The Auth.js Drizzle adapter (`@auth/drizzle-adapter`) provides default PostgreSQL table definitions for `user` and `account` tables. Since the project uses JWT sessions (locked decision), the `session` and `verificationToken` tables are not required. Transcripts should store raw JSON segments to enable format switching in Phase 6 without re-fetching.

**Primary recommendation:** Use Drizzle ORM + `@neondatabase/serverless` (neon-http driver) with `@auth/drizzle-adapter`, storing raw transcript segments as JSONB for Phase 6 format flexibility.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Minimal metadata per transcript: video title, URL, thumbnail URL, transcript text, save date
- No extra fields (channel name, duration, language, publish date) -- keep lean, add later if needed
- One transcript per video per user -- unique constraint on user + video. Re-saving updates the existing record rather than creating duplicates
- Keep JWT sessions (current Phase 1 approach) -- no database session storage
- Database stores users and accounts for foreign keys, but session state stays in the cookie
- No DB hit per authenticated request

### Claude's Discretion
- Whether to store raw timestamped segments (for format switching in Phase 6) or formatted text only -- weigh Phase 6 requirements against schema simplicity
- Whether to extract video_id as a dedicated column or use full URL for uniqueness -- pick what makes duplicate detection cleanest
- User record creation timing (first sign-in vs first save) -- pick cleanest Auth.js adapter integration
- Profile sync on re-login (update from Google vs store once) -- follow Auth.js adapter defaults
- Auth.js adapter table scope (full schema vs minimal users+accounts) -- pick what JWT strategy actually requires
- ORM/query layer choice
- Migration tooling
- Connection pool configuration

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERS-01 | Transcript auto-saved to database when signed-in user generates one | Transcripts table with userId FK, upsert on unique(userId, videoId) |
| PERS-02 | Stored data includes full transcript text, timestamps, video title, video URL, thumbnail URL, and save date | Schema includes all fields; raw segments stored as JSONB preserves timestamps |
| PERS-03 | Unauthenticated users can still generate and copy transcripts without signing in | No schema change needed -- app logic gates DB writes on session presence |
| PERS-04 | Duplicate detection warns or prevents saving the same video transcript twice | Unique constraint on (userId, videoId) + ON CONFLICT DO UPDATE upsert pattern |
| PERS-05 | No artificial limits on number of saved transcripts | No row limits in schema; Neon free tier has 512MB storage |
| HIST-01 | Signed-in user can view all saved transcripts on a dedicated history page | SELECT with userId filter, ordered by savedAt DESC |
| HIST-02 | History displays as cards with video title, thumbnail, save date, and text preview | All fields stored in transcripts table; text preview derived from segments |
| HIST-03 | Cards sorted by most recent first | savedAt timestamp column with DESC index |
| HIST-04 | User can click a card to view the full transcript | Full segments stored as JSONB, retrievable by transcript id |
| HIST-05 | User can one-click copy full transcript text from history | Segments available for client-side formatting |
| HIST-06 | User can delete individual transcripts from history | DELETE by transcript id with userId guard |
| HIST-07 | User can bulk-select and delete multiple transcripts | DELETE WHERE id IN (...) with userId guard |
| HIST-08 | User can search history by video title or URL | text search on videoTitle and videoUrl columns |
| HIST-09 | User can export transcript from history in any available format | Raw segments enable format conversion (plain, timestamps, SRT) |
| HIST-10 | User can switch transcript format in history view without re-fetching | JSONB segments contain start/duration/text -- all format functions in lib/format.ts can operate on them |
</phase_requirements>

## Discretionary Decisions (Recommendations)

### Store raw timestamped segments as JSONB, not formatted text
**Recommendation:** Store `TranscriptSegment[]` as a JSONB column.

**Rationale:** Phase 6 (HIST-10) requires format switching without re-fetching. The existing `lib/format.ts` has `formatTranscriptText()` (plain/timestamps) and `generateSRT()` that all operate on `TranscriptSegment[]`. Storing raw segments means the history page can render any format client-side. Storing only formatted text would require re-fetching from YouTube (which may fail, rate-limit, or return different captions over time).

**Trade-off:** JSONB is slightly larger than plain text, but a typical transcript (2000 segments at ~80 bytes each) is ~160KB -- negligible for Neon's 512MB free tier.

### Extract video_id as a dedicated column
**Recommendation:** Store `videoId` (the 11-character YouTube ID) as a dedicated `text` column, not just the full URL.

**Rationale:** The unique constraint needs `(userId, videoId)` for duplicate detection. YouTube videos can have many URL forms (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, etc.) but share one `videoId`. The app already extracts `videoId` via `extractVideoId()` in `lib/youtube.ts`. Using the extracted ID rather than the raw URL prevents false-negative duplicate detection when the same video is submitted via different URL formats. Store the original URL separately for display purposes.

### User record creation: on first sign-in (Auth.js adapter default)
**Recommendation:** Let the Auth.js adapter handle user creation automatically on first OAuth sign-in.

**Rationale:** The `@auth/drizzle-adapter` `createUser` method is called by Auth.js during the OAuth flow when a new user signs in. This is the standard pattern -- no custom logic needed. The user row exists before any transcript can be saved (since saving requires authentication).

### Profile sync: follow Auth.js adapter defaults
**Recommendation:** Use Auth.js adapter defaults (store profile on first sign-in, no sync on re-login).

**Rationale:** The default `createUser` stores name, email, image on first sign-in. The adapter does not automatically update these on subsequent sign-ins. This is fine -- profile data is used for display only (avatar, initials). If the user changes their Google profile photo, it won't reflect until we add explicit sync logic, but that's a future concern outside this phase's scope.

### Auth.js adapter table scope: users + accounts only
**Recommendation:** Create only `user` and `account` tables from the adapter schema. Skip `session`, `verificationToken`, and `authenticator` tables.

**Rationale:** JWT sessions are a locked decision. The Auth.js adapter docs confirm that `sessionsTable` is optional and only required for database session strategy, and `verificationTokensTable` is only for Magic Link providers. Since this project uses Google OAuth with JWT sessions, neither is needed. The `authenticator` table is for WebAuthn, also not used. Creating only the required tables keeps the schema minimal.

### ORM: Drizzle ORM
**Recommendation:** Use Drizzle ORM (`drizzle-orm` + `drizzle-kit`).

**Rationale:** Drizzle is the standard choice for this stack. Auth.js has a first-party Drizzle adapter (`@auth/drizzle-adapter`). Drizzle is TypeScript-native, lightweight (~zero runtime overhead), supports Neon's serverless driver directly, and has built-in migration tooling. Prisma is the main alternative but adds a heavier runtime, requires a separate schema language, and the Neon serverless adapter for Prisma requires more configuration. The Auth.js Drizzle adapter source code (verified from GitHub) provides exact `pgTable` definitions that can be copied and extended.

### Migration tooling: drizzle-kit generate + migrate
**Recommendation:** Use `drizzle-kit generate` to create versioned SQL migration files, and `drizzle-kit migrate` to apply them.

**Rationale:** `drizzle-kit push` is convenient for development but doesn't maintain migration history. For a production app deployed to Vercel, versioned migrations are safer and auditable. The `__drizzle_migrations` table tracks what's been applied. Use `push` during rapid local development, `generate` + `migrate` for production.

### Connection pool configuration: Neon HTTP driver (no pool needed)
**Recommendation:** Use the Neon HTTP driver (`drizzle-orm/neon-http`) for the application. Use direct connection (`DATABASE_URL_UNPOOLED`) for `drizzle-kit` migrations.

**Rationale:** The Neon HTTP driver operates over HTTP fetch requests, which is optimal for serverless (Vercel Functions). It doesn't maintain persistent connections, so connection pooling is handled by Neon's built-in PgBouncer on the `DATABASE_URL` (pooled) endpoint. No application-side pool configuration is needed. For migrations, `drizzle-kit` needs a direct (non-pooled) connection because DDL statements don't work well through PgBouncer.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | latest (0.38.x) | TypeScript ORM, schema definition, queries | First-party Auth.js adapter support, zero-dep, serverless-native |
| `drizzle-kit` | latest (0.31.x) | Migration generation and execution | Paired with drizzle-orm, replaces manual SQL migrations |
| `@neondatabase/serverless` | latest | Neon PostgreSQL driver (HTTP mode) | Recommended replacement for deprecated @vercel/postgres |
| `@auth/drizzle-adapter` | latest (1.11.x) | Auth.js database adapter | Official adapter, provides user/account table definitions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` | latest | Load .env.local for drizzle-kit CLI | Only needed for local `drizzle-kit` commands |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Drizzle ORM | Prisma | Heavier runtime, separate schema language, more complex Neon setup |
| `@neondatabase/serverless` | `@vercel/postgres` | Still works but deprecated, no longer maintained by Vercel |
| `drizzle-orm/neon-http` | `drizzle-orm/neon-serverless` (WebSocket) | WebSocket needed only for interactive transactions, HTTP is simpler for this app |
| `drizzle-orm/neon-http` | `drizzle-orm/vercel-postgres` | Would still work (backward compat) but ties to deprecated SDK |

**Installation:**
```bash
npm install drizzle-orm @neondatabase/serverless @auth/drizzle-adapter
npm install -D drizzle-kit dotenv
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
├── db/
│   ├── index.ts         # Drizzle client instance (neon-http)
│   └── schema.ts        # All table definitions (auth + app tables)
drizzle/
├── 0000_initial.sql     # Generated migration files
├── 0001_add_transcripts.sql
└── meta/                # drizzle-kit metadata
drizzle.config.ts         # drizzle-kit configuration (project root)
```

### Pattern 1: Single Schema File with Auth.js Tables
**What:** Define Auth.js adapter tables alongside application tables in one schema file, passing custom tables to the adapter.
**When to use:** Always -- keeps schema co-located and allows extending auth tables if needed.
**Example:**
```typescript
// lib/db/schema.ts
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "@auth/core/adapters";
import type { TranscriptSegment } from "@/lib/types";

// Auth.js adapter tables (from @auth/drizzle-adapter source)
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

// Application tables
export const transcripts = pgTable(
  "transcript",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    videoId: text("videoId").notNull(),
    videoUrl: text("videoUrl").notNull(),
    videoTitle: text("videoTitle").notNull(),
    thumbnailUrl: text("thumbnailUrl"),
    segments: jsonb("segments").$type<TranscriptSegment[]>().notNull(),
    savedAt: timestamp("savedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("transcript_user_video_idx").on(table.userId, table.videoId),
  ]
);
```

### Pattern 2: Drizzle Client Initialization (Neon HTTP)
**What:** Create a singleton Drizzle client using the Neon HTTP driver.
**When to use:** All database access in the application.
**Example:**
```typescript
// lib/db/index.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
```

### Pattern 3: Auth.js Configuration with Drizzle Adapter
**What:** Wire the Drizzle adapter into the existing NextAuth config.
**When to use:** Updating auth.ts to use the database adapter.
**Example:**
```typescript
// auth.ts (updated)
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts } from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
  }),
  providers: [Google],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
```

### Pattern 4: Transcript Upsert (for PERS-01/PERS-04)
**What:** Save or update a transcript using ON CONFLICT upsert.
**When to use:** When a signed-in user generates a transcript.
**Example:**
```typescript
// lib/db/queries.ts
import { db } from "@/lib/db";
import { transcripts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function upsertTranscript(data: {
  userId: string;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  thumbnailUrl: string | null;
  segments: TranscriptSegment[];
}) {
  return db
    .insert(transcripts)
    .values({
      ...data,
      savedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [transcripts.userId, transcripts.videoId],
      set: {
        videoTitle: data.videoTitle,
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        segments: data.segments,
        savedAt: new Date(),
      },
    })
    .returning();
}
```

### Anti-Patterns to Avoid
- **Using `@vercel/postgres` for new projects:** Deprecated since December 2024. Use `@neondatabase/serverless` directly.
- **Creating session/verificationToken tables with JWT strategy:** Wastes schema space and causes confusion about which session mechanism is active.
- **Storing only formatted text:** Locks you into one format, prevents Phase 6 format switching.
- **Using full YouTube URL for uniqueness:** Same video has many URL forms; always normalize to the 11-character `videoId`.
- **Running `drizzle-kit push` in production:** No migration history, no rollback ability, risky for production data.
- **Using pooled connection for migrations:** DDL statements through PgBouncer can fail or behave unexpectedly; use `DATABASE_URL_UNPOOLED`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database schema management | Raw SQL files with manual versioning | `drizzle-kit generate` + `drizzle-kit migrate` | Tracks migration state, generates diffs automatically, handles rollback metadata |
| Auth user/account tables | Custom user table schema | `@auth/drizzle-adapter` default schema | Auth.js expects specific column names and types; adapter handles CRUD operations |
| Connection pooling | Application-side pool management | Neon's built-in PgBouncer (pooled endpoint) | Neon handles pool sizing, idle timeouts, and connection limits server-side |
| UUID generation | Custom ID generators | `crypto.randomUUID()` via `$defaultFn` | Standard, cryptographically secure, matches Auth.js adapter pattern |
| Upsert logic | Manual SELECT-then-INSERT/UPDATE | Drizzle `.onConflictDoUpdate()` | Atomic, race-condition-free, single round trip |

**Key insight:** The Auth.js adapter is doing the heavy lifting for user management. The only custom schema work is the transcripts table and wiring the adapter into the existing auth config.

## Common Pitfalls

### Pitfall 1: Vercel Postgres is Deprecated
**What goes wrong:** Following old tutorials that reference `@vercel/postgres` SDK and `POSTGRES_URL` env vars.
**Why it happens:** Vercel Postgres was deprecated December 2024 and migrated to Neon. Most existing tutorials haven't been updated.
**How to avoid:** Use `@neondatabase/serverless` with `drizzle-orm/neon-http`. Install Neon via Vercel Marketplace. The integration sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).
**Warning signs:** Seeing `@vercel/postgres` in install commands, references to `POSTGRES_URL` as the primary env var.

### Pitfall 2: Using Pooled Connection for Migrations
**What goes wrong:** `drizzle-kit migrate` fails or produces inconsistent results when run against the pooled (PgBouncer) endpoint.
**Why it happens:** PgBouncer in transaction mode doesn't support all DDL operations correctly. CREATE INDEX CONCURRENTLY, advisory locks, and multi-statement transactions can fail.
**How to avoid:** Use `DATABASE_URL_UNPOOLED` in `drizzle.config.ts` for migration commands. Use `DATABASE_URL` (pooled) in the application runtime.
**Warning signs:** Migration errors about "cannot run inside a transaction block" or locks not being acquired.

### Pitfall 3: Missing Adapter Tables Causing Silent Auth Failures
**What goes wrong:** Auth.js adapter is configured but tables don't exist in the database, causing cryptic runtime errors on first sign-in.
**Why it happens:** Forgot to run migrations after adding the adapter configuration.
**How to avoid:** Always run `drizzle-kit generate` then `drizzle-kit migrate` before deploying auth changes. Test sign-in locally with a local Neon database or the dev branch.
**Warning signs:** 500 errors on `/api/auth/callback/google`, "relation does not exist" in server logs.

### Pitfall 4: JSONB Column Type Mismatch
**What goes wrong:** Inserting JavaScript objects into JSONB columns fails or returns unexpected types.
**Why it happens:** Drizzle's JSONB handling requires explicit type annotation with `$type<T>()`.
**How to avoid:** Always annotate JSONB columns: `jsonb("segments").$type<TranscriptSegment[]>()`. Drizzle handles serialization/deserialization automatically when the type is declared.
**Warning signs:** Runtime type errors when reading JSONB data back, or `[object Object]` stored as text.

### Pitfall 5: onConflictDoUpdate Target Must Match Unique Index
**What goes wrong:** Upsert doesn't work because the conflict target doesn't match any unique constraint.
**Why it happens:** The `target` array in `onConflictDoUpdate` must reference columns that form a unique index or primary key.
**How to avoid:** Ensure the `uniqueIndex("transcript_user_video_idx").on(table.userId, table.videoId)` exists in the schema and is included in migrations before attempting upserts.
**Warning signs:** Postgres error "there is no unique or exclusion constraint matching the ON CONFLICT specification".

### Pitfall 6: Existing Users Losing Access After Adding Adapter
**What goes wrong:** Users who signed in before the adapter was added get duplicate entries or can't sign in.
**Why it happens:** Before the adapter, Auth.js generated user IDs internally (in the JWT). After adding the adapter, it expects to find users in the database. Existing JWTs reference IDs that don't exist in the new user table.
**How to avoid:** Clear existing sessions (users re-sign-in) after deploying the adapter. Since this is an early-stage app with few users, this is acceptable. The adapter will create new user records on first sign-in.
**Warning signs:** "User not found" errors for existing users who have valid JWTs from the pre-adapter era.

## Code Examples

Verified patterns from official sources:

### drizzle.config.ts
```typescript
// Source: Drizzle ORM docs (https://orm.drizzle.team/docs/tutorials/drizzle-with-neon)
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
```

### Database Client (Neon HTTP)
```typescript
// Source: Neon docs (https://neon.com/docs/guides/drizzle)
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

### Migration Commands
```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply pending migrations to database
npx drizzle-kit migrate

# Push schema directly (dev only)
npx drizzle-kit push
```

### Querying Transcripts
```typescript
// Source: Drizzle ORM docs (verified pattern)
import { db } from "@/lib/db";
import { transcripts } from "@/lib/db/schema";
import { eq, desc, or, ilike } from "drizzle-orm";

// Get user's transcripts (HIST-01, HIST-03)
const history = await db
  .select()
  .from(transcripts)
  .where(eq(transcripts.userId, userId))
  .orderBy(desc(transcripts.savedAt));

// Search by title or URL (HIST-08)
const results = await db
  .select()
  .from(transcripts)
  .where(
    and(
      eq(transcripts.userId, userId),
      or(
        ilike(transcripts.videoTitle, `%${query}%`),
        ilike(transcripts.videoUrl, `%${query}%`)
      )
    )
  )
  .orderBy(desc(transcripts.savedAt));

// Delete single transcript (HIST-06)
await db
  .delete(transcripts)
  .where(
    and(
      eq(transcripts.id, transcriptId),
      eq(transcripts.userId, userId)
    )
  );

// Bulk delete (HIST-07)
await db
  .delete(transcripts)
  .where(
    and(
      inArray(transcripts.id, transcriptIds),
      eq(transcripts.userId, userId)
    )
  );
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@vercel/postgres` SDK | `@neondatabase/serverless` | Dec 2024 | Must use Neon driver for new projects |
| Vercel Postgres (managed) | Neon via Vercel Marketplace | Dec 2024 | Different provisioning flow, new env var names |
| `POSTGRES_URL` env var | `DATABASE_URL` env var | Dec 2024 | Neon integration uses `DATABASE_URL` as primary |
| `drizzle-kit generate:pg` | `drizzle-kit generate` | drizzle-kit 0.21+ | Dialect-specific commands replaced by single command using config |
| Manual Auth.js SQL schemas | `@auth/drizzle-adapter` defaults | 2024 | Copy schema from adapter source, customize as needed |

**Deprecated/outdated:**
- `@vercel/postgres`: Still functional but no longer maintained. Will be deprecated fully.
- `drizzle-orm/vercel-postgres`: Works via backward compat but ties to deprecated SDK.
- `POSTGRES_URL` / `POSTGRES_PRISMA_URL`: Legacy env var names. New Neon integration uses `DATABASE_URL`.
- `drizzle-kit generate:pg`, `drizzle-kit push:pg`: Old dialect-specific CLI commands. Use `drizzle-kit generate` / `drizzle-kit push` with dialect in config.

## Open Questions

1. **Local development database strategy**
   - What we know: Neon provides a free tier with dev branches. Alternatively, Docker Postgres works locally.
   - What's unclear: Whether to use Neon dev branch or local Postgres for development.
   - Recommendation: Use `drizzle-kit push` against a Neon dev branch for simplicity. Avoid Docker complexity for a single-dev project. Set `DATABASE_URL` in `.env.local` pointing to the Neon dev branch connection string.

2. **Neon free tier limits for production viability**
   - What we know: Neon free tier provides 0.5 GB storage, 24 hours compute/month, branching support.
   - What's unclear: Whether compute limits will be hit under normal usage.
   - Recommendation: Should be fine for an early-stage app. Monitor usage. The Launch plan ($19/mo) provides 10GB and 300 compute hours if needed.

3. **Existing user JWT tokens after adding adapter**
   - What we know: Current users have JWT tokens with IDs generated by Auth.js (not from a database). Adding the adapter changes ID generation.
   - What's unclear: Exact behavior when an existing JWT hits the adapter.
   - Recommendation: Since this is early-stage with few (if any) real users, accept that existing sessions will need to re-authenticate. Document this as a known breaking change in deploy notes.

## Sources

### Primary (HIGH confidence)
- Auth.js Drizzle adapter source code: `nextauthjs/next-auth/packages/adapter-drizzle/src/lib/pg.ts` -- full schema definitions verified
- Auth.js docs: https://authjs.dev/getting-started/adapters/drizzle -- adapter setup, optional tables confirmation
- Drizzle ORM docs: https://orm.drizzle.team/docs/connect-vercel-postgres -- Vercel Postgres connection pattern
- Drizzle ORM docs: https://orm.drizzle.team/docs/drizzle-kit-migrate -- migration strategy
- Neon docs: https://neon.com/docs/guides/drizzle -- Drizzle + Neon setup
- Neon docs: https://neon.com/docs/guides/vercel-managed-integration -- env vars, provisioning
- Vercel docs: https://vercel.com/docs/postgres -- deprecation notice confirmed
- Vercel Storage repo: https://github.com/vercel/storage -- `@vercel/postgres` pool configuration

### Secondary (MEDIUM confidence)
- Neon transition guide: https://neon.com/docs/guides/vercel-postgres-transition-guide -- verified SDK deprecation timeline
- Drizzle ORM docs: https://orm.drizzle.team/docs/tutorials/drizzle-with-neon -- Neon-specific patterns
- npm: https://www.npmjs.com/package/@auth/drizzle-adapter -- version 1.11.1 confirmed

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified via official docs and source code
- Architecture: HIGH -- patterns from official Drizzle + Auth.js docs, adapter source code inspected
- Pitfalls: HIGH -- Vercel Postgres deprecation confirmed via official Vercel docs; migration/pooling issues documented in Drizzle and Neon docs

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable stack, 30 days)
