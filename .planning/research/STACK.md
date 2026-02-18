# Stack Research

**Domain:** YouTube transcript tool with user accounts and persistent storage
**Researched:** 2026-02-17
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Auth.js (NextAuth v5) | `next-auth@beta` (v5.0.0-beta) | Google OAuth authentication | Official rewrite for App Router with universal `auth()` function, edge-compatible, production-ready beta. Renamed from NextAuth, v5 is the standard for Next.js 16. |
| Drizzle ORM | `^0.45.1` | TypeScript ORM for database operations | Lightweight (zero runtime dependencies), better edge/serverless performance than Prisma, SQL-first approach with full type safety. Standard choice for Next.js 16 + Vercel Postgres in 2026. |
| Vercel Postgres | `@vercel/postgres@^0.10.0` | Serverless PostgreSQL database | Native Vercel integration (now powered by Neon), zero-config setup, connection pooling via websockets for edge compatibility. Fits existing Vercel deployment. |
| Drizzle Kit | `^0.31.5` | Database migrations and schema management | Official migration tool for Drizzle, generates SQL migrations from TypeScript schema, introspection support. |
| @auth/drizzle-adapter | `^1.11.1` | Auth.js database adapter for Drizzle | Official adapter connecting Auth.js sessions/accounts to Drizzle ORM, supports PostgreSQL with proper type safety. |
| Zod | `^3.24.0` | Runtime schema validation | Industry standard for TypeScript validation, seamless Next.js Server Actions integration, reusable schemas for client/server. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@neondatabase/serverless` | `^0.10.0` | Alternative Neon driver | If migrating to direct Neon access (Vercel Postgres is Neon-backed, same infrastructure). Optional. |
| `@types/better-sqlite3` | `^7.6.0` | TypeScript types for local dev DB | For running a local SQLite database during development instead of connecting to Vercel Postgres. |
| `dotenv` | `^16.4.0` | Environment variable loading | Loading `.env.local` in Node.js contexts (Drizzle config, seed scripts). Next.js loads env vars automatically for app code. |
| `pg` | `^8.13.0` | Node.js PostgreSQL client | If using serverful environment instead of edge. Not needed for edge deployments with `@vercel/postgres`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Drizzle Studio | Visual database browser | Run `npx drizzle-kit studio` to inspect tables/data visually |
| Drizzle Kit CLI | Schema push, migrations, introspection | `npx drizzle-kit generate` for migrations, `push` for schema sync |

## Installation

```bash
# Core authentication and database
npm install next-auth@beta @auth/drizzle-adapter drizzle-orm @vercel/postgres

# Database tooling and validation
npm install drizzle-kit zod

# Development dependencies
npm install -D dotenv
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Auth.js v5 | Clerk | If you want managed auth with pre-built UI components and don't want to manage session logic. Trade-off: vendor lock-in, reliability concerns reported in production (Feb 2026). |
| Auth.js v5 | Better Auth | If you need more flexibility than Auth.js or want a newer, lighter alternative. Trade-off: smaller ecosystem, less battle-tested than Auth.js. |
| Drizzle ORM | Prisma | If your team prefers a higher-level abstraction with automated migrations and Prisma Studio. Trade-off: larger bundle size (~500KB vs ~40KB), slower edge performance, less SQL control. |
| Vercel Postgres | Neon (direct) | If you want database branching (one DB per PR), better free tier limits, or plan to migrate off Vercel. Trade-off: Vercel Postgres IS Neon underneath (same infrastructure), so switching is minimal effort. |
| Vercel Postgres | Supabase | If you need realtime subscriptions, file storage, or full backend-as-a-service. Trade-off: different platform (not Vercel-native), more complex setup for just auth+DB. |
| JWT sessions (default) | Database sessions | If you need immediate session revocation (force logout on compromised accounts). Trade-off: requires DB query on every authenticated request (slower, more expensive). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Lucia Auth | Deprecated March 2025, no longer maintained | Auth.js v5 or Better Auth |
| NextAuth v4 | Old architecture, not designed for App Router | Auth.js v5 (NextAuth v5 beta) |
| `middleware.ts` for Auth.js | Renamed to `proxy.ts` in Next.js 16 | `proxy.ts` with `export { auth as proxy }` |
| Direct Prisma with edge runtime | Large bundle size causes cold start issues on edge | Drizzle ORM (designed for edge/serverless) |
| Database sessions (default) | Adds latency and cost to every request | JWT sessions unless you need instant revocation |
| `@next-auth/*-adapter` scope | Deprecated, adapters moved to `@auth/*` scope | `@auth/drizzle-adapter` |

## Stack Patterns by Variant

**If using edge runtime (recommended for Vercel):**
- Use `@vercel/postgres` with websocket connection
- Use Drizzle ORM (not Prisma)
- Use JWT sessions (not database sessions)
- Because edge has no TCP, needs small bundles, and benefits from stateless auth

**If using Node.js runtime (serverful):**
- Can use `pg` or `postgres` driver directly
- Database sessions become viable (lower latency)
- More adapter options available
- Because TCP connections available, slower cold starts acceptable

