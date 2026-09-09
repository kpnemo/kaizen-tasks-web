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
