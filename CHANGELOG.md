# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Vite 7 + React 19 + TypeScript scaffold with Vitest, Testing Library, and MSW.
- Kaizen theme on Tailwind 4 and shadcn/ui: indigo accent, Fraunces display face, Atkinson Hyperlegible body, 18px base.
- Typed API client with in-memory access token and 401 refresh-and-replay middleware.
- App shell, router, and auth guards.
- `dist/version.json` writer, Caddy production config, Railway web service declaration.
- CI workflow `ci`.
- Contract pull script (`scripts/pull-openapi.sh`) with `--local` and `--check` modes; full contract copy and generated types; contract drift warning in CI.
- Prism mock with curated contract examples; the mock artifact mounts the contract's servers base path so `/api/v1/*` resolves.
- Login and registration pages, session restore on load, logout; one toast per API error code.
- Task list: create bar, filters, AI chips for every state, retry, keyset load more, polling.
- Task detail with inline editing, suggested steps, rationale popover, accept/edit/dismiss/undo.
- AI banner (thinking, failed with retry, skipped with reason), regenerate with conflict handling, bulk accept and dismiss, detail polling.
- Step reorder with dnd-kit (target index, optimistic with rollback) and add step.
- Add-tag popover and AI tag suggestion adoption on the task detail; shared tag mutations.
- Tags page with palette, inline rename and recolor, and confirmed delete.
- Request-a-feature page; the nav link and route are shown only when `GET /health` reports `features.featureRequests` true.
- Architecture doc and ADRs 0001 to 0003; selector contract and pipeline sections in the README.
- Docs freshness gate (docs-check with Rules A, B, C and the escape hatch), formatter hook, Claude Code hooks, architectural files manifest.
- Claude Code harness: add-frontend-feature, write-adr, release-notes skills; reviewer and test-writer agents; full CLAUDE.md.
- promote workflow: waits for staging to serve the PR head SHA, then runs the assembly-line smoke package.
- Favicon (`public/favicon.svg`, the Kaizen steps mark on the primary color) and a one-line footer on every page crediting the NICE product workshop, September 2026.
- Footer prints `v<version> · web <sha> · api <sha>`; the API part turns amber with the API's version when the two differ. `dist/version.json` gains `version`. New shared `healthQueryOptions` serves the footer and feature detection with one request.

### Changed

- Task detail page: tightened vertical spacing (`space-y-10` to `space-y-6`) and moved the settled-state Regenerate button from a lone row under the AI banner to sit next to the status select in the task header, so the first suggested step's Accept button lands above the fold at projector size (1024x576).
- Button, badge, and progress-label text sizes bumped for projector legibility (`text-sm` to `text-base` on buttons and the progress label, `text-xs` to `text-sm` on badges/the AI chip), matching the 18px root the projector rules already assume.
- App header is now `sticky top-0 z-10` so navigation and Log out stay reachable while scrolling the task detail page.
- Contract pulled (Health has `version`).

### Fixed

- README "Selector contract" table now names the register page's own heading ("Create your account"), so a future rename cannot silently reintroduce the login-to-register transition race the smoke test hit.
- `tests/write-version.test.ts`, `tests/docs-check.test.ts`, `tests/build-mock-spec.test.ts`, and `tests/pull-openapi.test.ts` now remove their `mkdtempSync` scratch directories in `afterEach` instead of leaking one per test run.
- `docs-check.sh` escape hatch now exits 1 (not 0) after the marker is written, matching the backend script and the assembly-line wrapper's exit-code contract; CI diffing tries the merge-base-aware three-dot form before falling back to two-dot; hook-mode stdin reads are bounded to 5 seconds so a stuck or silent pipe cannot hang the hook; `--hook`/`--ci` are the only accepted modes.
- Claude Code harness docs corrected against review: `add-frontend-feature` and `test-writer` now cite the real MSW import sources (`server` from `tests/msw/server.ts`, `http` from `msw`); the CHANGELOG-trigger file set in `CLAUDE.md` and the `reviewer` agent now matches `docs-check.sh`'s `is_code()` exactly (adds `vite.config.ts`, `index.html`); `reviewer` gained an `unwrap`-discipline check.
- `promote` workflow's smoke run now uses `SMOKE_AI_TIMEOUT_MS: "180000"`, matching the backend's reviewed workflow and the assembly-line plan; the previous `"90000"` equaled the smoke package's own default and bought nothing for a cold Sonnet 5 breakdown.
- `promote` workflow: the failure-artifact upload now sets `if-no-files-found: ignore`, and the `promote` job now declares an explicit `name: promote`, for parity with the backend's reviewed workflow.
- `.railway/railway.ts`'s `web` service build command is `npm run build` only, not `npm ci && npm run build`: Railpack already installs dependencies and mounts `node_modules/.vite` as a build cache, so the nested `npm ci` collided with that mount and failed with `EBUSY`, the root cause of three failed staging builds.
- `Caddyfile`: the SPA shell now gets an explicit `Cache-Control: no-cache` header via a `route` block wrapping `try_files` and `header /index.html`, so the header evaluates after the SPA rewrite and covers deep links (e.g. `/tasks/...`), not just a direct `/index.html` request; `/assets/*` stays `immutable` and `/version.json` stays `no-store` (see ADR 0001 amendment).
- `promote` workflow: `actions/setup-node` (pinned via `.nvmrc`) now runs right after checkout, ahead of the "Wait for staging" step, since `scripts/wait-for-version.sh` shells out to `node -e` and was previously relying on the runner's default Node instead of the pinned version.
