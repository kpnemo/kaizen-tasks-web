# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The shadcn primitives the UI rework composes from, added with the CLI (`npx shadcn@latest add`): `alert`, `empty`, `spinner`, `skeleton`, `progress`, `table`, `collapsible`, `radio-group`, `scroll-area` and `field` under `src/components/ui/`, listed in `docs/ui-conventions.md`. `Badge` moves its base scale to `text-base` with `size-4` icons, so every chip in the app clears the projector's 18px floor with no call-site size props.

### Changed

- The app shell on shadcn (ui-rework, shell): the primary nav links are `NavButton`s (`src/components/nav-button.tsx`), a `NavLink` in Button clothes with an icon and the current screen as the secondary variant; the theme control is a `dropdown-menu` whose trigger shows the current choice as its icon (with its word from `xl` up, where the header has room) and keeps the accessible name "Theme"; the display name truncates at twelve characters; the footer's API segment is a `Badge`, outline when the versions match and destructive with a visible "web and API versions differ" note when they do not; the 404 is an `Empty` with a "Go to your tasks" button, shown inside the shell for a signed-in user and in a bare frame with the footer otherwise, decided by one catch-all route (ADR 0009). Shared pieces: `Field` wraps the shadcn Field, keeps the hint beside the error and owns `aria-describedby`; `InlineText` is a ghost `Button` with a pencil instead of a hover title and edits in `Input`/`Textarea` at the size of the text it replaces, at every breakpoint; `TagChip` is an outline `Badge` around the exported `TagSwatch`, its remove control a square `Button`. Screenshot scenario `theme-open` replaces `theme-focused`, and the `add-frontend-feature` page template starts from `Skeleton`, `Alert`, `Empty` and `flex gap`.
- The auth screens on shadcn (ui-rework, auth): `/login` and `/register` are one `Card` each, centred in the viewport (`CardHeader` with the wordmark, the h1 through `CardTitle asChild` so the headings "Log in" and "Create your account" keep their role, and a one-line description; `CardContent` with the form in a `FieldGroup`; `CardFooter` with the cross link as a link `Button`). An error that belongs to no field is a destructive `Alert` with an icon and a title ("Could not log in", "Could not create your account") above the submit, never mounted beside a field error; the submit carries a `LogIn`/`UserPlus` icon that becomes a `Spinner` while pending, and the email field is focused on arrival. The pages spell no `aria-describedby` themselves: the `Field` wrapper wires the hint and the error, so "At least 8 characters" stays on screen beside a password error. The restoring screen shows a `Spinner` beside "Restoring your session" (status "Session" unchanged). `CardTitle` gains `asChild`. Screenshot scenarios `login` and `register` sign out inside `ready()` (the runner arrives signed in) and set the theme cache to `system` so the emulated colour scheme decides the theme. Review round: `Alert` moves its base scale to `text-base` (root and description), the way `Badge` did, so every callout clears the 18px floor with no call-site override; the 44px hit-area rule in `globals.css` now names `a[data-slot="button"]`, so a `Button asChild` around a `Link` (the auth cross links, the 404's "Go to your tasks") gets the same target as a button. `tests/projector-rules.test.ts` pins both.
- The task detail on shadcn (ui-rework, tasks-detail): each step is a four-column grid row (drag handle as a ghost icon `Button`, done, title, actions) so the action column never wraps at the projector's width; Accept keeps its name with a check icon, Edit and Dismiss sit in a row `dropdown-menu` behind "More actions for <step>", an accepted AI step shows a secondary "AI" `Badge` instead of a lone icon, and the "Suggested by AI" pill is a secondary `Button` anchoring the unchanged rationale popover. The status select is a group of three pressed `Button`s (To do / In progress / Done) with icons; "Add tag" opens a `dropdown-menu` named "Available tags" whose items carry the shared `TagSwatch`; "Suggested tags" is an outline `Badge` beside full-height chips. The three assistant states and the suggestions bar share one `Alert` row shape (`components/banner.ts`): thinking and skipped are status regions named "Assistant", failed is the destructive alert with "Breakdown failed" as its title and the API message as its description, the bar is a group; one outline Retry/Regenerate variant with a `Spinner` while pending. Loading is a `Skeleton` stack named "Loading task", a missing task is a destructive `Alert` with an outline "Back to tasks" button, the empty step list is an `Empty`, dismissed steps are a `Collapsible` with a "Dismissed" chip and an iconed Undo, "All tasks" is a ghost button, and the page stacks with `flex gap`. Screenshot scenarios `task-detail`, `task-detail-steps` and `task-detail-skipped` share `scripts/screenshots/lib/task.mjs`, which creates the task through the create bar inside `act` because the runner asserts the static route first.
- The Tags page on shadcn (ui-rework, tags): the list is a `Table` named "Your tags" whose rows are named by the tag, each with a round outline swatch button that opens the palette, the palette colour's name as an outline `Badge` beside it (`paletteName` in `src/lib/tag-palette.ts`, so hue is never the only signal), the name editing in place behind its pencil, and a square outline delete button in a non-wrapping last column. The palette is a shadcn `RadioGroup` of swatch items: Radix owns the roving focus and the arrow keys (Home and End now move focus without checking, as a native radio group does), the chosen swatch carries a check mark and a foreground border, and `RadioGroupItem` accepts children as its indicator so a caller can draw that mark. The create form is a `Card` ("New tag") holding the Name `Field`, a `FieldSet` whose legend "Color" names the radio group, and a "Create tag" button with a plus that turns into a spinner while it saves. Loading is three skeleton rows in the table's shape behind a "Loading tags" status, empty is an `Empty` with the same sentence as before, and a failed load is a destructive `Alert` ("Could not load tags", the API message) with a "Try again" button. New screenshot scenario `tags`. From this PR's review, `docs/ui-conventions.md` gains two shared rules: a pending button hides its `Spinner` from the accessibility tree (`aria-hidden="true"`) so its name never changes, and a `Card` that must be a form, list item or section is wrapped in that element, never given `asChild`.

## [1.4.0] - 2026-09-11

### Added
- The shadcn skill (`.claude/skills/shadcn/`, installed from shadcn/ui, tracked by `skills-lock.json`) and a "shadcn first" section in `docs/ui-conventions.md`: every visible change loads it and the `frontend-design` skill; tabular data is a `Table`, statuses are visible `Badge` variants, loading, empty and error states are `Skeleton`, `Empty` and `Alert`; missing primitives are added with the shadcn CLI, never hand-rolled. `add-frontend-feature` step 4 says the same.

- "Requests so far" at the bottom of the Request page: every feature request filed to GitHub through `GET /feature-requests`, open first then closed and newest first, each with a stage chip derived from the lifecycle labels, the readiness score and score labels from triage, and an "Open #n on GitHub" link; filing a request refreshes the list. Contract pulled for the new route (ADR 0008). (#22)

### Fixed

- `scripts/product-map.mjs`: released bullets are cut at 100 characters (was 120) and the `[Unreleased]` section at 1,200 (was 1,600), leaving about 1 KB of headroom under the map's 12 KB budget. The budget test failed on the 1.4.0 release branch by 17 bytes once the inventory had grown, which stopped the first ship.

## [1.3.0] - 2026-09-11

### Added

- `docs/product-map.md`: what this app is and what it has, for an agent about to interview a product owner. A hand-written header, then a generated inventory of screens, shell controls, feature folders, contract endpoints, recent releases and ADRs, rebuilt by `npm run product-map` (`scripts/product-map.mjs`, `--sources` lists what it reads).
- Docs-check Rule D: the product map is regenerated and compared on every run, in both modes, before the early return and with no trigger list. A missing map, a generator failure or a difference fails (ADR 0007).
- `docs/ui-conventions.md`: how a control a change adds or alters should look — the primitives in `src/components/ui/` first, an icon on every mode or action control, header controls matching their neighbours, all four screen states, both themes, projector legibility. A request that names a look wins.
- `scripts/screenshot.mjs <scenario>` (scenarios in `scripts/screenshots/`: `tasks`, `theme-focused`) captures the running app in both themes to `docs/screenshots/`, asserting the route and the `dark` class before each shot; failures exit 2 with one line. `add-frontend-feature` now requires the pair on any visible change.

### Changed

- The accent is oxblood instead of indigo, and it is one variable: `--brand` in `src/styles/globals.css` (`oklch(0.42 0.13 30)`), from which `--primary`, `--ring`, `--accent` and `--accent-foreground` derive in both themes with relative colour syntax. Primary buttons, links, the checked checkbox, the focus ring, the AI badges and chips, the progress bar and the brand mark follow it; neutrals, backgrounds, the destructive red and the tag palette do not change. The browser theme-color and the favicon tile carry its hex, `#86281d`, and `tests/accent-tokens.test.ts` keeps them in step with the variable. (#19)

### Fixed

- `staging-label` workflow: runs on Railway's `deployment_status` for `kaizen-tasks / staging` turning `success` (plus a manual `workflow_dispatch` with a `from`/`to` range) instead of on every push to develop, and no longer polls staging. The push-triggered run was itself a check suite that Railway's wait-for-CI waited on while the run waited for Railway to serve the same commit, so the first merge that referenced a harness issue (181077b, issue 19) deadlocked for 15 minutes and its staging deploy was skipped. The run now reads every feat/ or fix/ pull request merged since the previous successful staging deploy, so a superseded deploy loses no issue comment.

## [1.2.0] - 2026-09-10

### Added

- A Light / Dark / System control in the header. The choice applies to the page at once, `System` follows the operating system's `prefers-color-scheme` and keeps following it while it is selected, and the preference is saved to the account through `PATCH /auth/me`, so signing in on another device brings it along. A dark token set was added to `src/styles/globals.css` and the `dark:` variant now reads the `dark` class on `<html>` rather than the media query. The last applied theme is cached per device (`localStorage`, key `kaizen.theme`) and read both by an inline script in `index.html` before first paint and by the initial React render, so there is no flash of the wrong theme on load or right after signing in; the session user's preference still overrides the cache once it loads. The control disables while a save is in flight, so a burst of rapid changes cannot let a late response overwrite a newer choice. See ADR 0006.

## [1.1.1] - 2026-09-10

### Fixed

- `ConversationPanel` no longer shows the "Skip this question" chip while the assistant's greeting is the last message, before any question has been asked. The chip now renders only when the last assistant message carries a non-empty `options` array.

## [1.1.0] - 2026-09-10

### Added

- Contract copy for the feature-request interview: `GET`/`POST /feature-requests/conversation`, the streamed turn route, and `conversationId` on `POST /feature-requests`; model aliases `Conversation`, `ConversationMessage`, `FeatureRequestDraft`, `RubricScore`, `ConversationTurnBody`, `ConversationEvent` and the `StreamBody` helper (ADR 0005).
- `src/api/conversation-stream.ts`: a `text/event-stream` reader that turns the interview's `delta`, `state`, `error`, and `done` frames into typed callbacks, tolerant of comment lines and chunk splits.
- Test doubles for the interview: MSW handlers for the three conversation routes, a `sse()` helper that turns contract events into a `text/event-stream` body, and a scripted four-turn conversation in the fake database that mirrors the API's fake adapter; `POST /feature-requests` now enforces the contract's conversation states (404 for an id that is not the caller's, 409 for one already filed or abandoned).
- Conversation hooks: `useConversation`, `useStartConversation`, and `useSendTurn` (streamed reply text, the assistant's state replacing the cached conversation, the failed-turn path that keeps the PM's message, and an abort on unmount so leaving the page cancels the model).
- `ConversationPanel`: the interview transcript with the streaming reply, a thinking indicator, wrapping option chips, a "Skip this question" chip, the "Your answer" box (Enter sends, Shift+Enter is a newline), and "Start over".
- `DraftPanel`: the readiness chip (sub-scores in its title), the five request fields as read-only text with placeholders, "Review and file", and the wrapping link to the plain form.
- `/request-feature` is an interview: two panels side by side from 900px (stacked below, chips and links wrapping rather than overflowing), the assistant's questions on the left and the live draft on the right; "Review and file" opens the existing form prefilled with the note `Refined with the assistant · readiness N of 20` and files it with `conversationId`; `?mode=form` still shows the plain form. A failed start is toasted and offers "Try again"; leaving the page mid-answer cancels the turn.

### Changed

- The five-field request form moved into `components/FeatureRequestForm.tsx` and now takes `initialValues`, `conversationId`, and a note line; `RequestFeaturePage` is the switchboard over the interview, the review, and the plain form. `src/app/router.tsx` is unchanged.

### Fixed

- Test isolation: sonner keeps its toast list in a module singleton whose `subscribe()` replays every still-active toast to each new subscriber, so a toast raised by one test reappeared under the next test's `<Toaster />`. `tests/setup.ts` now dismisses all toasts in `afterEach`, which is what makes an assertion that no toast was shown mean anything.
- "Try again" waits for the retried conversation read before starting a new interview, so a slow read cannot blank the one just created; review mode has a way back to the interview.

## [1.0.0] - 2026-09-09

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

- The API client sends no bearer token to `GET /health` and never refreshes on its 401, so the footer's health read can never change the session (Codex review of #4).
- README "Selector contract" table now names the register page's own heading ("Create your account"), so a future rename cannot silently reintroduce the login-to-register transition race the smoke test hit.
- `tests/write-version.test.ts`, `tests/docs-check.test.ts`, `tests/build-mock-spec.test.ts`, and `tests/pull-openapi.test.ts` now remove their `mkdtempSync` scratch directories in `afterEach` instead of leaking one per test run.
- `docs-check.sh` escape hatch now exits 1 (not 0) after the marker is written, matching the backend script and the assembly-line wrapper's exit-code contract; CI diffing tries the merge-base-aware three-dot form before falling back to two-dot; hook-mode stdin reads are bounded to 5 seconds so a stuck or silent pipe cannot hang the hook; `--hook`/`--ci` are the only accepted modes.
- Claude Code harness docs corrected against review: `add-frontend-feature` and `test-writer` now cite the real MSW import sources (`server` from `tests/msw/server.ts`, `http` from `msw`); the CHANGELOG-trigger file set in `CLAUDE.md` and the `reviewer` agent now matches `docs-check.sh`'s `is_code()` exactly (adds `vite.config.ts`, `index.html`); `reviewer` gained an `unwrap`-discipline check.
- `promote` workflow's smoke run now uses `SMOKE_AI_TIMEOUT_MS: "180000"`, matching the backend's reviewed workflow and the assembly-line plan; the previous `"90000"` equaled the smoke package's own default and bought nothing for a cold Sonnet 5 breakdown.
- `promote` workflow: the failure-artifact upload now sets `if-no-files-found: ignore`, and the `promote` job now declares an explicit `name: promote`, for parity with the backend's reviewed workflow.
- `.railway/railway.ts`'s `web` service build command is `npm run build` only, not `npm ci && npm run build`: Railpack already installs dependencies and mounts `node_modules/.vite` as a build cache, so the nested `npm ci` collided with that mount and failed with `EBUSY`, the root cause of three failed staging builds.
- `Caddyfile`: the SPA shell now gets an explicit `Cache-Control: no-cache` header via a `route` block wrapping `try_files` and `header /index.html`, so the header evaluates after the SPA rewrite and covers deep links (e.g. `/tasks/...`), not just a direct `/index.html` request; `/assets/*` stays `immutable` and `/version.json` stays `no-store` (see ADR 0001 amendment).
- `promote` workflow: `actions/setup-node` (pinned via `.nvmrc`) now runs right after checkout, ahead of the "Wait for staging" step, since `scripts/wait-for-version.sh` shells out to `node -e` and was previously relying on the runner's default Node instead of the pinned version.
- `scripts/docs-check.sh` Rule A accepts a release cut (a diff that adds a dated version heading), matching the API's gate.
