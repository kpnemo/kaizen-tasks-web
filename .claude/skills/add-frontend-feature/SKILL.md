---
name: add-frontend-feature
description: Use when adding or changing anything a user sees in kaizen-tasks-web (a page, a control, a hook, an error state). Walks the feature-folder, test-first, contract-typed, docs-included checklist that every feature change in this repo follows, including the UI conventions and the screenshot every visible change needs.
---

# Add a frontend feature

Every feature change in this repo follows this list, in order. Do not skip the docs steps; the Stop
hook (`scripts/docs-check.sh --hook`) blocks the session until they are done.

1. **Restate the acceptance criteria.** Write them as bullets at the top of your working notes.
   Each one must map to at least one assertion in step 3. If a criterion names an accessible name
   that the smoke test uses (see `README.md`, "Selector contract"), keep that name exactly.
2. **Pull the contract if the API changed.** `npm run api:pull -- --local ../backend/openapi.json`
   (nested checkout) or `npm run api:pull -- develop` (GitHub). Both `src/api/openapi.json` and
   `src/api/types.ts` are committed. Never edit either by hand. If a model alias is missing, add it to
   `src/api/models.ts` derived from `paths`.
3. **Write the failing component test first.** In `src/features/<domain>/<Feature>.test.tsx`, render
   through `renderApp({ route, session })` from `tests/render.tsx`, override MSW with `server.use(...)`
   (`server` from `tests/msw/server.ts`; `ok`, `err`, and `API` from `tests/msw/handlers.ts`; `db`
   and its factories from `tests/msw/db.ts`; `http` from the `msw` package), and assert by role and
   accessible name. Every
   feature needs a happy-path test and an error-state test (the API error rendered through
   `toastApiError` or a field error). Run it and watch it fail for the right reason.
4. **Add or extend the feature folder, composed from shadcn.** Before writing anything a user
   sees, load two skills and follow them: `.claude/skills/shadcn/SKILL.md` (the shadcn skill: its
   Critical Rules are enforced here, its `npx shadcn@latest` CLI is how a component is added and
   how its docs are read) and the `frontend-design` skill (the look: hierarchy, spacing, restraint).
   `src/features/<domain>/` holds the page, `components/`, and `hooks.ts`. Shared primitives go in
   `src/components/` (shadcn under `ui/`), pure helpers in `src/lib/`. A feature never imports
   another feature; share through `api/`, `components/`, or `lib/`. Anything a user sees follows
   `docs/ui-conventions.md`, and in particular: tabular data is a shadcn `Table`, never a
   flex-wrapped list; a status is a `Badge` with a visible variant, never `ghost`; a row's actions sit
   in one non-wrapping column; loading is `Skeleton`, empty is `Empty`, an error is `Alert`; a missing
   primitive is added with `npx shadcn@latest add <name>` (and its docs read with
   `npx shadcn@latest docs <name>`), never hand-rolled. A lucide icon on every mode, state or action
   control, new header controls matching the ones beside them, all four screen states, and both
   themes. The rules apply to what you add or alter, never to controls you leave alone; a request
   that names a specific look wins, inside the accessibility rules.
5. **Add the hook.** Queries and mutations in `hooks.ts` use `client` and `unwrap` from
   `src/api/client.ts`; keys follow `["tasks", filters]`, `["tasks", id]`, `["tags"]`; every mutation
   invalidates the affected keys on success and calls `toastApiError` on error unless the page maps
   field errors itself.
6. **Wire the route and nav.** `src/app/router.tsx` (under `RequireAuth` unless public) and, if it
   needs a link, `src/app/layout.tsx`. Both files are architectural (docs-check Rule C).
7. **Update the docs, before the green run.** Add a bullet to the feature list in `README.md`; add a
   bullet under `[Unreleased]` in `CHANGELOG.md`; if you touched a file matching
   `docs/architectural-files.txt`, write an ADR with the `write-adr` skill. Then run
   `npm run product-map`. The docs come first because `tests/product-map.test.ts` asserts that the
   committed map matches this checkout: a change to the router, the layout, a feature's page, the
   contract, the changelog or an ADR cannot go green until the map is regenerated.
8. **Run the tests to green.** `npm test`, then `npm run lint && npm run typecheck`.
9. **Run `npm run docs:check`.** It must print `docs-check: OK`. Commit everything together, the
   regenerated `docs/product-map.md` included.
