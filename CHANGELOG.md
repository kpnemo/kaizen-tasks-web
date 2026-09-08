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
