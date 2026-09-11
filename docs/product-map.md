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
| `/`                | redirect to `/tasks` | —                                                     |
| `*`                | `NotFoundPage`       | `src/app/routes/NotFoundPage.tsx`                     |

## App shell (`src/app/layout.tsx`)

| Control                           | Where  | Source                                                |
| --------------------------------- | ------ | ----------------------------------------------------- |
| `NavLink` "Kaizen Tasks" → /tasks | header | `react-router`                                        |
| `KaizenMark`                      | header | `src/components/kaizen-mark.tsx`                      |
| `NavLink` "Tasks" → /tasks        | header | `react-router`                                        |
| `NavLink` "Tags" → /tags          | header | `react-router`                                        |
| `FeatureRequestLink`              | header | `src/features/feature-request/FeatureRequestLink.tsx` |
| `ThemeToggle`                     | header | `src/features/theme/ThemeToggle.tsx`                  |
| `Button` "Log out"                | header | `src/components/ui/button.tsx`                        |
| `Outlet`                          | shell  | `react-router`                                        |
| `WorkshopFooter`                  | shell  | `src/components/workshop-footer.tsx`                  |

## Features (`src/features/*/`)

- **auth** (`src/features/auth/`) — pages `LoginPage`, `RegisterPage`; components `AuthProvider`, `RestoringScreen`; hooks `hooks.ts`
- **feature-request** (`src/features/feature-request/`) — pages `RequestFeaturePage`; components `FeatureRequestLink`, `ConversationPanel`, `DraftPanel`, `FeatureRequestForm`, `RequestsSoFar`; hooks `hooks.ts`
- **tags** (`src/features/tags/`) — pages `TagsPage`; components `ColorPicker`, `TagRow`; hooks `hooks.ts`
- **tasks** (`src/features/tasks/`) — pages `TaskDetailPage`, `TaskListPage`; components `AddStepForm`, `AddTagPopover`, `AiBanner`, `AiChip`, `AiTagSuggestions`, `BulkBar`, `CreateTaskBar`, `DismissedSteps`, `FilterBar`, `ProgressBar`, `RationalePopover`, `StepList`, `StepRow`, `TaskHeader`, `TaskRow`; hooks `hooks.ts`
- **theme** (`src/features/theme/`) — components `ThemeToggle`; hooks `hooks.ts`

## Endpoints the app may call (`src/api/openapi.json`)

| Method | Path                                           | Summary                                                    | Tag              |
| ------ | ---------------------------------------------- | ---------------------------------------------------------- | ---------------- |
| POST   | `/admin/seed-reset`                            | Delete and recreate the demo user's fixtures               | admin            |
| POST   | `/auth/login`                                  | Log in with email and password                             | auth             |
| POST   | `/auth/logout`                                 | Revoke the refresh token and clear the cookie              | auth             |
| GET    | `/auth/me`                                     | Current user                                               | auth             |
| PATCH  | `/auth/me`                                     | Update the current user's preferences                      | auth             |
| POST   | `/auth/refresh`                                | Rotate the refresh cookie and issue a new access token     | auth             |
| POST   | `/auth/register`                               | Register a new user                                        | auth             |
| GET    | `/feature-requests`                            | List the feature requests filed to GitHub                  | feature-requests |
| POST   | `/feature-requests`                            | File a feature request as a GitHub issue                   | feature-requests |
| GET    | `/feature-requests/conversation`               | Get the caller's open interview conversation               | feature-requests |
| POST   | `/feature-requests/conversation`               | Start a new interview conversation                         | feature-requests |
| POST   | `/feature-requests/conversation/{id}/messages` | Send one answer and stream the assistant's reply           | feature-requests |
| GET    | `/health`                                      | Health check with the running commit SHA                   | system           |
| GET    | `/openapi.json`                                | This OpenAPI document                                      | system           |
| GET    | `/tags`                                        | List the user's tags                                       | tags             |
| POST   | `/tags`                                        | Create a tag                                               | tags             |
| PATCH  | `/tags/{id}`                                   | Rename or recolor a tag                                    | tags             |
| DELETE | `/tags/{id}`                                   | Delete a tag and its links                                 | tags             |
| GET    | `/tasks`                                       | List tasks                                                 | tasks            |
| POST   | `/tasks`                                       | Create a task or a step                                    | tasks            |
| GET    | `/tasks/{id}`                                  | Get a task with its children, tags, progress and AI fields | tasks            |
| PATCH  | `/tasks/{id}`                                  | Update a task                                              | tasks            |
| DELETE | `/tasks/{id}`                                  | Delete a task and its children                             | tasks            |
| POST   | `/tasks/{id}/breakdown`                        | Request an AI breakdown                                    | tasks            |
| POST   | `/tasks/{id}/suggestions/accept-all`           | Accept every suggested step                                | tasks            |
| POST   | `/tasks/{id}/suggestions/dismiss-all`          | Dismiss every suggested step                               | tasks            |
| PUT    | `/tasks/{id}/tags`                             | Replace the task's tag set                                 | tasks            |

## Recent releases (history, not current behavior)

### Unreleased

- **Added** — "Requests so far" at the bottom of the Request page: every feature request filed to GitHub through `GET /feature-requests`, open first then closed and newest first, each with a stage chip derived fro…

### 1.3.0 — 2026-09-11

- **Added** — `docs/product-map.md`: what this app is and what it has, for an agent about to interview a product owner. A hand-writte…
- **Added** — Docs-check Rule D: the product map is regenerated and compared on every run, in both modes, before the early return and…

### 1.2.0 — 2026-09-10

- **Added** — A Light / Dark / System control in the header. The choice applies to the page at once, `System` follows the operating s…

### 1.1.1 — 2026-09-10

- **Fixed** — `ConversationPanel` no longer shows the "Skip this question" chip while the assistant's greeting is the last message, b…

## Decisions (`docs/adr/*.md`)

- [ADR 0001: Same-origin API through the web service's Caddy proxy](adr/0001-same-origin-proxy-web-side.md)
- [ADR 0002: The API contract is copied into this repo, not linked](adr/0002-contract-copied-not-linked.md)
- [ADR 0003: The access token lives in memory only](adr/0003-access-token-in-memory.md)
- [ADR 0004: The footer prints the web and API versions from a build-time define and the health query](adr/0004-version-in-the-footer.md)
- [ADR 0005: The interview stream is read through the typed client and parsed by our own SSE reader](adr/0005-streamed-conversation-through-the-typed-client.md)
- [ADR 0006: The theme comes from the session user, and the `dark` class is the only switch](adr/0006-theme-comes-from-the-session-user.md)
- [ADR 0007: The product map is generated from this checkout and compared on every docs check](adr/0007-product-map-generated-and-gated.md)
- [ADR 0008: The requests list is read through the typed client, never from GitHub in the browser](adr/0008-feature-request-list-read-through-the-typed-client.md)