10. **Check the projector rules** before you finish: 44px hit areas, visible focus ring, no
    hover-only control, copy in sentence case with plain verbs.
11. **Screenshot the change if it is visible.** Any change a user can see needs a screenshot of the
    changed screen in both themes, in the pull request. See "Screenshots" below. Checklist for a
    visible change: screenshot captured, looked at, committed, and embedded in the pull request.

## Screenshots

Only for a change a user can see. Everything else skips this section.

1. Start the local stack: Postgres and Redis running, the API's `npm run dev` (port 3000), then
   `VITE_PROXY_TARGET=http://localhost:3000 npm run dev` here (port 5173). The proxy target matters:
   a plain `npm run dev` points `/api` at the Prism mock on 4010, which cannot register a user.
   `VITE_PROXY_TARGET` chooses which API the dev server proxies to; `WEB_URL` (default
   `http://localhost:5173`) tells the screenshot runner which dev server to drive, and everything it
   asks the API goes through that origin's `/api/v1`.
2. Pick or write a scenario. `scripts/screenshots/<name>.mjs` exports `{ route, ready, act }`:
   `route` is the path to capture, `ready` waits for something that proves the screen is really
   there (a heading, the control you changed), and the optional `act` drives the screen into the
   state worth showing. `tasks` and `theme-focused` exist; add one named after the screen you changed
   rather than widening an existing one.
3. Run `node scripts/screenshot.mjs <name>`. It registers a throwaway user, logs in through the UI,
   waits for the session to restore, sets the account's theme for each capture, waits for the `dark`
   class to match and asserts the route and the class again immediately before every shot, and
   writes `docs/screenshots/<name>-light.png` and `-dark.png` at 1280x800 (1024x640 at the
   projector's 125%). Chrome must be installed: playwright-core drives it with `channel: "chrome"`.
4. **Open both PNGs with the Read tool and compare them with the spec's "Looks" section** (control
   type, icons, placement, both themes) before you open the pull request. A mismatch is a code
   change, not a caption change. Never describe a screen you have not looked at.
5. Commit the PNGs, then embed them with commit-pinned URLs. The SHA is the commit that added them:
   `git log -1 --format=%H -- docs/screenshots`. If a later commit replaces the images, update the
   SHA in the pull request body.

Pull request body:

```markdown
## What changed

<one paragraph, then the acceptance criteria as a checklist>

## Screenshots

| Light                                                                                                               | Dark                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| ![<name>, light](https://raw.githubusercontent.com/kpnemo/kaizen-tasks-web/<sha>/docs/screenshots/<name>-light.png) | ![<name>, dark](https://raw.githubusercontent.com/kpnemo/kaizen-tasks-web/<sha>/docs/screenshots/<name>-dark.png) |

## Tests

<the failing-then-passing test, and the commands that pass>
```

The one exception: if `scripts/screenshot.mjs` exits 2 it prints exactly one line on stderr, for
example
`Screenshot unavailable: Google Chrome is not installed (...)` or
`Screenshot unavailable: no dev stack on http://localhost:5173 (...)`. Put that exact line in the
pull request body where the images would go, and say what you checked instead. Do not retry blindly,
and do not open a pull request that claims a look nobody has seen.

## Templates

Page:

```tsx
export function ThingPage() {
  const things = useThings();
  if (things.isPending) return <p role="status">Loading things</p>;
  if (things.isError) return <div role="alert">{toApiError(things.error).message}</div>;
  return (
    <div className="space-y-8">
      <h1>Things</h1>
      {/* content */}
    </div>
  );
}
```

Hook:

```ts
export function useThings() {
  return useQuery({
    queryKey: ["things"],
    queryFn: async () => unwrap(await client.GET("/things")).data,
  });
}

export function useCreateThing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateThingBody) =>
      unwrap(await client.POST("/things", { body })).data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["things"] }),
    onError: toastApiError,
  });
}
```

Test:

```tsx
it("shows things and the API error", async () => {
  renderApp({ route: "/things" });
  expect(await screen.findByRole("heading", { name: "Things" })).toBeInTheDocument();
  server.use(http.get(`${API}/things`, () => err("INTERNAL", "Down")));
  // ...
});
```
