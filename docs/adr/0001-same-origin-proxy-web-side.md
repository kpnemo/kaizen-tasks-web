# ADR 0001: Same-origin API through the web service's Caddy proxy

Status: accepted, 2026-09-08

## Context

The API issues a refresh token in an httpOnly cookie and an access token in the response body. If
the browser talked to the API on its own domain, the cookie would be third-party, CORS would have
to be configured per environment, and the web build would need the API's URL at build time. The
PRD's decision D31 fixes same-origin transport; this ADR records the web side of it.

## Decision

The web service is a static Caddy site (`Caddyfile` at the repo root, served by Railpack) that
proxies `/api/*` to `http://api.railway.internal:3000` over Railway's private network. The app only
ever requests the relative path `/api/v1`. In development, Vite's proxy plays the same role against
the Prism mock or a local API. The web service pins `PORT=8080`; the API pins `PORT=3000`.

## Consequences

- No runtime configuration in the app, no CORS anywhere, first-party cookies.
- The API has no public domain; the web domain is the only entry point.
- `.railway/railway.ts` is a named partial that owns only `web`; the API repo's file owns `api`,
  `Postgres`, and `Redis`, so neither file can destroy the other's services.
- The proxy target is a fixed hostname and port. Changing the API's port is a change to this file
  and to the API's Railway variables.
- Verification item W1 (Railpack honoring the root Caddyfile) is confirmed on the first staging
  deploy; the fallback is a small Node server as the start command.

## Amendment 2026-09-09

`.railway/railway.ts`'s `web` service build command is `npm run build` only, not
`npm ci && npm run build`. Railpack already runs its own install step before the build command
and mounts `node_modules/.vite` as a build cache; a nested `npm ci` inside the build command
collides with that mount and fails with `EBUSY`. This was the root cause of three failed staging
builds. The API service was never affected: its own `.railway/railway.ts` build command is
`npm run build` already.

## Amendment 2026-09-09 (2)

The static `handle` block in `Caddyfile` had no explicit cache header for the SPA shell
(`index.html`), only for `/assets/*` (immutable) and `/version.json` (`no-store`). A stale cached
shell can reference hashed asset URLs from a prior build that no longer exist, and Caddy's `header`
directive runs before `try_files`/`rewrite` in its default directive order — so a matcher on
`/index.html` would never see a deep-link request like `/tasks/abc` that only becomes `/index.html`
after the SPA rewrite. The fix wraps `try_files` and the new `header /index.html Cache-Control
"no-cache"` in an explicit `route { ... }` block, which executes its sub-directives in the literal
order written instead of Caddy's default order, so the header directive evaluates after the
rewrite and applies to every path that falls through to the shell, not just a direct request for
`/index.html`. `/assets/*` stays `public, max-age=31536000, immutable` and `/version.json` stays
`no-store`, unchanged. Verified with `caddy adapt`/`caddy validate` and a local `caddy run` against
a built `dist/`: `GET /`, `GET /tasks/123` (the deep-link case) and a direct `GET /index.html` all
return `Cache-Control: no-cache`, while `/assets/*` and `/version.json` keep their existing headers.
