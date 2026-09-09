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

`/version.json` on every deployed environment reports `commit`, `builtAt`, and `version` (the
`package.json` version) for the build that is live.

## Ports and proxy

On Railway the `web` service listens on `PORT=8080` (Caddy, `Caddyfile` at the repo root) and proxies
`/api/*` to the API at `http://api.railway.internal:3000`; the API service pins `PORT=3000`. The
browser only ever talks to the web origin, so there is no CORS and the refresh cookie is first-party.

## Features

- Login, registration, silent session restore on reload, logout
- Task list with create bar, status and tag filters, progress, AI chips, retry, load more, and polling while the assistant works
- Task detail: inline title, description, and status; steps with "Suggested by AI" badges and rationale; accept, edit-then-accept, dismiss, undo
- AI banner with regenerate (conflict-aware), accept all / dismiss all, live polling while the assistant works
- Reorder steps by drag handle or keyboard (Move up / Move down); add a step
- Tags on a task: add from your tags, remove, and adopt the assistant's tag suggestions (creates the tag when needed)
- Tags page: create with a fixed palette, rename and recolor inline, delete with confirmation
- Request a feature: the issue form's five fields, filed as a GitHub issue through the API; the link appears only when the API's health reports `features.featureRequests: true`
- Footer prints the web version and commit and, once health resolves, the API's commit (or its version and commit, in amber, when it differs from the web version)

## Selector contract (smoke test)

The Playwright smoke test in `kaizen-tasks-assembly-line` locates this app by accessible role and
name only. These names are a cross-repo contract; do not change them without changing the smoke test:

| Screen    | Element          | Accessible name                                                                                                                                                                                                                                                    |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login     | heading          | "Log in" (URL ends in `/login`)                                                                                                                                                                                                                                    |
| Login     | link to register | "Create an account"                                                                                                                                                                                                                                                |
| Register  | heading          | "Create your account"                                                                                                                                                                                                                                              |
| Register  | inputs           | labels "Email", "Password", "Display name"                                                                                                                                                                                                                         |
| Register  | submit           | button "Create account"; success lands on `/tasks`                                                                                                                                                                                                                 |
| Task list | create bar       | textbox "Task title"; textbox "Description" revealed by the button "Add description"; Enter in the title submits                                                                                                                                                   |
| Task list | row              | `listitem` named by the task title; the title is a link to `/tasks/:id`                                                                                                                                                                                            |
| Task list | AI chip          | "Thinking" while pending or running; "N suggestions" (from the summary's `suggestionCount`) when done with suggestions; "Breakdown failed: <aiError>" plus a "Retry" button; "Too short to break down", "Hourly limit reached", or "Assistant paused" when skipped |
| Detail    | heading          | the task title (URL `/tasks/<uuid>`)                                                                                                                                                                                                                               |
| Detail    | accept           | button named exactly "Accept" on each suggested step                                                                                                                                                                                                               |
| Detail    | progress         | text `done/total`, for example `0/1`                                                                                                                                                                                                                               |
| Anywhere  | log out          | button "Log out"                                                                                                                                                                                                                                                   |
| Any       | footer           | role `contentinfo` containing "v<version>" and "api <7-char commit>" from `GET /api/v1/health`                                                                                                                                                                     |

## Pipeline

`ci` runs on every pull request and on pushes to `develop` and `main`: typecheck, lint, tests,
docs-check, build, a `dist/version.json` assertion, and a contract-drift warning. Railway deploys
`develop` to staging and `main` to production with wait-for-CI on. `promote` runs on pull requests to
`main`: it waits until staging serves the PR's head SHA at `/version.json`, then runs the smoke
package from `kaizen-tasks-assembly-line` against staging. Both are required checks. The staging URL
defaults to the domain recorded in the master plan; set the repository variable STAGING_WEB_URL to
override it.

## Docs

- `docs/ARCHITECTURE.md`: proxy topology, auth flow, contract copy, polling, mock.
- `docs/adr/`: 0001 same-origin proxy, 0002 contract copied not linked, 0003 access token in memory,
  0004 version in the footer.
- `CHANGELOG.md`: Keep a Changelog; every change adds a bullet under `[Unreleased]`.
- `CLAUDE.md`: conventions and the harness (skills, agents, hooks).
