# ADR 0008: The requests list is read through the typed client, never from GitHub in the browser

Status: accepted, 2026-09-11

## Context

Issue #22 puts a "Requests so far" list on the Request page: every feature request filed to the
harness repository, with its stage and readiness. The data lives in GitHub. Reading it from the
browser would need either a token in the bundle or GitHub's unauthenticated limit of sixty calls an
hour shared by the whole room, and it would put the label-to-stage rule in two places. The API
already holds a GitHub token to file requests and already exposes the feature behind
`features.featureRequests`.

## Decision

The API adds `GET /feature-requests` and owns the stage and readiness derivation. This repo pulls
that contract (`npm run api:pull -- --local ../backend/openapi.json`), regenerates `src/api/types.ts`,
and reads the list only through `client.GET("/feature-requests")` in
`src/features/feature-request/hooks.ts` (`useFeatureRequests`, key `["feature-request", "list"]`).
The web derives nothing about stages; it renders what the API says.

## Consequences

- `src/api/openapi.json` and `src/api/types.ts` change with the contract, which is why this ADR
  exists (docs-check Rule C).
- The submit mutation invalidates the list key on success, so a filed request appears without a
  reload; one more query per visit to the Request page.
- The list is only as fresh as the API's two GitHub calls per request; there is no cache in this
  change (the pipeline page adds one later).
- A GitHub outage shows as an alert inside the section; the interview and the form keep working.
