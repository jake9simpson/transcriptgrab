# Phase 1: Auth Foundation - Research

**Researched:** 2026-02-17
**Domain:** Google OAuth authentication with Auth.js (NextAuth.js v5) in Next.js 16
**Confidence:** HIGH

## Summary

Auth.js v5 (the next-auth@beta package) is the standard, well-documented auth solution for Next.js App Router applications. It provides a unified configuration pattern from a root `auth.ts` file that exports `auth`, `handlers`, `signIn`, and `signOut` functions usable across server components, client components, API routes, and the proxy layer. Google OAuth is a first-class provider with auto-detected environment variables (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`).

The JWT session strategy (default when no database adapter is configured) stores an encrypted token in an HttpOnly cookie, which persists across page refreshes and browser restarts without any database. This aligns perfectly with Phase 1's scope: auth infrastructure only, no database. When Phase 2 adds Vercel Postgres, the adapter can be plugged in and the session strategy switched to `"database"` with minimal refactoring.

The existing codebase uses Next.js 16.1.6 with App Router, shadcn/ui (new-york style), and a dark-themed layout with a sticky header. The header currently has the app title on the left and a ThemeToggle button on the right. Auth UI (sign-in button, avatar dropdown) will be added to this header alongside the existing ThemeToggle.

**Primary recommendation:** Use `next-auth@beta` (Auth.js v5) with JWT sessions, the Google provider, `proxy.ts` for session freshness, and shadcn/ui Avatar + DropdownMenu for the signed-in user menu.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Sign-in experience
- Sign-in button lives in the header/navbar, always visible top-right
- User stays on current page after signing in (no redirect away)
- Main transcript tool is fully open -- no auth required to paste URL and get transcript
- Signed-out users see a subtle hint near transcript output: "Sign in to save to history"

#### Signed-in state
- Avatar with dropdown menu (click profile picture to expand)
- Dropdown contains: History link, Settings link, Sign out button
- Dropdown shows user name and email

### Claude's Discretion
- Google OAuth flow method (popup vs redirect) -- pick what works best with the stack
- Sign-in button branding -- match the app's existing dark theme or use Google's branded button, whichever fits
- Dropdown menu items visibility in Phase 1 -- whether to show History/Settings as disabled placeholders or only show Sign out until those features exist
- Header layout when signed in -- avatar-only swap vs avatar plus visible History shortcut
- Protected route handling -- redirect to home vs show auth gate page at the URL
- Post-sign-in return behavior from protected routes
- Sign-out confirmation (if any)
- Post-sign-out landing page
- Auth error display pattern (toast vs inline)
- Loading state during auth flow
- Exact avatar size, dropdown positioning, and animation

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can sign in with Google OAuth | Auth.js v5 Google provider with `signIn("google")` client-side call; redirect flow (standard for Next.js); callback URL at `/api/auth/callback/google` |
| AUTH-02 | User can sign out from any page | Client-side `signOut()` from `next-auth/react` in the avatar dropdown menu; works from any page because the dropdown is in the root layout header |
| AUTH-03 | User session persists across page refreshes and browser restarts | JWT strategy stores encrypted session in HttpOnly cookie; `proxy.ts` keeps the session token fresh; 30-day default maxAge |
| AUTH-04 | Auth state shown in UI (signed-in user info or sign-in button) | `useSession()` hook in a client component wrapping the header auth section; conditionally renders sign-in button or Avatar+DropdownMenu |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | 5.x (beta) | Auth.js v5 for Next.js -- handles OAuth flow, session management, route handlers | Official auth solution for Next.js; maintained by Vercel-adjacent team; 1400+ code examples in Context7; first-class Next.js App Router support |
| next-auth/providers/google | (bundled) | Google OAuth provider configuration | Built-in provider with auto-detected env vars; handles token exchange, profile fetching |
| next-auth/react | (bundled) | Client-side hooks and functions (`useSession`, `signIn`, `signOut`, `SessionProvider`) | Required for client components to access auth state |

### Supporting (shadcn/ui components to add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @/components/ui/avatar | (shadcn) | Round user profile image with fallback initials | Signed-in state: header avatar trigger for dropdown |
| @/components/ui/dropdown-menu | (shadcn) | Accessible dropdown menu with labels, items, separators | Signed-in state: user menu with name/email, links, sign out |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Auth.js v5 (next-auth@beta) | Clerk, Auth0, Supabase Auth | Third-party hosted services add vendor lock-in and cost; Auth.js is free, open-source, and we control the data |
| Auth.js v5 (next-auth@beta) | Better Auth | Newer library (less battle-tested); Auth.js has far more community support and documentation |
| JWT sessions | Database sessions | Database sessions require a DB (Phase 2 dependency); JWT works without a database, perfect for Phase 1 isolation |

**Installation:**
```bash
npm install next-auth@beta
npx shadcn@latest add avatar dropdown-menu
```

## Architecture Patterns

### Recommended Project Structure
```
auth.ts                              # Root auth config (exports auth, handlers, signIn, signOut)
proxy.ts                             # Session freshness proxy (Next.js 16 pattern)
app/
├── api/auth/[...nextauth]/route.ts  # Auth.js route handler (GET + POST)
├── layout.tsx                       # Root layout (wraps children in SessionProvider via Providers component)
├── page.tsx                         # Main transcript tool (open, no auth required)
├── history/page.tsx                 # Protected route (placeholder for Phase 4)
components/
├── Providers.tsx                    # "use client" wrapper for SessionProvider
├── AuthButton.tsx                   # Conditional: sign-in button OR avatar dropdown
├── UserMenu.tsx                     # Avatar + DropdownMenu for signed-in users
├── SignInHint.tsx                   # Subtle "Sign in to save to history" hint
lib/
├── auth-helpers.ts                  # (optional) shared auth utility functions
```

### Pattern 1: Root Auth Configuration
**What:** Single `auth.ts` file at project root exports all auth primitives.
**When to use:** Always -- this is the Auth.js v5 canonical pattern.
**Example:**
```typescript
// auth.ts
// Source: https://authjs.dev/getting-started/installation
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      return session
    },
  },
})
```

### Pattern 2: Route Handler (Catch-All)
**What:** API route that handles all Auth.js requests (sign-in, callback, sign-out, session).
**When to use:** Required -- must exist for Auth.js to function.
**Example:**
```typescript
// app/api/auth/[...nextauth]/route.ts
// Source: https://authjs.dev/getting-started/installation
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```

### Pattern 3: Proxy for Session Freshness (Next.js 16)
**What:** `proxy.ts` replaces `middleware.ts` in Next.js 16. Keeps session cookies fresh and optionally protects routes.
**When to use:** Always for Next.js 16 -- named `proxy.ts` with `proxy` export.
**Example:**
```typescript
// proxy.ts
// Source: https://authjs.dev/getting-started/session-management/protecting
import { auth } from "@/auth"