**If using local development:**
- Option 1: Connect to Vercel Postgres preview database
- Option 2: Run local PostgreSQL with Docker
- Option 3: Use SQLite with Drizzle for local dev (same schema, different driver)
- Because local PostgreSQL requires Docker setup, SQLite is fastest for iteration

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next-auth@beta` (v5) | Next.js 14.0+ | Minimum Next.js 14.0, fully compatible with Next.js 16 |
| `drizzle-orm@^0.45.1` | `@vercel/postgres@^0.10.0` | Use `drizzle-orm/vercel-postgres` import |
| `drizzle-orm@^0.45.1` | `drizzle-kit@^0.31.5` | Keep drizzle-kit version aligned with drizzle-orm minor version |
| `@auth/drizzle-adapter@^1.11.1` | `next-auth@beta` (v5) | Official adapter, updated for Auth.js v5 |
| `@auth/drizzle-adapter@^1.11.1` | `drizzle-orm@^0.45.1` | Requires Drizzle schema definitions for users, accounts, sessions tables |

## Architecture Notes

### Authentication Flow
1. User clicks "Sign in with Google"
2. Auth.js redirects to Google OAuth consent screen
3. Google redirects back to `/api/auth/callback/google`
4. Auth.js creates/updates user in database via Drizzle adapter
5. JWT session token stored in HttpOnly cookie
6. Subsequent requests use `auth()` to read session from JWT

### Database Session Flow (if using database strategy)
1. Same OAuth flow (steps 1-4 above)
2. Auth.js creates session record in database
3. Session ID stored in HttpOnly cookie (not full user data)
4. Each request queries database to load session + user data
5. Sign out deletes session from database

### Connection Pooling
- `@vercel/postgres` automatically pools connections via websocket
- No manual pool management needed for edge runtime
- For serverful runtime, use `createPool()` from `@vercel/postgres` or `pg`
- Set idle timeout ~5 seconds for serverless (fast cleanup, reuse during traffic spikes)

## Database Schema Requirements

### Auth.js Required Tables (via Drizzle adapter)
```typescript
// Required tables for @auth/drizzle-adapter
- users (id, name, email, emailVerified, image)
- accounts (userId, type, provider, providerAccountId, ...)
- sessions (sessionToken, userId, expires) // Only if using database sessions
- verificationTokens (identifier, token, expires) // Only if using email verification
```

### Application Tables
```typescript
// TranscriptGrab-specific tables
- transcripts (id, userId, videoId, title, transcript, format, createdAt)
- user_preferences (userId, defaultFormat, autoSave, theme)
```

## Environment Variables Required

```bash
# Auth.js
AUTH_SECRET=<generate with: npx auth secret>
AUTH_GOOGLE_ID=<from Google Cloud Console>
AUTH_GOOGLE_SECRET=<from Google Cloud Console>

# Vercel Postgres (auto-injected by Vercel, set manually for local dev)
POSTGRES_URL=<connection string>
POSTGRES_PRISMA_URL=<connection pooling URL>
POSTGRES_URL_NON_POOLING=<direct connection URL>

# Next.js (production URL for OAuth callbacks)
NEXTAUTH_URL=https://transcriptgrab.vercel.app
```

## Migration Strategy

1. **Setup Auth.js**: Install packages, configure Google OAuth provider
2. **Setup Database**: Create Vercel Postgres instance, add env vars
3. **Define Schema**: Create Drizzle schema with Auth.js tables + transcript tables
4. **Generate Migrations**: Run `drizzle-kit generate` to create SQL migrations
5. **Push Schema**: Run `drizzle-kit push` or apply migrations via `drizzle-kit migrate`
6. **Test Locally**: Use `.env.local` to connect to Vercel Postgres preview database
7. **Deploy**: Push to Vercel, env vars already configured in production

## Sources

### High Confidence (Context7 + Official Docs)
- [Auth.js Next.js Documentation](https://authjs.dev/reference/nextjs) — Configuration patterns (Context7)
- [Drizzle ORM Vercel Tutorial](https://orm.drizzle.team/docs/tutorials/drizzle-with-vercel) — Setup guide (Context7)
- [@auth/drizzle-adapter Reference](https://authjs.dev/reference/adapter/drizzle) — Adapter configuration (Context7)
- [Vercel Postgres Package](https://github.com/vercel/storage/blob/main/packages/postgres/README.md) — Connection setup (Context7)
- [drizzle-orm npm package](https://www.npmjs.com/package/drizzle-orm) — Version 0.45.1 confirmed

### Medium Confidence (Official Sources + Multiple Web Sources)
- [Auth.js Migration to v5](https://authjs.dev/getting-started/migrating-to-v5) — Next.js 16 proxy.ts change
- [Auth.js Session Strategies](https://authjs.dev/concepts/session-strategies) — JWT vs database sessions
- [Vercel Pricing](https://vercel.com/pricing) — Free tier limitations
- [Vercel Postgres Transition Guide](https://neon.com/docs/guides/vercel-postgres-transition-guide) — Neon backing

### Comparisons (Web Search Verified)
- [Prisma vs Drizzle 2026](https://designrevision.com/blog/prisma-vs-drizzle) — ORM comparison
- [Neon vs Supabase 2026](https://designrevision.com/blog/supabase-vs-neon) — Database alternatives
- [Next.js Auth Alternatives 2026](https://clerk.com/articles/complete-authentication-guide-for-nextjs-app-router) — Clerk, Better Auth, Lucia status
- [Drizzle ORM Latest Releases](https://orm.drizzle.team/docs/latest-releases) — Version information

---
*Stack research for: TranscriptGrab auth and database milestone*
*Researched: 2026-02-17*
