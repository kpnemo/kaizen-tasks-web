# Kaizen Tasks Web: Design Spec

| Field      | Value                                                                                                                                                                                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo       | `kaizen-tasks-web`, folder `webapp/frontend/`                                                                                                                                                                                                                                                                              |
| Status     | Approved design 2026-09-08                                                                                                                                                                                                                                                                                                 |
| Upstream   | `webapp/docs/PRD.md` (sections 5, 6.3, 7); API contract in `kaizen-tasks-api` `openapi.json`; API spec `webapp/backend/docs/superpowers/specs/2026-09-08-kaizen-tasks-api-design.md`. Contract rulings 2026-09-08: `TaskSummary` carries `suggestionCount` and `aiError`; `GET /health` carries `features.featureRequests` |
| Downstream | `superpowers:writing-plans` produces `docs/superpowers/plans/` from this spec                                                                                                                                                                                                                                              |

## 1. Purpose and scope

The React web app for Kaizen Tasks: login and registration, the task list, the task detail with AI-suggested steps, tag management, and the optional feature-request page. It also owns the production static service with the Caddy proxy that makes the API same-origin. It does not own the smoke package (assembly-line repo) or any API behavior.

Approach decisions taken in design:

| #   | Decision                      | Choice and reason                                                                                                                                                    |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | UI kit                        | shadcn/ui on Tailwind. Accessible primitives, agent-familiar conventions, cheap theming through CSS variables                                                        |
| A2  | Working before the API exists | Prism mock server generated from the committed contract, behind the Vite proxy. No mock code to maintain                                                             |
| A3  | Client                        | openapi-typescript for types, openapi-fetch as the typed client, hand-written TanStack Query hooks per feature                                                       |
| A4  | Look                          | Light custom theme with a Kaizen identity on shadcn tokens, tuned for a projector: large type, generous spacing, high contrast                                       |
| A5  | Contract sharing              | The contract is copied into this repo and committed with its generated types, so a checkout builds offline and a backend change never breaks a frontend PR by itself |

## 2. System shape

### 2.1 Runtime and tooling

Vite 7, React 19, TypeScript strict, React Router 7 (data mode not required; plain routes), TanStack Query 5, Tailwind 4, shadcn/ui (copied components), lucide icons. Node 24 through `.nvmrc`, `engines.node` `>=24 <25`. ESLint flat config with typescript-eslint and react-hooks, Prettier.

Package versions are pinned at scaffold time from the latest tags; the plan records them.

### 2.2 Folder layout

```
webapp/frontend/
  .claude/                 settings.json (hooks), skills/, agents/
  .github/workflows/       ci.yml, promote.yml
  .railway/railway.ts
  Caddyfile                production static serving + /api proxy
  docs/                    ARCHITECTURE.md, adr/, architectural-files.txt, superpowers/
  scripts/                 docs-check.sh, format-file.sh, pull-openapi.sh, write-version.mjs
  src/
    main.tsx               providers: QueryClient, Router, Toaster, AuthProvider
    app/                   router.tsx, layout.tsx (top bar, page shell), routes/
    api/                   openapi.json (committed copy), types.ts (generated), client.ts, errors.ts, auth-store.ts
    features/
      auth/                LoginPage, RegisterPage, useSession, tests
      tasks/               TaskListPage, TaskDetailPage, components/, hooks.ts, tests
      tags/                TagsPage, hooks.ts, tests
      feature-request/     RequestFeaturePage, hooks.ts, tests
    components/ui/         shadcn components
    lib/                   cn.ts, format.ts, polling.ts
    styles/                globals.css (theme tokens)
  tests/                   setup.ts (MSW server, Testing Library config), msw/handlers.ts
  index.html  vite.config.ts  vitest.config.ts  tailwind config in CSS  components.json (shadcn)
  CHANGELOG.md  CLAUDE.md  README.md  package.json  tsconfig.json  .env.example  .nvmrc
```

Import rules: `features/*` import from `api`, `components/ui`, `lib`, and their own folder; never from another feature. `app/` composes features. `api/` imports nothing from features.

### 2.3 Configuration

The app has no runtime configuration. Every request goes to the relative path `/api/v1`. Development configuration is Vite-only:

| Variable            | Default                 | Notes                                                                                                           |
| ------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `VITE_PROXY_TARGET` | `http://localhost:4010` | Where the Vite dev server forwards `/api`. 4010 is the Prism mock; use `http://localhost:3000` for the real API |

