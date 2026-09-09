# ADR 0003: The access token lives in memory only

Status: accepted, 2026-09-08

## Context

The API issues a 15-minute JWT access token and a 7-day refresh token. The refresh token is an
httpOnly cookie the page cannot read. The access token has to be sent as a bearer header, so the
app holds it somewhere. `localStorage` and `sessionStorage` survive reloads but are readable by any
script on the page; a non-httpOnly cookie has the same exposure.

## Decision

`src/api/auth-store.ts` keeps the access token in a module variable with a subscription for React.
Nothing writes it to web storage or cookies. On load, `AuthProvider` obtains a fresh access token
through `POST /auth/refresh`; on a 401 the client middleware refreshes once and replays the request.

## Consequences

- A reload costs one refresh round trip, hidden behind a neutral "restoring" screen.
- Multiple tabs each hold their own token; the refresh cookie rotates on each refresh, which the
  API tolerates because every tab's refresh succeeds against the current cookie.
- The `reviewer` agent and a unit test assert that web storage stays empty.
