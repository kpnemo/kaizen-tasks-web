# ADR 0002: The API contract is copied into this repo, not linked

Status: accepted, 2026-09-08

## Context

The typed client is generated from the API's `openapi.json`. Reading the contract from the API
repo at build time (a git submodule, a workspace link, or a download during `npm ci`) would make
every web checkout depend on the backend's current state and network access, and a backend change
could break a frontend pull request that touched nothing related.

## Decision

`src/api/openapi.json` and the generated `src/api/types.ts` are committed. `scripts/pull-openapi.sh`
copies a chosen ref (or a local file) and regenerates the types; the result is reviewed like any
other change. CI compares the copy with the API's `develop` and prints a warning when it is behind;
it never fails the build. Docs-check Rule B fails a change that edits the contract without
regenerating the types.

## Consequences

- A checkout builds offline and deterministically.
- Contract updates are explicit commits with a diff a reviewer can read.
- The copy can lag; the CI warning and the `add-frontend-feature` skill's first step ("pull the
  contract if the API changed") keep the lag short.
- Model types are derived from `paths`, not from `components`, so the backend can rename schemas
  without breaking this repo.
