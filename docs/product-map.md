# Product map: kaizen-tasks-web

The generated part below the marker matches this checkout; the header is prose reviewed by a person.

Kaizen Tasks is a personal task manager for one signed-in person: they write a task, an AI assistant
breaks it into three to seven steps, and they accept, edit or dismiss each one; nothing the assistant
proposes counts as work until a person says yes. Tags are user-scoped; the list filters by status and tag.

This repo is the web half: Vite, React 19, TypeScript, Tailwind, shadcn/ui, TanStack Query and
react-router. Every call it can make comes from the API's contract, copied into
`src/api/openapi.json` from kpnemo/kaizen-tasks-api, so a request that needs new data needs the API
repo first; the browser talks to `/api/v1` on its own origin, never to another host.

Constraints on any request: the app is read from a projector (large type, 44px hit areas, nothing
hover-only); every AI state (thinking, failed with retry, skipped with a reason) stays visible, since
breakdowns are rate-limited and an operator can pause them; the smoke test drives the app by
accessible role and name, so those names are a cross-repo contract; new or changed controls follow
`docs/ui-conventions.md`.

Reviewed: 2026-09-10 against ../docs/PRD.md sections 3, 5.1-5.5, 6.3.

<!-- product-map:generated -->

## Screens (`src/app/router.tsx`)

| Path               | Renders              | Source                                                |
| ------------------ | -------------------- | ----------------------------------------------------- |
| `/login`           | `LoginPage`          | `src/features/auth/LoginPage.tsx`                     |
| `/register`        | `RegisterPage`       | `src/features/auth/RegisterPage.tsx`                  |
| `/tasks`           | `TaskListPage`       | `src/features/tasks/TaskListPage.tsx`                 |
| `/tasks/:id`       | `TaskDetailPage`     | `src/features/tasks/TaskDetailPage.tsx`               |
| `/tags`            | `TagsPage`           | `src/features/tags/TagsPage.tsx`                      |
| `/request-feature` | `RequestFeaturePage` | `src/features/feature-request/RequestFeaturePage.tsx` |
| `/pipeline`        | `PipelinePage`       | `src/features/pipeline/PipelinePage.tsx`              |
| `/`                | redirect to `/tasks` | —                                                     |
| `*`                | `NotFoundRoute`      | `src/app/routes/NotFoundRoute.tsx`                    |

## App shell (`src/app/layout.tsx`)

| Control                           | Where  | Source                                                |
| --------------------------------- | ------ | ----------------------------------------------------- |
| `NavLink` "Kaizen Tasks" → /tasks | header | `react-router`                                        |
| `KaizenMark`                      | header | `src/components/kaizen-mark.tsx`                      |
| `NavButton` "Tasks" → /tasks      | header | `src/components/nav-button.tsx`                       |
| `NavButton` "Tags" → /tags        | header | `src/components/nav-button.tsx`                       |
| `FeatureRequestLink`              | header | `src/features/feature-request/FeatureRequestLink.tsx` |
| `PipelineLink`                    | header | `src/features/pipeline/PipelineLink.tsx`              |
| `ThemeToggle`                     | header | `src/features/theme/ThemeToggle.tsx`                  |
| `Button` "Log out"                | header | `src/components/ui/button.tsx`                        |
| `Outlet`                          | shell  | `react-router`                                        |
| `WorkshopFooter`                  | shell  | `src/components/workshop-footer.tsx`                  |

## Features (`src/features/*/`)

- **auth** (`src/features/auth/`) — pages `LoginPage`, `RegisterPage`; components `AuthProvider`, `RestoringScreen`; hooks `hooks.ts`
- **feature-request** (`src/features/feature-request/`) — pages `RequestFeaturePage`; components `FeatureRequestLink`, `ConversationPanel`, `DraftPanel`, `FeatureRequestForm`, `RequestsSoFar`; hooks `hooks.ts`
- **pipeline** (`src/features/pipeline/`) — pages `PipelinePage`; components `PipelineLink`, `DeployDialog`, `EnvironmentCard`, `FlowDiagram`, `IssueAction`, `IssuesTable`, `SnapshotAge`; hooks `hooks.ts`
- **tags** (`src/features/tags/`) — pages `TagsPage`; components `ColorPicker`, `TagRow`; hooks `hooks.ts`
- **tasks** (`src/features/tasks/`) — pages `TaskDetailPage`, `TaskListPage`; components `AddStepForm`, `AddTagPopover`, `AiBanner`, `AiChip`, `AiTagSuggestions`, `BulkBar`, `CreateTaskBar`, `DismissedSteps`, `FilterBar`, `ProgressBar`, `RationalePopover`, `StepList`, `StepRow`, `TaskHeader`, `TaskRow`; hooks `hooks.ts`
- **theme** (`src/features/theme/`) — components `ThemeToggle`; hooks `hooks.ts`

