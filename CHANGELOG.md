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
