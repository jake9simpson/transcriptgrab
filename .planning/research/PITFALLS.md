# Pitfalls Research

**Domain:** Adding Authentication (NextAuth/Google OAuth), Database (Vercel Postgres), and User History to Existing Next.js App
**Researched:** 2026-02-17
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Environment Variable Configuration Hell

**What goes wrong:**
NextAuth fails silently in production with cryptic "OAuthCallback" errors or JWT decryption failures while working perfectly in local development. Google OAuth redirects to `localhost:3000` even when deployed to production.

**Why it happens:**
- `NEXTAUTH_URL` pointing to localhost in Vercel production environment
- Missing `NEXTAUTH_SECRET` environment variable (required for JWT encryption)
- Changing `NEXTAUTH_SECRET` after users have active sessions
- Case-sensitive environment variable names (`nextauth_secret` ≠ `NEXTAUTH_SECRET`)
- Authorized redirect URIs in Google Cloud Console not matching production callback URL

**How to avoid:**
1. Set `NEXTAUTH_URL=https://yourdomain.com` in Vercel production environment (not localhost)
2. Generate strong `NEXTAUTH_SECRET` with `openssl rand -base64 32` and set in all environments
3. Add exact callback URL `https://yourdomain.com/api/auth/callback/google` to Google Cloud Console "Authorized redirect URIs"
4. For localhost, add `http://localhost:3000/api/auth/callback/google` as separate entry
5. Never change `NEXTAUTH_SECRET` after deployment without planning user logout event
6. **Redeploy after adding/changing environment variables** - Vercel doesn't automatically redeploy

**Warning signs:**
- "redirect_uri_mismatch" errors in Google OAuth
- JWEDecryptionFailed errors in production logs
- Callback errors that don't occur in development
- Session cookies not persisting between requests

**Phase to address:**
Phase 1 (Auth Foundation) - Set up all environment variables before first deployment, document exact values needed, create verification checklist

---

### Pitfall 2: Middleware Authentication Blocking Legitimate Requests

**What goes wrong:**
Middleware redirects authenticated users away from public pages (creating redirect loops), blocks static assets and API routes (breaking the site), or fails to run on edge runtime due to Node.js dependencies like `jsonwebtoken`.

**Why it happens:**
- Middleware runs on **all routes** by default including `/_next/static/*`, images, and API routes
- Missing `matcher` config to exclude static assets
- Using Node.js-only libraries (`jsonwebtoken`, native crypto) in edge runtime
- Overly broad protected route patterns that catch unintended routes
- Not distinguishing between "requires auth" vs "benefits from auth" routes

**How to avoid:**
1. **Always define matcher config** to exclude static assets:
   ```typescript
   export const config = {
     matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)']
   }
   ```
2. Use `jose` library (not `jsonwebtoken`) for JWT verification in edge middleware
3. For optional auth (guest + authenticated users), check session existence without redirecting:
   ```typescript
   const session = await decrypt(cookie)
   // Don't redirect if no session - just continue
   if (!session && isProtectedRoute) {
     return NextResponse.redirect('/login')
   }
   ```
4. List explicit protected routes, don't use catch-all patterns
5. For Next.js 15.2.0+, use Node.js runtime in middleware for full database session checks

**Warning signs:**
- Infinite redirect loops between `/` and `/login`
- Images or CSS failing to load
- "crypto is not defined" or "jsonwebtoken" errors
- Middleware blocking API routes
- Performance degradation on every request

**Phase to address:**
Phase 1 (Auth Foundation) - Define route protection strategy upfront, distinguish protected vs public routes, test middleware against all route types

---

### Pitfall 3: Database Connection Pool Exhaustion in Serverless

**What goes wrong:**
"Connection pool timeout" errors after deployment. Database connections max out at 200 concurrent connections, causing new requests to fail with "no available connections" or "FATAL: remaining connection slots are reserved".

**Why it happens:**
- Each serverless function invocation creates a new connection pool
- Traditional connection pools leak clients when functions are suspended
- Using `POSTGRES_URL_NON_POOLING` instead of `POSTGRES_URL` (pooled)
- Creating pools outside request handlers with Neon/Vercel Postgres
- Prisma without proper connection pooling configuration