## Endpoints the app may call (`src/api/openapi.json`)

| Method | Path                                           | Summary                                  |
| ------ | ---------------------------------------------- | ---------------------------------------- |
| POST   | `/admin/seed-reset`                            | Delete and recreate the demo user's fix… |
| POST   | `/auth/login`                                  | Log in with email and password           |
| POST   | `/auth/logout`                                 | Revoke the refresh token and clear the…  |
| GET    | `/auth/me`                                     | Current user                             |
| PATCH  | `/auth/me`                                     | Update the current user's preferences    |
| POST   | `/auth/refresh`                                | Rotate the refresh cookie and issue a n… |
| POST   | `/auth/register`                               | Register a new user                      |
| GET    | `/feature-requests`                            | List the feature requests filed to GitH… |
| POST   | `/feature-requests`                            | File a feature request as a GitHub issue |
| GET    | `/feature-requests/conversation`               | Get the caller's open interview convers… |
| POST   | `/feature-requests/conversation`               | Start a new interview conversation       |
| POST   | `/feature-requests/conversation/{id}/messages` | Send one answer and stream the assistan… |
| GET    | `/health`                                      | Health check with the running commit SHA |
| GET    | `/openapi.json`                                | This OpenAPI document                    |
| GET    | `/pipeline`                                    | One snapshot of the delivery pipeline    |
| POST   | `/pipeline/issues/{number}/deploy-staging`     | Merge an issue's green pull requests in… |
| POST   | `/pipeline/ship`                               | Dispatch the ship workflow for everythi… |
| POST   | `/pipeline/ship/retry`                         | Re-dispatch a failed or cancelled ship…  |
| GET    | `/tags`                                        | List the user's tags                     |
| POST   | `/tags`                                        | Create a tag                             |
| PATCH  | `/tags/{id}`                                   | Rename or recolor a tag                  |
| DELETE | `/tags/{id}`                                   | Delete a tag and its links               |
| GET    | `/tasks`                                       | List tasks                               |
| POST   | `/tasks`                                       | Create a task or a step                  |
| GET    | `/tasks/{id}`                                  | Get a task with its children, tags, pro… |
| PATCH  | `/tasks/{id}`                                  | Update a task                            |
| DELETE | `/tasks/{id}`                                  | Delete a task and its children           |
| POST   | `/tasks/{id}/breakdown`                        | Request an AI breakdown                  |
| POST   | `/tasks/{id}/suggestions/accept-all`           | Accept every suggested step              |
| POST   | `/tasks/{id}/suggestions/dismiss-all`          | Dismiss every suggested step             |
| PUT    | `/tasks/{id}/tags`                             | Replace the task's tag set               |

## Recent releases (history, not current behavior)

### Unreleased

- nothing yet

### 1.5.0 — 2026-09-11

- **Added** — `/pipeline`, the workshop's control room, linked from the header as "Pipeline" while the API's heal…

### 1.4.0 — 2026-09-11

- **Added** — The shadcn skill (`.claude/skills/shadcn/`, installed from shadcn/ui, tracked by `skills-lock.json`…

### 1.3.0 — 2026-09-11

- **Added** — `docs/product-map.md`: what this app is and what it has, for an agent about to interview a product…

## Decisions (`docs/adr/*.md`)

- [ADR 0001: Same-origin API through the web service's Caddy proxy](adr/0001-same-origin-proxy-web-side.md)
- [ADR 0002: The API contract is copied into this repo, not linked](adr/0002-contract-copied-not-linked.md)
- [ADR 0003: The access token lives in memory only](adr/0003-access-token-in-memory.md)
- [ADR 0004: The footer prints the web and API versions from a build-time define and the health query](adr/0004-version-in-the-footer.md)
- [ADR 0005: The interview stream is read through the typed client and parsed by our own SSE reader](adr/0005-streamed-conversation-through-the-typed-client.md)
- [ADR 0006: The theme comes from the session user, and the `dark` class is the only switch](adr/0006-theme-comes-from-the-session-user.md)
- [ADR 0007: The product map is generated from this checkout and compared on every docs check](adr/0007-product-map-generated-and-gated.md)
- [ADR 0008: The requests list is read through the typed client, never from GitHub in the browser](adr/0008-feature-request-list-read-through-the-typed-client.md)
- [ADR 0009: One catch-all route picks the 404's frame by session](adr/0009-not-found-frame-by-session.md)
- [ADR 0010: The pipeline page reads and drives the pipeline only through the typed client](adr/0010-pipeline-read-and-driven-through-the-typed-client.md)