Build-time input: `RAILWAY_GIT_COMMIT_SHA` when present, otherwise `git rev-parse HEAD`, written by `scripts/write-version.mjs` into `dist/version.json` as `{ "commit": "...", "builtAt": "<iso>" }` after `vite build`.

### 2.4 Production serving

`Caddyfile` at the repo root, picked up by Railpack's static provider:

```
{
  auto_https off
}
:{$PORT}
handle /api/* {
  reverse_proxy http://api.railway.internal:3000
}
handle {
  root * dist
  try_files {path} /index.html
  file_server
  header /assets/* Cache-Control "public, max-age=31536000, immutable"
  header /version.json Cache-Control "no-store"
}
```

The API service pins `PORT=3000`, so the proxy target is stable. `/version.json` is never cached so the promote workflow and the smoke package always see the live build. The proxy also means no CORS configuration exists anywhere and the refresh cookie is first-party.

## 3. Authentication in the client

- `api/auth-store.ts` holds the access token in module memory, never in storage. It exposes `getToken`, `setToken`, `clear`, and a subscription so the session hook re-renders.
- `api/client.ts` is `createClient<paths>({ baseUrl: "/api/v1", credentials: "include" })` from openapi-fetch with two middlewares. Request: attach `Authorization: Bearer` when a token exists. Response: on 401 from any route except the auth routes, call `POST /auth/refresh` once, store the new token, and replay the original request; on a second 401, clear the store and navigate to `/login` with a `returnTo` query. Any error envelope is decoded into `ApiError { code, message, details, requestId }` in `api/errors.ts`.
- On app load `useSession` calls refresh once. While it is in flight the shell shows a neutral loading state, so a returning user never sees a login flash. A failed refresh means logged out, silently.
- Protected routes redirect to `/login` when there is no session. Login and register redirect to `/tasks` when there is one.
- Logout calls the API, clears the store, and clears the query cache.

## 4. Screens and behavior

### 4.1 Routes

| Path               | Page                 | Auth                                |
| ------------------ | -------------------- | ----------------------------------- |
| `/login`           | LoginPage            | public                              |
| `/register`        | RegisterPage         | public                              |
| `/tasks`           | TaskListPage         | required                            |
| `/tasks/:id`       | TaskDetailPage       | required                            |
| `/tags`            | TagsPage             | required                            |
| `/request-feature` | RequestFeaturePage   | required, shown only when available |
| `/`                | redirect to `/tasks` |                                     |

### 4.2 Layout

Top bar with the Kaizen mark and name, links to tasks, tags, and request a feature (hidden when unavailable), and a user menu with display name and logout. Content column with a maximum width suited to a projector. Base font size 18px, headings in the display typeface, body in a humanist sans, one accent color for actions and the AI badge, a second muted color for dismissed items. Every interactive control has a visible focus ring and a minimum 44px hit area. Nothing the demo depends on is hover-only; rationale is available on tap and on hover.

### 4.3 Task list

- Create bar at the top: title input, expandable description, submit on Enter. On success the new task appears first with its AI chip in thinking state, and the list query is invalidated.
- Filter bar: status segmented control (all, todo, in progress, done) and a single-tag select from `GET /tags`, because `GET /tasks` filters by one `tagId`.
- Rows show title, tag chips, a progress bar with the `done/total` label from `progress`, and an AI chip:
  - pending or running: animated "thinking" chip
  - done with suggested children: "N suggestions" chip from `suggestionCount` on the summary, linking to the detail
  - done with none suggested: no chip
  - skipped: chip with the reason in words from `aiSkipReason` (too short to break down, hourly limit reached, assistant paused)
  - failed: chip with the `aiError` message from the summary and a retry button that calls `POST /tasks/:id/breakdown`
- The list uses keyset pagination with a "load more" button driven by `meta.nextCursor`.
- While any visible row is pending or running, the list query polls every three seconds; polling stops when none is.

### 4.4 Task detail