**How to avoid:**
1. **Use `POSTGRES_URL` (pooled connection)**, not `POSTGRES_URL_NON_POOLING`
2. For Vercel Postgres/Neon: create pool **inside** request handler, not at module level:
   ```typescript
   // WRONG - creates pool at module level
   const pool = new Pool({ connectionString: process.env.POSTGRES_URL })

   // CORRECT - create inside handler
   export async function GET() {
     const pool = new Pool({ connectionString: process.env.POSTGRES_URL })
     // use pool
   }
   ```
3. Use `@vercel/postgres` which handles pooling automatically for edge runtime
4. For Prisma: set `connection_limit=1` in `DATABASE_URL` for serverless
5. Consider Vercel Fluid Compute for persistent connection reuse across requests

**Warning signs:**
- "ECONNREFUSED ::1:443" errors
- "Connection pool timeout" in logs
- Intermittent database connection failures under load
- Connection count climbing in database metrics
- 50+ leaked connections on free tier (200 max)

**Phase to address:**
Phase 2 (Database Setup) - Configure pooling before writing any queries, load test connection handling, monitor connection pool metrics

---

### Pitfall 4: Foreign Key Cascade Delete Data Loss

**What goes wrong:**
When a user deletes their account or a session expires, transcript history gets cascade-deleted unexpectedly. User complains "all my saved transcripts disappeared" after re-authentication.

**Why it happens:**
- NextAuth tables use `ON DELETE CASCADE` for sessions → user relationship
- Custom `transcripts` table has foreign key to `users.id` with cascade delete
- Deleting expired session triggers user deletion which cascades to transcripts
- NextAuth's session cleanup inadvertently triggers cascade through foreign keys

