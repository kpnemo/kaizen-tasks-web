# CLAUDE.md

Kaizen Tasks Web: the React app for Kaizen Tasks, where an AI assistant breaks big tasks into small
steps and the person stays in control. Vite 7, React 19, TypeScript strict, Tailwind 4, shadcn/ui,
TanStack Query, react-router 7. `README.md` explains how to run it; `docs/ARCHITECTURE.md` explains
how it is shaped.

## Layers and import rules

| Folder                   | Holds                                                                          | May import                          |
| ------------------------ | ------------------------------------------------------------------------------ | ----------------------------------- |
| `src/app/`               | router, layout, guards                                                         | everything                          |
| `src/features/<domain>/` | pages, components, hooks, tests for one domain                                 | `api`, `components`, `lib`, itself  |
| `src/components/`        | shadcn (`ui/`) and hand-written shared pieces                                  | `api`, `lib`, `components/ui`       |
| `src/api/`               | contract copy, generated types, models, client, auth store, shared tag queries | `components/api-error-toast`, `lib` |
| `src/lib/`               | pure helpers                                                                   | nothing above it                    |

A feature never imports another feature. ESLint enforces the feature rule; the `reviewer` agent
checks the rest.

## Rules that do not bend

- Every request goes through `src/api/client.ts`, typed from `src/api/openapi.json`. The app cannot
  call a route the contract lacks. Pull with `npm run api:pull`; never hand-edit `openapi.json` or
  `types.ts`. Model types derive from `paths` in `src/api/models.ts`.
- Server state is TanStack Query through hooks in `<domain>/hooks.ts`; there is no global state
  library.
- The access token lives in `src/api/auth-store.ts` in memory only (ADR 0003). A 401 is handled by
  the client middleware: one refresh, one replay, then logout.
- Every user-visible error is an `ApiError` rendered through `toastApiError` or a field error.
- Requests use the relative `/api/v1` on the page origin. No absolute API origin exists (ADR 0001).
- Every feature ships a happy-path test and an error-state test (Vitest, Testing Library, MSW).
- Projector rules: 18px base, 44px hit areas, visible focus ring, no hover-only control.
- The smoke test's accessible names (`README.md`, "Selector contract") are a cross-repo contract.

## Every feature change follows the `add-frontend-feature` skill

Restate the criteria, pull the contract if the API changed, failing test, feature folder, hook,
route and nav, green, docs, `npm run docs:check`.

## Docs are part of every change

`CHANGELOG.md` `[Unreleased]` bullet for any change under `src/`, `scripts/`, `.railway/`,
`Caddyfile`, `package.json`, `vite.config.ts`, or `index.html`; regenerated `src/api/types.ts` when
`openapi.json` changes; an ADR (`write-adr` skill) when an architectural file changes.
`scripts/docs-check.sh` enforces this as the Stop hook (exit 2 blocks; after three blocks it prints
`DOCS CHECK FAILED, human intervention required` and CI still fails) and in CI. Rule D also
regenerates `docs/product-map.md` on every run and fails on any difference, so run
`npm run product-map` and commit the file with the change (ADR 0007).

## Architectural files (docs/architectural-files.txt)

`src/api/**`, `Caddyfile`, `.railway/**`, `src/app/router.tsx`, `src/main.tsx`.

## Harness

Skills: `add-frontend-feature`, `write-adr`, `release-notes`. Agents: `reviewer` (read-only
conventions check, PASS or violations), `test-writer` (failing tests from criteria). Hooks
(`.claude/settings.json`): Stop runs docs-check; PostToolUse on Edit or Write runs prettier.

## Scripts

| Script       | Does                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| `dev`        | Vite with the `/api` proxy (`VITE_PROXY_TARGET`, default the Prism mock on 4010) |
| `build`      | `vite build` then `dist/version.json`                                            |
| `preview`    | serve `dist/`                                                                    |
| `test`       | Vitest                                                                           |
| `lint`       | ESLint + Prettier check                                                          |
| `typecheck`  | `tsc --noEmit`                                                                   |
| `mock`       | Prism mock with curated examples                                                 |
| `api:pull`   | copy the contract and regenerate types (`-- --local <path>`, `-- <ref> --check`) |
| `api:types`  | regenerate `src/api/types.ts`                                                    |
| `docs:check` | the docs gate in hook mode                                                       |

## Local setup

`nvm use && npm ci`, then `npm run mock` and `npm run dev` (no backend), or
`VITE_PROXY_TARGET=http://localhost:3000 npm run dev` against the API. Node 24 only.
