# ADR 0004: The footer prints the web and API versions from a build-time define and the health query

Status: accepted, 2026-09-09

## Context

The workshop owner wants the API and the web app to carry the same version number, and wants the
footer to print it so the room can see which release each environment runs and notice a
half-finished rollout. `GET /health` in the API now returns `data.version` (its `package.json`
version) next to `data.commit`. The web app needs its own version and commit available at runtime
without a network round trip, and needs the API's version and commit to compare against.

## Decision

The web version and a short commit are baked into the bundle at build time through Vite `define`
(`__APP_VERSION__`, `__APP_COMMIT__`), computed in `vite.config.ts` the same way
`scripts/write-version.mjs` resolves them (`RAILWAY_GIT_COMMIT_SHA`, else `git rev-parse HEAD`, else
`"local"`, never failing the config). The API's version and commit are read from the health query
already used for feature detection (`healthQueryOptions` in `src/api/health-query.ts`), so one
`GET /health` per session serves both the footer and feature availability. The footer prints both:
`v<web version> · web <sha> · api <sha>` when the versions match, and turns the API segment amber
with the API's own version when they differ. `dist/version.json` gains a `version` field alongside
`commit` and `builtAt`.

## Consequences

- One health request per session now serves both the footer and feature detection; no extra
  network cost for the version display.
- A version mismatch between the two apps is visible in the running app but not enforced by it —
  the app still functions with mismatched versions. The cross-repo smoke test enforces the match at
  promotion time.
- `src/api/health-query.ts` becomes the one place both the footer and `useFeatureRequestAvailable`
  read health from, so the query key and shape only need to change in one place.
- `vite.config.ts` and `vitest.config.ts` must agree on the defines (the latter merges the former),
  so both the app and its tests see the same `__APP_VERSION__` / `__APP_COMMIT__` values.