**How to avoid:**
1. **DO NOT use `ON DELETE CASCADE`** from `transcripts.userId` to `users.id`
2. Use `ON DELETE SET NULL` or `ON DELETE RESTRICT` for user data tables
3. Implement soft deletes for user accounts (set `deletedAt` timestamp, don't actually delete)
4. If using cascade, clearly document what gets deleted and test thoroughly
5. For optional auth scenario: allow `userId` to be `NULL` for guest transcripts

**Warning signs:**
- User data disappearing after session expiration
- Cascade delete warnings in database logs
- Foreign key constraint violations during testing
- Users losing data after logout/re-login

**Phase to address:**
Phase 2 (Database Setup) - Define cascade behavior explicitly in schema, test account deletion flow, implement soft deletes if needed

---

### Pitfall 5: Race Conditions in Auto-Save Transcript History

**What goes wrong:**
User's transcript edits get overwritten by older auto-save requests that arrive out-of-order. User sees their latest changes revert to an earlier state, creating a frustrating "ghost typing" experience.

**Why it happens:**
- Multiple rapid auto-save requests fire from debounced input
- HTTP requests are asynchronous - no guarantee of arrival order
- Last request to arrive wins, not last request sent
- No version/timestamp checking on database updates
- Optimistic UI updates don't match server state

**How to avoid:**
1. **Implement version/timestamp-based updates**:
   ```typescript
   UPDATE transcripts
   SET content = $1, updated_at = NOW()
   WHERE id = $2 AND updated_at <= $3
   ```
2. Use FIFO queue to ensure strict ordering of auto-save operations
3. Debounce aggressively (500-1000ms) to reduce concurrent requests
4. Return timestamp/version from server, only apply if newer than client
5. Use optimistic updates with rollback on conflict
6. Consider using Server Actions with `revalidatePath` for consistency

**Warning signs:**
- Users report lost edits during rapid typing
- Auto-save operations completing out-of-order in logs
- Flashing/reverting UI updates
- "Version conflict" errors
- Multiple simultaneous writes to same transcript

**Phase to address:**
Phase 3 (Transcript History) - Design auto-save strategy before implementing UI, add versioning to schema, load test rapid consecutive updates

---

### Pitfall 6: NextAuth Database Adapter Schema Mismatch

**What goes wrong:**
NextAuth fails with "relation does not exist" or "column not found" errors. Database migrations fail because adapter expects different table/column names than what's in your schema.

**Why it happens:**
- Using Prisma `@map` directives without configuring adapter
- Table names don't match adapter expectations (e.g., `User` vs `users`)
- Missing required NextAuth columns (e.g., `emailVerified`, `sessionToken`)
- Adapter version incompatible with NextAuth v5
- Creating custom schema without following adapter requirements

**How to avoid:**
1. **Use official adapter schemas** as starting point - don't write from scratch
2. For Prisma, copy exact schema from NextAuth docs:
   ```prisma
   model User {
     id            String    @id @default(cuid())
     email         String    @unique
     emailVerified DateTime?
     // ... exact fields from docs
   }
   ```
3. If using `@map`, ensure adapter supports it (Prisma adapter does)
4. Run schema validation after creating tables
5. Test auth flow immediately after migration

**Warning signs:**
- "relation 'users' does not exist" in Postgres
- "column 'emailVerified' not found"
- NextAuth errors about missing tables
- Failed database migrations
- Auth callback errors mentioning database

**Phase to address:**
Phase 2 (Database Setup) - Copy official adapter schema exactly, validate before implementing auth, test with real OAuth flow

---

### Pitfall 7: SessionProvider in App Router Layout (Client Component Requirement)

**What goes wrong:**
Build fails with "SessionProvider cannot be used in Server Components" or authentication state never updates in client components.

**Why it happens:**
- Trying to use `<SessionProvider>` directly in root `layout.tsx` (Server Component)
- Not creating separate client component wrapper
- Missing `"use client"` directive on SessionProvider wrapper
- Confusion between App Router (server-first) and Pages Router patterns

**How to avoid:**
1. **Create separate client component** for SessionProvider:
   ```typescript
   // app/providers.tsx
   "use client"
   import { SessionProvider } from "next-auth/react"

   export function Providers({ children }) {
     return <SessionProvider>{children}</SessionProvider>
   }
   ```
2. Import Providers in layout.tsx, not SessionProvider directly
3. Use `auth()` in Server Components, `useSession()` in Client Components
4. Don't wrap entire app if not needed - only wrap client component subtrees

**Warning signs:**
- Build errors about Server Components
- `useSession()` always returns `null` or `loading`
- Session state not updating after sign-in
- Hydration mismatches

**Phase to address:**
Phase 1 (Auth Foundation) - Set up providers correctly before implementing auth UI

---

### Pitfall 8: CVE-2025-29927 Middleware Bypass Vulnerability

**What goes wrong:**
Attackers bypass authentication middleware by sending specific HTTP headers, gaining unauthorized access to protected routes.

**Why it happens:**
- Next.js versions before 15.2.3 (and other patched versions) have middleware bypass bug
- Self-hosted deployments especially vulnerable
- Middleware authentication checks can be skipped with crafted requests
- Critical severity (CVSS 9.1)

**How to avoid:**
1. **Update Next.js immediately**: Use ≥15.2.3, ≥14.2.25, ≥13.5.9, or ≥12.3.5
2. Verify current version: `npm list next`
3. Don't rely solely on middleware for auth - use defense in depth
4. Implement auth checks in data access layer (DAL) as well
5. Monitor security advisories for Next.js

**Warning signs:**
- Using Next.js versions below patched versions
- Unexpected access to protected routes in logs
- Security scan findings about middleware bypass

**Phase to address:**
Phase 1 (Auth Foundation) - Verify Next.js version before starting, update if needed, implement multi-layer auth checks

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| JWT-only sessions (no database) | Faster, no DB queries | Can't invalidate sessions, no audit trail | Never for this project (need history) |
| Skip session expiry refresh | Simpler code | Sessions expire abruptly, poor UX | Never - users lose work |
| Store entire transcript in session | Fast access | Session cookie bloat (>4KB), slow middleware | Never - use database |
| Use `POSTGRES_URL_NON_POOLING` | "Simpler" connection string | Connection pool exhaustion in production | Never in serverless |
| Single `NEXTAUTH_SECRET` across all envs | Easier to manage | Dev session leaks compromise prod | Never - separate secrets |
| Skip middleware matcher config | Less code | Blocks static assets, poor performance | Never - always define matcher |
| Auto-save on every keystroke | Feels responsive | Database hammering, race conditions | Only with 500ms+ debounce |
| Cascade delete on all FKs | Clean database | Accidental data loss | Only for truly ephemeral data (sessions) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google OAuth | Forgetting to add production callback URL to Google Console | Add both localhost and production URLs, verify exact match including trailing slashes |
| Vercel Postgres | Using `@vercel/postgres` package (deprecated) | Migrate to Neon or alternate from Vercel Marketplace |
| NextAuth v5 | Using v4 documentation/patterns | Check docs URL - ensure using authjs.dev (v5), not next-auth.js.org (v4) |
| Prisma + Vercel | Missing `connection_limit=1` in DATABASE_URL | Always add for serverless: `?connection_limit=1&pool_timeout=0` |
| Middleware auth | Using `getServerSession()` in middleware | Use `jose` for JWT verification in edge, or upgrade to Next.js 15.2.0+ for Node runtime |
| Environment vars | Setting on Vercel but not redeploying | Always redeploy after env var changes |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Database query in middleware | Slow page loads, timeouts | Use optimistic cookie-based checks only | Every request with 100+ users |
| No connection pooling | Random connection failures | Use `POSTGRES_URL` (pooled), not non-pooling | 20+ concurrent users |
| Auto-save without debounce | Database write storms | 500ms debounce minimum | Typing speed > 2 chars/sec |
| Loading full session in Server Components | Slow SSR, prop drilling | Use `cache(verifySession)` pattern | Pages with 5+ components |
| Fetching all user history on load | Initial load timeout | Pagination + infinite scroll | 50+ saved transcripts |
| No database indexes on userId | Slow history queries | Add index on `transcripts.userId` | 1000+ total transcripts |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing database credentials to client | Database compromise | Never use `NEXT_PUBLIC_` prefix for secrets |
| Skipping CSRF protection | Session hijacking | Enable NextAuth built-in CSRF (default on) |
| HTTP-only cookies disabled | XSS session theft | Keep `httpOnly: true` in cookie config |
| Missing `secure` flag in production | MITM attacks | Set `secure: true` for production cookies |
| Storing transcripts without user ownership check | Unauthorized access | Always filter by `session.user.id` in queries |
| No rate limiting on auto-save | DoS via rapid saves | Rate limit Server Actions to 10/sec per user |
| Trusting `userId` from client | Data tampering | Always get userId from server session, never params |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Redirecting authenticated users from homepage | Confusing navigation | Allow viewing homepage, add "Go to dashboard" CTA |
| Losing transcript on session expiry | Data loss, frustration | Auto-save in localStorage, sync on re-auth |
| No loading states during OAuth redirect | Appears broken | Show "Signing in with Google..." spinner |
| Clearing form on auto-save error | Work lost | Retry silently, show warning toast, keep form state |
| No indication of save status | Uncertainty | Show "Saved 2 seconds ago" or "Saving..." indicator |
| Forcing login for one-time transcript fetch | Friction | Allow guest usage, show "Sign in to save" prompt |

## "Looks Done But Isn't" Checklist

- [ ] **OAuth**: Often missing production callback URL in Google Console - verify both dev and prod URLs are registered
- [ ] **Session persistence**: Often missing `NEXTAUTH_SECRET` or using same secret across environments - verify unique per environment
- [ ] **Database pooling**: Often using non-pooled URL - verify `POSTGRES_URL` contains "-pooler" or uses @vercel/postgres
- [ ] **Middleware matcher**: Often missing or incomplete - verify static assets, images, API routes are excluded
- [ ] **Foreign key cascades**: Often defaulting to CASCADE - verify transcript data uses SET NULL or RESTRICT
- [ ] **Auto-save versioning**: Often missing timestamp checks - verify updates include `WHERE updated_at <= $timestamp`
- [ ] **Error boundaries**: Often missing for auth failures - verify graceful fallbacks for OAuth errors
- [ ] **Environment variable deployment**: Often set but not redeployed - verify redeployment after every env var change

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong callback URL | LOW | Add correct URL to Google Console, wait 5-10 min for propagation |
| Changed NEXTAUTH_SECRET | MEDIUM | All users logged out, announce via status page, users must re-login |
| Connection pool exhaustion | LOW | Redeploy with `POSTGRES_URL` (pooled), kills existing connections |
| Cascade deleted transcripts | HIGH | Restore from database backups, implement soft deletes going forward |
| Race condition data loss | MEDIUM | Add versioning to schema (migration), deploy updated auto-save logic |
| Missing middleware matcher | LOW | Add config, redeploy (instant fix) |
| SessionProvider in Server Component | LOW | Create client wrapper, refactor layout (15-30 min) |
| Middleware auth bypass (CVE) | HIGH | Emergency Next.js upgrade, security audit of auth, notify users |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Environment variable configuration | Phase 1 (Auth Foundation) | OAuth works in both dev and prod, JWTs decrypt correctly |
| Middleware blocking requests | Phase 1 (Auth Foundation) | Static assets load, images render, no redirect loops |
| Connection pool exhaustion | Phase 2 (Database Setup) | Load test 50+ concurrent requests without errors |
| Cascade delete data loss | Phase 2 (Database Setup) | Delete test user, verify transcripts remain |
| Auto-save race conditions | Phase 3 (Transcript History) | Rapid successive saves preserve latest changes |
| Database adapter schema mismatch | Phase 2 (Database Setup) | OAuth sign-in creates user record correctly |
| SessionProvider placement | Phase 1 (Auth Foundation) | useSession() returns session in client components |
| Middleware bypass vulnerability | Phase 1 (Auth Foundation) | Next.js version >= 15.2.3, security scan passes |

## Sources

### Authentication & NextAuth
- [Stop Crying Over Auth: Next.js 16 & Auth.js v5](https://javascript.plainenglish.io/stop-crying-over-auth-a-senior-devs-guide-to-next-js-15-auth-js-v5-42a57bc5b4ce)
- [NextAuth.js 2025 Guide](https://strapi.io/blog/nextauth-js-secure-authentication-next-js-guide)
- [Auth.js Migration to v5](https://authjs.dev/getting-started/migrating-to-v5)
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Next.js Session Management 2025](https://clerk.com/articles/nextjs-session-management-solving-nextauth-persistence-issues)
- [NextAuth Errors Documentation](https://next-auth.js.org/errors)

### Database & Vercel Postgres
- [Vercel Connection Pooling Guide](https://vercel.com/kb/guide/connection-pooling-with-functions)
- [Serverless Database Connections Solved](https://vercel.com/blog/the-real-serverless-compute-to-database-connection-problem-solved)
- [PostgreSQL Adapter Documentation](https://authjs.dev/getting-started/adapters/pg)
- [Vercel Postgres Package](https://www.npmjs.com/package/@vercel/postgres)
- [Next.js Database Migration Discussion](https://github.com/vercel/next.js/discussions/59164)

### Middleware & Security
- [Next.js Middleware Auth & Edge Runtime](https://medium.com/@shuhan.chan08/authentication-in-next-js-middleware-edge-runtime-limitations-solutions-7692a44f47ab)
- [Better Auth Next.js Integration](https://www.better-auth.com/docs/integrations/next)
- [NextAuth Middleware Documentation](https://next-auth.js.org/configuration/nextjs)

### OAuth & Deployment
- [Google OAuth Callback Errors](https://github.com/nextauthjs/next-auth/issues/7964)
- [Redirect URI Mismatch Solutions](https://dennisbeemsterboer.medium.com/solving-the-redirect-uri-mismatch-and-try-signing-in-with-a-different-account-errors-with-81e2d4ff846b)
- [NextAuth Deployment Guide](https://next-auth.js.org/deployment)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)

### Auto-Save & Race Conditions
- [React Query Autosave & Race Conditions](https://pz.com.au/avoiding-race-conditions-and-data-loss-when-autosaving-in-react-query)
- [Optimistic Updates in Next.js](https://jb.desishub.com/blog/implementing-optimistic-update)
- [Frontend Masters: Autosaving Entries](https://frontendmasters.com/courses/fullstack-app-next-v3/autosaving-entries/)

### Schema & Foreign Keys
- [Auth.js WebAuthn Documentation](https://authjs.dev/getting-started/authentication/webauthn)
- [NextAuth Prisma Adapter](https://authjs.dev/getting-started/adapters/prisma)

---
*Pitfalls research for: Adding Auth + Database + History to Next.js YouTube Transcript Tool*
*Researched: 2026-02-17*
