# CLAUDE.md

Kaizen Tasks Web: React 19 + Vite 7 + TypeScript strict. Read `README.md` first.

## Conventions

- Feature folders under `src/features/<domain>/` hold pages, components, hooks, and tests for that domain. Shared primitives live in `src/components/ui/` (shadcn). `src/lib/` holds pure helpers.
- Import rules: `features/*` import from `api`, `components/ui`, `lib`, and their own folder, never from another feature. `app/` composes features. `api/` imports nothing from `features`. ESLint enforces the feature rule.
- Server state is TanStack Query through hooks in `features/<domain>/hooks.ts`. No global state library. The access token lives in `src/api/auth-store.ts` in memory only.
- Every request goes through `src/api/client.ts`, typed from `src/api/openapi.json`. The app cannot call an endpoint the contract does not describe. Pull a new contract with `npm run api:pull`, never edit `openapi.json` or `types.ts` by hand.
- Every user-visible error comes from `ApiError` through the shared toast or a field error.
- Tests first: a failing component test, then the implementation. Every feature has a happy-path test and an error-state test.

## Docs are part of every change

`CHANGELOG.md` `[Unreleased]` bullet for any change under `src/`; regenerated `src/api/types.ts` when `openapi.json` changes; an ADR under `docs/adr/` when an architectural file changes. `scripts/docs-check.sh` enforces this as the Stop hook and in CI (added in a later task).

## Architectural files

Listed in `docs/architectural-files.txt` (added with the docs-check task).

## Scripts

See the table in `README.md`.