- Header: editable title (inline, saves on blur), status select, description (inline editable), tag chips with remove, an add-tag popover listing the user's tags, and AI tag suggestion chips rendered from `aiTagSuggestions` with a plus that creates the tag if needed and calls `PUT /tasks/:id/tags`.
- AI state banner under the header: thinking (with the same animation), failed with retry, skipped with reason, or nothing when done. A Regenerate button calls the breakdown action and is disabled while pending or running; a `CONFLICT` response shows "already working on it".
- Steps list ordered as returned. Each row: checkbox bound to status (todo or done), title (inline editable), and for AI-origin rows a "Suggested by AI" badge with the rationale shown in a popover on tap and on hover. Suggested rows have accept, edit-then-accept (opens the inline editor, saves title then sets accepted), and dismiss. Accepted rows look like user rows with a small AI mark. Dismissed rows collapse into a "N dismissed" disclosure with undo per row (sets accepted).
- Bulk bar appears when suggestions exist: Accept all, Dismiss all.
- Reorder: drag handle per row using `@dnd-kit/sortable`; drop sends `PATCH` with the target index as `position`. Optimistic update, rollback on error.
- Add step: input at the bottom creates a child with `parentId`.
- Polling: the detail query polls every two seconds while `aiStatus` is pending or running and stops when it settles; the list query is invalidated when it settles so chips update.

### 4.5 Tags

Table of tags with name and color swatch (no task count; the API does not provide one); create form with name and a fixed palette of eight colors; rename and recolor inline; delete with a confirm dialog explaining links are removed.

### 4.6 Request a feature

Availability comes from `GET /api/v1/health`, whose `data.features.featureRequests` is true exactly when the API mounted the route. The app reads health once per session (it is public and cheap) and shows the nav link and route only when the flag is true. Form fields mirror the issue form: title, problem, proposed behavior, acceptance criteria, out of scope. Success shows the issue number and link.

### 4.7 Errors

One toast system. `ApiError` is rendered by code: `VALIDATION_ERROR` maps field details onto the form; `RATE_LIMITED` shows the scope and reset time; `UNAVAILABLE` shows "the assistant is paused"; `UNAUTHORIZED` is handled by the client middleware and never reaches a page; `CONFLICT` shows the message; everything else shows the message with the request id in small text so a facilitator can find it in the logs.

## 5. Contract, client, and mock

### 5.1 Contract copy

`scripts/pull-openapi.sh [ref]` downloads `openapi.json` from `https://raw.githubusercontent.com/kpnemo/kaizen-tasks-api/<ref>/openapi.json` into `src/api/openapi.json` (default ref `develop`) and runs `npm run api:types`, which is `openapi-typescript src/api/openapi.json -o src/api/types.ts`. Both files are committed. A change to either is a normal reviewed change. When the backend does not yet publish a contract, the plan's first task authors the initial `openapi.json` by hand from the API spec's section 4 and both repos converge on it; the backend's generated document must match it before the backend's first merge.

CI runs `scripts/pull-openapi.sh develop --check`, which compares without writing and prints a warning annotation when the copy is behind; it never fails the build.

### 5.2 Client and hooks

`api/client.ts` as in section 3. Feature hooks in `features/<domain>/hooks.ts`:

- `useTasks(filters)` with query key `["tasks", filters]`, `useTask(id)` with `["tasks", id]`, `useTags()` with `["tags"]`, `useSession()`.
- Mutations: `useCreateTask`, `useUpdateTask`, `useDeleteTask`, `useBreakdown`, `useAcceptAll`, `useDismissAll`, `useReplaceTags`, `useCreateTag`, `useUpdateTag`, `useDeleteTag`, `useSubmitFeatureRequest`. Each invalidates the affected keys on success.
- `lib/polling.ts` exports `activeAiInterval(task)` returning the refetch interval or `false`, used by both the list and detail queries.

### 5.3 Mock server

`npm run mock` runs `prism mock src/api/openapi.json -p 4010 --dynamic`. Combined with the default proxy target, `npm run dev` works with no backend. Because Prism returns schema-valid but random data, the contract's examples are curated so the mock looks sensible on screen: example tasks with realistic titles, one with suggestions, one skipped, one failed.

## 6. Testing

