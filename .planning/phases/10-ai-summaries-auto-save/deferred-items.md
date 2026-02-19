# Deferred Items - Phase 10

## Pre-existing Build Error

**File:** `extension/entrypoints/background/auth.ts:1`
**Error:** `Cannot find module '@/utils/constants' or its corresponding type declarations`
**Context:** The extension uses WXT path aliases (`@/utils/constants`) that Next.js TypeScript checking does not resolve. This is a pre-existing issue unrelated to Phase 10 changes. The extension builds separately via WXT.
**Discovered during:** Plan 10-01, Task 1 verification
