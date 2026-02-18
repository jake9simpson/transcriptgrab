# Technology Stack

**Analysis Date:** 2026-02-17

## Languages

**Primary:**
- TypeScript 5.x - All application code and type definitions
- JavaScript (JSX/TSX) - React components and Next.js configuration
- CSS - Styling with Tailwind and custom CSS variables

**Secondary:**
- Bash - Build and deployment scripts

## Runtime

**Environment:**
- Node.js (version not explicitly specified in package.json, inferred from Next.js 16 requirements)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework with App Router, server components, and API routes
- React 19.2.3 - UI library for building components
- React DOM 19.2.3 - React rendering to DOM

**UI Component System:**
- shadcn/ui (v3.8.5) - Headless component library for pre-built accessible primitives
- Radix UI 1.4.3 - Foundation for shadcn/ui components
- Lucide React 0.574.0 - SVG icon library
- Tailwind CSS 4.x - Utility-first CSS framework with PostCSS integration
- Tailwind Merge 3.4.1 - Utility for merging Tailwind class names without conflicts
- Class Variance Authority 0.7.1 - Type-safe CSS class name composition
- clsx 2.1.1 - Utility for building conditional className strings
- tw-animate-css 1.4.0 - Animation utilities for Tailwind

**Testing:**
- Not configured in current setup

**Build/Dev:**
- TypeScript 5.x - Type checking and compilation
- ESLint 9.x - Code linting with Next.js preset
- PostCSS 4.x (via @tailwindcss/postcss) - CSS processing pipeline
- Turbopack - Next.js bundler (used in build)

## Key Dependencies

**Critical:**
- Next.js 16.1.6 - Full-stack framework, handles routing, API endpoints, server/client boundaries, build optimization
- React 19.2.3 - Component library and state management foundation
- shadcn/ui 3.8.5 - Provides accessible UI component primitives; project heavily depends on shadcn components in `components/ui/`

**Infrastructure:**
- Tailwind CSS 4.x - CSS framework for styling; includes PostCSS plugin for processing
- @tailwindcss/postcss 4.x - PostCSS plugin for Tailwind CSS v4
- ESLint 9.x with eslint-config-next - Code quality and consistency

## Configuration

**Environment:**
- Configured via `.env.local` (not committed, per `.gitignore`)
- `SUPADATA_API_KEY` - Required for YouTube transcript fallback on Vercel (must be set via `npx vercel env add` for production deployments)
- No other environment variables detected

**Build:**
- `tsconfig.json` - TypeScript configuration with moduleResolution "bundler", strict mode enabled, path alias `@/*` mapped to project root
- `next.config.ts` - Next.js configuration for remote image patterns (allows `i.ytimg.com` and `*.ytimg.com`)
- `postcss.config.mjs` - PostCSS pipeline for Tailwind CSS v4
- `eslint.config.mjs` - ESLint configuration with Next.js preset
- `components.json` - shadcn/ui configuration

## Platform Requirements

**Development:**
- Node.js (modern LTS version recommended, given Next.js 16 requirement)
- npm for dependency management
- macOS, Linux, or Windows with bash/zsh terminal

**Production:**
- Vercel (preferred deployment target as documented in CLAUDE.md)
- Node.js 18+ runtime (Vercel default)
- Environment variable `SUPADATA_API_KEY` must be configured on Vercel via `npx vercel env add`

---

*Stack analysis: 2026-02-17*
