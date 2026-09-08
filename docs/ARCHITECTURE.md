# Architecture notes

Deviations from a task brief's verbatim spec, recorded where they happen and why.

## Task 4: MSW must patch `fetch` before openapi-fetch reads it

Task 4's brief specifies `tests/setup.ts` starting the mock server inside a `beforeAll` hook:

```ts
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
```

With that structure, every test in `src/api/client.test.ts` failed with a real `ECONNREFUSED` to
`localhost:3000` instead of being served by MSW.

Root cause: `openapi-fetch`'s `createClient()` resolves its fetch implementation from a default
parameter, `fetch: baseFetch = globalThis.fetch` (`node_modules/openapi-fetch/src/index.js`). `src/api/
client.ts` calls `createClient()` once, at module scope, so that read happens the instant the module is
imported. `@mswjs/interceptors`' `FetchInterceptor` (used by `msw/node`'s `setupServer`) patches
`globalThis.fetch` in place — see `node_modules/@mswjs/interceptors/src/interceptors/fetch/index.ts`,
`this.subscriptions.push(patchesRegistry.applyPatch(globalThis, 'fetch', () => fetchProxy))` — but only
once `server.listen()` actually runs.

Vitest resolves every static import in a test file's module graph — `tests/setup.ts` (a setup file) and
then `src/api/client.test.ts`, which imports `./client` — during collection, before any hook callback
runs. A `beforeAll` callback is registered during that phase but not invoked until the run phase starts,
which is after `client.ts`'s top-level `createClient()` call already captured the pristine,
un-intercepted `fetch`. Patching `globalThis.fetch` afterwards in `beforeAll` has no effect on the
reference `openapi-fetch` already captured, so every request from `client` bypassed MSW and hit the real
network.

Fix applied (`tests/setup.ts`): call `server.listen({ onUnhandledRequest: "error" })` at the setup
file's module scope instead of inside `beforeAll`. Setup files are imported before the test file itself,
so the patch to `globalThis.fetch` lands before `src/api/client.ts` is imported and calls
`createClient()`. `afterEach(() => server.resetHandlers())` and `afterAll(() => server.close())` are
unchanged; only the `listen()` call moved out of `beforeAll` (which is otherwise unused and no longer
imported).

This is the same class of problem the brief's W3 fallback anticipates for the replay request (`fetch`
resolved too early or reused after MSW has moved on) — a fetch-reference timing mismatch between
openapi-fetch and MSW — just surfacing at server-startup time instead of at replay time. The replay test
itself (`fetch(clone)` inside the response middleware) needed no fallback: it passed once the server was
listening before `client.ts` loaded.
