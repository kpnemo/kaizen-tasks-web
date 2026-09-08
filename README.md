# Kaizen Tasks Web

The web app for Kaizen Tasks: a personal task manager where every big task is broken into small
doable steps by an AI assistant, and the human decides what to accept.

Part of the Kaizen Tasks workshop. The API lives in
[kaizen-tasks-api](https://github.com/kpnemo/kaizen-tasks-api); the cross-repo harness and the
smoke package live in [kaizen-tasks-assembly-line](https://github.com/kpnemo/kaizen-tasks-assembly-line).

## Run it

Prerequisites: nvm with Node 24 (`nvm install 24`).

```bash
nvm use
npm ci
```

With the contract mock (no backend needed):

```bash
npm run mock      # Prism on http://localhost:4010, built from src/api/openapi.json
npm run dev       # Vite on http://localhost:5173, proxies /api to the mock
```

The mock serves the curated examples in `mock/examples.json`, merged into a copy of the contract by
`scripts/build-mock-spec.mjs` (output `.mock/openapi.json`, git-ignored). Prism runs in static mode
because its `--dynamic` mode ignores examples. Requests go to `http://localhost:4010/api/v1/...`:
Prism ignores the contract's `servers` entry when routing, so the build script folds that base path
into the mock artifact's own paths (the committed contract keeps its bare paths). Every task detail
comes back as the same example task; that is the mock's limit, not a bug.

Against the real API running locally on port 3000:

```bash
VITE_PROXY_TARGET=http://localhost:3000 npm run dev
```

## Scripts

| Script       | Does                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------- |
| `dev`        | Vite dev server with the `/api` proxy (`VITE_PROXY_TARGET`, default `http://localhost:4010`) |
| `build`      | `vite build`, then writes `dist/version.json`                                                |
| `preview`    | Serves `dist/` locally                                                                       |
| `test`       | Vitest, jsdom, Testing Library, MSW                                                          |
| `lint`       | ESLint and Prettier check                                                                    |
| `typecheck`  | `tsc --noEmit`                                                                               |
| `mock`       | Prism mock of the contract on port 4010                                                      |
| `api:pull`   | Copies the API contract into `src/api/openapi.json` and regenerates types                    |
| `api:types`  | Regenerates `src/api/types.ts` from the contract                                             |
| `docs:check` | Docs freshness gate (also the Claude Code Stop hook)                                         |

`npm run api:pull -- --local ../backend/openapi.json` copies the contract from the nested backend
checkout instead of GitHub. `npm run api:pull -- develop --check` only reports drift (CI does this
and warns, never fails). Both `src/api/openapi.json` and `src/api/types.ts` are committed.

## URLs

| Environment | URL                                                          |
| ----------- | ------------------------------------------------------------ |
| Local       | http://localhost:5173                                        |
| Staging     | https://web-staging-52c0.up.railway.app (deploys `develop`)  |
| Production  | https://web-production-7ef71.up.railway.app (deploys `main`) |

`/version.json` on every deployed environment reports the commit that is live.

## Ports and proxy

On Railway the `web` service listens on `PORT=8080` (Caddy, `Caddyfile` at the repo root) and proxies
`/api/*` to the API at `http://api.railway.internal:3000`; the API service pins `PORT=3000`. The
browser only ever talks to the web origin, so there is no CORS and the refresh cookie is first-party.

## Features

- Login, registration, silent session restore on reload, logout
- (Task list, task detail with AI steps, tags, and request-a-feature are added by later tasks.)

## Docs

`docs/ARCHITECTURE.md`, `docs/adr/`, `CHANGELOG.md`, `CLAUDE.md`.
