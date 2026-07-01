# Sentry Setup Documentation

- **Date**: 2026-06-02
- **Status**: Complete
- **Roadmap Item**: P0-1: Sentry Error Tracking Setup

## Summary

Sentry has been integrated into the Teamfair React SPA for error monitoring, performance tracing, session replay, and source map uploads. 

## Files Changed/Created

- **Created**:
  - [src/instrument.ts](file:///d:/Python/Projects/Teamfair/src/instrument.ts) — Sentry initialization configuration.
  - [src/components/SentryErrorBoundaryFallback.tsx](file:///d:/Python/Projects/Teamfair/src/components/SentryErrorBoundaryFallback.tsx) — Premium fallback UI for component crashes.
- **Modified**:
  - [src/main.tsx](file:///d:/Python/Projects/Teamfair/src/main.tsx) — Added sidecar import.
  - [src/App.tsx](file:///d:/Python/Projects/Teamfair/src/App.tsx) — Wrapped application in Sentry's ErrorBoundary.
  - [vite.config.ts](file:///d:/Python/Projects/Teamfair/vite.config.ts) — Added Sentry Vite plugin and configured build sourcemaps.
  - [package.json](file:///d:/Python/Projects/Teamfair/package.json) — Installed `@sentry/react` and `@sentry/vite-plugin`.
  - `pnpm-lock.yaml` — Dependency lockfile.

## Environment Variables

The user must manually add these to their local `.env` and production settings:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_SENTRY_DSN` | Client (Vite) | DSN for client-side error reporting |
| `SENTRY_AUTH_TOKEN` | Build-time (Vercel) | Auth token for uploading sourcemaps to Sentry |
| `SENTRY_ORG` | Build-time (Vercel) | Sentry Organization slug (defaults to `teamfair`) |
| `SENTRY_PROJECT` | Build-time (Vercel) | Sentry Project slug (defaults to `teamfair-react`) |

## Setup Design Decisions

1. **Dedicated Initialization Sidecar (`instrument.ts`)**: Initializes Sentry before any other code runs in the bundle.
2. **Graceful Failures**: Sentry is dynamically disabled locally if `VITE_SENTRY_DSN` is empty. Similarly, source map uploads in `vite.config.ts` are skipped if `SENTRY_AUTH_TOKEN` is missing, preventing build failure.
3. **Session Replay & Tracing**: Enabled with default settings of 10% replay session rate (100% on error) and 100% trace sample rate in dev (10% in prod).