- Vitest with jsdom, Testing Library, and MSW. `tests/setup.ts` starts an MSW server with handlers in `tests/msw/handlers.ts` typed against `api/types.ts`, and resets between tests.
- Every feature has a happy-path test and an error-state test. Required cases: login success and wrong password; register duplicate email shows the field error; session restore on load; 401 triggers one refresh and replays; second 401 routes to login; task list renders chips for every `aiStatus` and every `aiSkipReason`; create task adds a row in thinking state; list polls while a row is pending and stops when done (fake timers); detail renders suggested steps with rationale; accept, dismiss, undo, accept all, dismiss all call the right endpoints; regenerate disabled while active and shows the conflict message; reorder sends the target index; tag add and AI tag suggestion adoption; feature-request link hidden when the contract lacks the path; toast rendering per error code.
- CI runs typecheck, lint, tests, docs-check, build, and a check that `dist/version.json` exists and parses.
- No Playwright in this repo. The smoke package lives in the assembly-line repo and runs against a deployed URL.

## 7. Docs and harness

Docs set: `README.md` (what it is, run with mock, run against the API, scripts, URLs), `docs/ARCHITECTURE.md` (proxy topology, auth flow, contract copy, polling, one mermaid diagram), `docs/adr/0001-same-origin-proxy-web-side.md`, `0002-contract-copied-not-linked.md`, `0003-access-token-in-memory.md`, `CHANGELOG.md`, `CLAUDE.md`.

`docs/architectural-files.txt`: `src/api/**`, `Caddyfile`, `.railway/**`, `src/app/router.tsx`, `src/main.tsx`.

`scripts/docs-check.sh` is the backend's script with Rule B replaced: if `src/api/openapi.json` changed, `npm run api:types -- --check` must show no diff in `src/api/types.ts`. Rules A and C, the base selection, the escape hatch that never reports success, and the CI mode are identical. Hooks in `.claude/settings.json`: Stop runs docs-check in hook mode; PostToolUse on Edit or Write runs the formatter.

Skills: `add-frontend-feature` (restate the acceptance criteria; if the API changed, pull the contract and regenerate types; write the failing component test; add or extend the feature folder; add the hook; wire the route and nav; run tests to green; update README feature list and CHANGELOG; ADR if an architectural file changed; run docs-check), `write-adr`, `release-notes`. Agents: `reviewer` (import rules, no absolute API origins, every feature has both tests, no storage of tokens, docs freshness) and `test-writer`. `CLAUDE.md` under a page with the same structure as the backend's.

## 8. CI/CD and Railway

`ci.yml`: pull requests and pushes to `develop` and `main`, concurrency per ref, setup-node from `.nvmrc`, `npm ci`, typecheck, lint, test, docs-check in CI mode, build, version.json assertion, contract drift warning.

`promote.yml`: pull requests targeting `main`. Polls `https://<staging web domain>/version.json` until `commit` equals the PR head SHA, timeout 15 minutes, then checks out the public `kaizen-tasks-assembly-line` repo and runs its smoke package against the staging domain. Required check on `main`. Branch protection for `develop` and `main` mirrors the backend's.

Railway, in the only project the workshop touches, `kaizen-tasks`: service `web` in `staging` and `production` from `kaizen-tasks-web`, branch `develop` and `main` respectively, wait-for-CI on in the dashboard, build `npm ci && npm run build`, static serving through the `Caddyfile`, healthcheck `/version.json`, a Railway-generated public domain per environment. `.railway/railway.ts` declares the service with the branch chosen from the environment context and is applied per environment with the CLI. Deploys follow the same flow as the API: merge to `develop`, CI, Railway waits, staging, promote check, merge to `main`, production.

## 9. Local development

`nvm use`, `npm ci`, `npm run mock` in one terminal and `npm run dev` in another for contract-only work; or `VITE_PROXY_TARGET=http://localhost:3000 npm run dev` against the running API. Scripts: `dev`, `build`, `preview`, `test`, `lint`, `typecheck`, `mock`, `api:pull`, `api:types`, `docs:check`.

## 10. Verification items

| #   | Check                                                                                           | Status                                     | Fallback                                                                                          |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| W1  | Railpack's static provider honors a root `Caddyfile` with a reverse proxy to a private hostname | Open, verified on the first staging deploy | A tiny Node server (`serve-handler` plus `http-proxy`) declared as the start command              |
| W2  | Prism serves the contract's examples with `--dynamic` in a way that looks sensible              | Open, verified in the first frontend task  | Drop `--dynamic` and rely on static examples                                                      |
| W3  | openapi-fetch response middleware can replay a request after refresh                            | Open, verified by the 401 test             | Wrap the client in a small `request()` function that handles refresh before calling openapi-fetch |

## 11. Out of scope

The smoke package, the API, real-time push, offline support, mobile layouts beyond not breaking, internationalization, dark mode.
