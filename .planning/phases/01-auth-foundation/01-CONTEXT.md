# Phase 1: Auth Foundation - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can sign in with Google OAuth, stay authenticated across sessions, and sign out. Protected routes redirect unauthenticated users. The main transcript tool remains fully open without auth. This phase delivers auth infrastructure only -- no database, no transcript saving, no history UI.

</domain>

<decisions>
## Implementation Decisions

### Sign-in experience
- Sign-in button lives in the header/navbar, always visible top-right
- User stays on current page after signing in (no redirect away)
- Main transcript tool is fully open -- no auth required to paste URL and get transcript
- Signed-out users see a subtle hint near transcript output: "Sign in to save to history"

### Signed-in state
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

</decisions>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 01-auth-foundation*
*Context gathered: 2026-02-17*
