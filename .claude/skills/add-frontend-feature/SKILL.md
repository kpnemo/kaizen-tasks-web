---
name: add-frontend-feature
description: Use when adding or changing anything a user sees in kaizen-tasks-web (a page, a control, a hook, an error state). Walks the feature-folder, test-first, contract-typed, docs-included checklist that every feature change in this repo follows.
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
4. **Add or extend the feature folder.** `src/features/<domain>/` holds the page, `components/`, and
   `hooks.ts`. Shared primitives go in `src/components/` (shadcn under `ui/`), pure helpers in
   `src/lib/`. A feature never imports another feature; share through `api/`, `components/`, or `lib/`.
5. **Add the hook.** Queries and mutations in `hooks.ts` use `client` and `unwrap` from
   `src/api/client.ts`; keys follow `["tasks", filters]`, `["tasks", id]`, `["tags"]`; every mutation
   invalidates the affected keys on success and calls `toastApiError` on error unless the page maps
   field errors itself.
6. **Wire the route and nav.** `src/app/router.tsx` (under `RequireAuth` unless public) and, if it
   needs a link, `src/app/layout.tsx`. Both files are architectural (docs-check Rule C).
7. **Run the tests to green.** `npm test`, then `npm run lint && npm run typecheck`.
8. **Update the docs.** Add a bullet to the feature list in `README.md`; add a bullet under
   `[Unreleased]` in `CHANGELOG.md`; if you touched a file matching `docs/architectural-files.txt`,
   write an ADR with the `write-adr` skill.
9. **Run `npm run docs:check`.** It must print `docs-check: OK`.
10. **Check the projector rules** before you finish: 44px hit areas, visible focus ring, no
    hover-only control, copy in sentence case with plain verbs.

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