export const proxy = auth((req) => {
  // Protected routes: redirect unauthenticated users to home
  const protectedPaths = ["/history", "/settings"]
  const isProtected = protectedPaths.some((p) => req.nextUrl.pathname.startsWith(p))

  if (isProtected && !req.auth) {
    return Response.redirect(new URL("/", req.nextUrl.origin))
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

### Pattern 4: SessionProvider Wrapper for App Router
**What:** Client component that wraps children in SessionProvider, imported into root layout.
**When to use:** Required for any client component that uses `useSession()`.
**Example:**
```typescript
// components/Providers.tsx
"use client"
import { SessionProvider } from "next-auth/react"

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

```typescript
// app/layout.tsx (modified)
import Providers from "@/components/Providers"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* ... head ... */}
      <body>
        <Providers>
          {/* header and main content */}
        </Providers>
      </body>
    </html>
  )
}
```

### Pattern 5: Client-Side Auth Button with useSession
**What:** Conditionally renders sign-in button or user avatar based on session state.
**When to use:** In the header, to satisfy AUTH-04.
**Example:**
```typescript
// components/AuthButton.tsx
"use client"
import { useSession, signIn, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function AuthButton() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
  }

  if (!session) {
    return (
      <Button variant="outline" size="sm" onClick={() => signIn("google")}>
        Sign in
      </Button>
    )
  }

  const initials = session.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={session.user?.image ?? ""} alt={session.user?.name ?? ""} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{session.user?.name}</p>
            <p className="text-xs text-muted-foreground">{session.user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>History</DropdownMenuItem>
        <DropdownMenuItem disabled>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Pattern 6: Server-Side Session Check in Protected Pages
**What:** Use `auth()` in server components to check session before rendering.
**When to use:** Protected pages like /history.
**Example:**
```typescript
// app/history/page.tsx
// Source: https://authjs.dev/getting-started/session-management/protecting
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function HistoryPage() {
  const session = await auth()
  if (!session) redirect("/")

  return <div>History page placeholder (Phase 4)</div>
}
```

### Anti-Patterns to Avoid
- **Custom JWT implementation:** Auth.js handles token creation, encryption, rotation, and cookie management. Never hand-roll JWT logic.
- **Storing session data in localStorage:** Auth.js uses HttpOnly cookies (not accessible to JavaScript). Duplicating session to localStorage creates a stale data source and XSS vulnerability.
- **Calling `auth()` in proxy.ts for database lookups:** Proxy runs on every matched request. Keep it lightweight -- check cookie existence or JWT validity only, never hit a database.
- **Putting SessionProvider in a server component:** SessionProvider is a client component. Create a separate `"use client"` Providers wrapper component and import it into layout.tsx.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth flow (PKCE, token exchange, callback handling) | Custom fetch to Google OAuth endpoints | `next-auth/providers/google` | OAuth has dozens of edge cases (CSRF, state validation, nonce); Auth.js handles all of them |
| Session cookies (creation, encryption, rotation) | Custom cookie management with jose/jsonwebtoken | Auth.js JWT strategy | Auth.js encrypts with JWE, handles cookie chunking (>4KB), manages HttpOnly/Secure flags |
| Route protection | Custom middleware checking cookies | `proxy.ts` with Auth.js `auth()` wrapper | Consistent auth check across all routes, handles edge cases like expired tokens |
| Sign-in/sign-out UI flows | Custom redirect chains | `signIn("google")` / `signOut()` from next-auth/react | Handles redirect, callback, error states; `redirectTo` option controls post-auth destination |
| Session refresh | Custom token rotation logic | Auth.js `proxy.ts` auto-refresh | Proxy keeps session cookie fresh on every matched request automatically |

**Key insight:** OAuth authentication has extraordinary surface area for security bugs. The entire point of using Auth.js is to avoid implementing any of these flows manually.

## Common Pitfalls

### Pitfall 1: Missing AUTH_SECRET
**What goes wrong:** App crashes or sessions fail silently.
**Why it happens:** AUTH_SECRET is required but easy to forget, especially when deploying to Vercel.
**How to avoid:** Generate with `npx auth secret` locally. Add to Vercel with `npx vercel env add AUTH_SECRET`. Must be the same value in all environments.
**Warning signs:** "JWE decryption failed" errors, sessions not persisting.

### Pitfall 2: Google OAuth Callback URL Mismatch
**What goes wrong:** Google returns an error after user approves consent screen.
**Why it happens:** The authorized redirect URI in Google Cloud Console doesn't match the actual callback URL.
**How to avoid:** Add both `http://localhost:3000/api/auth/callback/google` (dev) and `https://yourdomain.com/api/auth/callback/google` (prod) to Google Cloud Console. The path is always `/api/auth/callback/google` for Next.js.
**Warning signs:** "redirect_uri_mismatch" error from Google, or "OAuthCallbackError" in Auth.js.

### Pitfall 3: SessionProvider Not Wrapping Client Components
**What goes wrong:** `useSession()` returns undefined or throws "must be wrapped in SessionProvider".
**Why it happens:** App Router layout.tsx is a server component -- you can't use SessionProvider directly in it.
**How to avoid:** Create a `components/Providers.tsx` marked `"use client"` that wraps children in SessionProvider. Import this into layout.tsx.
**Warning signs:** Runtime error about SessionProvider context, session always null on client.

### Pitfall 4: Naming proxy.ts as middleware.ts in Next.js 16
**What goes wrong:** Proxy doesn't execute, routes aren't protected, sessions don't stay fresh.
**Why it happens:** Next.js 16 renamed the file from `middleware.ts` to `proxy.ts` and the export from `middleware` to `proxy`.
**How to avoid:** Use `proxy.ts` at the project root with `export const proxy` or `export { auth as proxy }`.
**Warning signs:** Console warnings about unrecognized middleware file, proxy code never executing.

### Pitfall 5: Blocking Proxy with Database Calls
**What goes wrong:** Every page request becomes slow because the proxy hits the database.
**Why it happens:** Developers put heavy auth logic (database lookups, role checks) in proxy.ts.
**How to avoid:** Proxy should only check cookie/JWT existence. Do database-level checks in server components or API routes.
**Warning signs:** Slow page loads on every navigation, even for public pages.

### Pitfall 6: Google Only Provides Refresh Token on First Sign-In
**What goes wrong:** After the first successful sign-in, subsequent sign-ins don't return a refresh token from Google.
**Why it happens:** Google only sends the refresh token on the first consent. If you need it reliably, you must set `prompt: "consent"` and `access_type: "offline"`.
**How to avoid:** For Phase 1 with JWT sessions and no database, this is not an issue -- we don't need refresh tokens. It becomes relevant in Phase 2+ when using database sessions. For now, the simple `Google` provider without extra params is sufficient.
**Warning signs:** Missing refresh_token in the account record after re-authentication.

## Code Examples

Verified patterns from official sources:

### Environment Variables (.env.local)
```bash
# Source: https://authjs.dev/getting-started/installation
# Generate with: npx auth secret
AUTH_SECRET="your-generated-secret-here"

# Source: https://authjs.dev/getting-started/providers/google
# Auto-detected by Auth.js -- no manual config in auth.ts needed
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
```

### Client-Side Sign-In with Provider
```typescript
// Source: https://authjs.dev/getting-started/session-management/login
"use client"
import { signIn } from "next-auth/react"

// Redirect flow (standard for Next.js)
// User leaves page, completes Google consent, returns to same page
signIn("google")

// With explicit redirect target
signIn("google", { redirectTo: "/dashboard" })
```

### Client-Side Sign-Out
```typescript
// Source: https://authjs.dev/getting-started/session-management/login
"use client"
import { signOut } from "next-auth/react"

// Signs out and redirects to current page
signOut()
```

### Server-Side Session Access
```typescript
// Source: https://authjs.dev/getting-started/session-management/get-session
import { auth } from "@/auth"

export default async function ServerComponent() {
  const session = await auth()
  // session?.user contains: name, email, image
}
```

### Protected API Route
```typescript
// Source: https://authjs.dev/getting-started/session-management/protecting
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export const GET = auth(function GET(req) {
  if (req.auth) return NextResponse.json(req.auth)
  return NextResponse.json({ message: "Not authenticated" }, { status: 401 })
})
```

## Discretion Recommendations

For each area marked as Claude's Discretion, here are research-backed recommendations:

### OAuth Flow: Redirect (not popup)
**Recommendation:** Use redirect flow (the default `signIn("google")` behavior).
**Rationale:** Auth.js v5 uses server-side redirect flow by default. Popup flows require custom implementation, create popup-blocker issues, and add complexity. The redirect flow is the path of least resistance with Auth.js.

### Sign-in Button Branding: Match the App Theme
**Recommendation:** Use a simple `<Button variant="outline" size="sm">Sign in</Button>` styled with the app's existing design system, not Google's branded button.
**Rationale:** The app has a cohesive dark theme with shadcn/ui components. Google's branded button (specific colors, logo, padding) would look jarring. A themed button with text "Sign in with Google" or just "Sign in" keeps visual consistency. The redirect to Google's consent screen makes the provider clear enough.

### Dropdown Menu Items: Show History/Settings as Disabled
**Recommendation:** Show History and Settings as disabled (grayed-out) menu items in Phase 1.
**Rationale:** Users can see the features are coming. It sets expectations and makes the dropdown look intentional rather than sparse. The `disabled` prop on DropdownMenuItem handles this natively.

### Header Layout: Avatar-Only Swap
**Recommendation:** Swap the sign-in button for just the avatar when signed in. No extra History shortcut in the header.
**Rationale:** Keeps the header clean and minimal. History is accessible from the avatar dropdown. Adding a visible History shortcut creates visual clutter and will need rethinking when more features are added.

### Protected Route Handling: Redirect to Home
**Recommendation:** Redirect unauthenticated users to `/` (home page) when they try to access protected routes like `/history`.
**Rationale:** The app doesn't have a dedicated login page, so redirecting to a login URL doesn't make sense. Home is where the sign-in button is visible. The proxy handles this check before the page renders.

### Post-Sign-In Return: Stay on Current Page
**Recommendation:** Auth.js default behavior -- user returns to the page they signed in from. No custom `redirectTo` needed.
**Rationale:** This is a locked decision ("User stays on current page after signing in") and it's also Auth.js's default behavior. No extra work required.

### Sign-Out Confirmation: None
**Recommendation:** No confirmation dialog. Click "Sign out" and it happens immediately.
**Rationale:** Sign-out is not destructive (data is still in the database). Adding a confirmation adds friction. The user can sign back in instantly.

### Post-Sign-Out Landing: Stay on Current Page
**Recommendation:** User lands on the same page after sign-out. The header updates to show the sign-in button.
**Rationale:** Consistent with the sign-in behavior. The transcript tool works without auth, so the user can keep working.

### Auth Error Display: Inline in Header Area
**Recommendation:** Use a toast notification for auth errors (sign-in failures, session expiry).
**Rationale:** Auth errors are transient and shouldn't block the page. A toast appears briefly and auto-dismisses. This requires adding the shadcn/ui Sonner (toast) component. Alternatively, if toast infrastructure feels heavy for Phase 1, a simple inline error message near the sign-in button that disappears after a few seconds works too.

### Loading State: Skeleton Circle
**Recommendation:** Show a pulsing skeleton circle (same size as avatar) while auth status is loading.
**Rationale:** Prevents layout shift between the sign-in button and avatar. The `useSession()` hook returns `status: "loading"` initially; render a skeleton during this state.

### Avatar Size and Dropdown: 32px Avatar, End-Aligned Dropdown
**Recommendation:** 32px (h-8 w-8) avatar matching the existing icon button sizes. Dropdown aligned to the right edge (`align="end"`).
**Rationale:** ThemeToggle uses `size="icon"` which is roughly 36px. A 32px avatar sits cleanly beside it. End-alignment prevents the dropdown from overflowing the viewport on the right side.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-auth` v4 with route-based config | `next-auth@beta` v5 with root `auth.ts` | 2024 | Single config file, cleaner exports |
| `middleware.ts` with `export { auth as middleware }` | `proxy.ts` with `export { auth as proxy }` | Next.js 16 (2025) | File and export renamed |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` env vars | `AUTH_URL`, `AUTH_SECRET` env vars | Auth.js v5 | All vars use `AUTH_` prefix |
| `next-auth/next` import for `getServerSession` | `auth()` exported from root `auth.ts` | Auth.js v5 | No separate import; unified interface |
| Cookie prefix `next-auth` | Cookie prefix `authjs` | Auth.js v5 | Breaking change for existing sessions |

**Deprecated/outdated:**
- `next-auth/middleware` import: Replaced by `proxy.ts` pattern
- `getServerSession(req, res, authOptions)`: Replaced by `auth()` from root config
- `NEXTAUTH_URL` env var: Replaced by `AUTH_URL` (auto-detected in most cases)
- `pages` option for custom sign-in pages: Still works but the default Auth.js pages are sufficient for Phase 1

## Open Questions

1. **next-auth@beta stability for production**
   - What we know: Auth.js v5 has been in beta since early 2024, widely used in production, and the Auth.js docs exclusively document v5.
   - What's unclear: Whether there's a stable v5 release yet or if `@beta` is still the install tag.
   - Recommendation: Use `next-auth@beta` as documented. The beta label reflects naming convention, not instability. The entire Auth.js ecosystem has moved to v5.

2. **Next.js 16 proxy.ts full compatibility verification**
   - What we know: Auth.js docs reference `proxy.ts` for Next.js 16. Context7 shows the pattern. Multiple sources confirm the rename.
   - What's unclear: Whether there are any edge-case incompatibilities with Next.js 16.1.6 specifically.
   - Recommendation: Proceed with `proxy.ts`. If issues arise during implementation, falling back to `middleware.ts` is a one-line change (rename file, rename export).

3. **Google Cloud Console project setup**
   - What we know: Need OAuth 2.0 Client ID credentials, authorized redirect URIs for both localhost and production.
   - What's unclear: Whether the user already has a Google Cloud project for this app.
   - Recommendation: Document the setup steps in the plan. The user will need to create credentials in Google Cloud Console and add the redirect URIs.

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/authjs_dev` (2786 snippets, benchmark 87.4) - Auth.js configuration, Google provider, session management, route protection, sign-in/sign-out patterns
- Context7 `/nextauthjs/next-auth` (1418 snippets, benchmark 91.8) - Auth.js v5 setup, middleware/proxy patterns, JWT/session callbacks
- [Auth.js Installation Guide](https://authjs.dev/getting-started/installation) - Package install, auth.ts setup, route handler, proxy.ts
- [Auth.js Google Provider](https://authjs.dev/getting-started/providers/google) - Environment variable naming, callback URL format, provider config
- [Auth.js Session Protection](https://authjs.dev/getting-started/session-management/protecting) - Server-side auth(), client-side useSession, proxy.ts route protection
- [Auth.js Session Retrieval](https://authjs.dev/getting-started/session-management/get-session) - Server and client session access patterns
- [Auth.js Login/Logout](https://authjs.dev/getting-started/session-management/login) - signIn/signOut with provider and redirectTo options
- [Auth.js Migration v5](https://authjs.dev/getting-started/migrating-to-v5) - Breaking changes, env var naming, proxy.ts rename
- [Auth.js Environment Variables](https://authjs.dev/guides/environment-variables) - AUTO_GOOGLE_ID/SECRET auto-detection
- [shadcn/ui Dropdown Menu](https://ui.shadcn.com/docs/components/dropdown-menu) - Installation, component API
- [shadcn/ui Avatar](https://ui.shadcn.com/docs/components/avatar) - Installation, component API

### Secondary (MEDIUM confidence)
- [Auth.js Session Strategies](https://authjs.dev/concepts/session-strategies) - JWT vs database session, cookie encryption, HttpOnly details
- [Next.js 16 Auth Changes (Auth0 blog)](https://auth0.com/blog/whats-new-nextjs-16/) - proxy.ts rename confirmation
- [Google OAuth 2.0 Setup](https://support.google.com/cloud/answer/6158849) - Cloud Console credentials setup, redirect URI requirements
- [Sentry: SessionProvider App Router Pattern](https://sentry.io/answers/next-js-13-and-next-auth-issues-with-usesession-and-sessionprovider/) - Client component wrapper pattern verification

### Tertiary (LOW confidence)
- [npm next-auth](https://www.npmjs.com/package/next-auth) - Stable v4.24.13, beta v5.x; exact latest beta version unverified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Auth.js v5 is extensively documented in Context7 (4000+ snippets across two library IDs) and official docs; Google provider is a first-class integration
- Architecture: HIGH - Patterns verified across Context7, official Auth.js docs, and migration guide; proxy.ts pattern confirmed for Next.js 16
- Pitfalls: HIGH - Common issues well-documented in official migration guide and community discussions; verified against multiple sources
- Discretion recommendations: MEDIUM - Based on standard patterns and UX conventions; some are judgment calls that should be validated during implementation

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days -- Auth.js v5 is stable in API surface; Next.js 16 is current)
