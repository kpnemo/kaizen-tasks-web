# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2026-09-11

### Added
- The shadcn skill (`.claude/skills/shadcn/`, installed from shadcn/ui, tracked by `skills-lock.json`) and a "shadcn first" section in `docs/ui-conventions.md`: every visible change loads it and the `frontend-design` skill; tabular data is a `Table`, statuses are visible `Badge` variants, loading, empty and error states are `Skeleton`, `Empty` and `Alert`; missing primitives are added with the shadcn CLI, never hand-rolled. `add-frontend-feature` step 4 says the same.

- "Requests so far" at the bottom of the Request page: every feature request filed to GitHub through `GET /feature-requests`, open first then closed and newest first, each with a stage chip derived from the lifecycle labels, the readiness score and score labels from triage, and an "Open #n on GitHub" link; filing a request refreshes the list. Contract pulled for the new route (ADR 0008). (#22)

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
