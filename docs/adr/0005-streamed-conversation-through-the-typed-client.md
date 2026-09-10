# ADR 0005: The interview stream is read through the typed client and parsed by our own SSE reader

Status: accepted, 2026-09-10

## Context

The feature-request interview (spec section 4) needs the assistant's reply word by word. The API
serves it as `text/event-stream` from Express (API ADR 0005), with four events — `delta`, `state`,
`error`, `done` — and `: ping` comment lines while it waits on the model. The browser's
`EventSource` cannot be used: it only issues GET requests and cannot carry the `Authorization`
header the access token lives in (ADR 0003). Adding a streaming client library would put a second
transport next to `src/api/client.ts`, and CLAUDE.md's first unbending rule is that every request
goes through the typed client.

## Decision

The turn route is called through the same `openapi-fetch` client as every other route, with
`parseAs: "stream"`, so `data` is the response's `ReadableStream<Uint8Array>` and the auth
middleware still attaches the bearer token. `src/api/conversation-stream.ts` decodes that stream:
a `TextDecoder`, a string buffer, frames split on a blank line, `event:` and `data:` lines read,
comment lines ignored. Each frame is typed as `ConversationEvent`, the contract's own discriminated
union, derived from `paths` through the new `StreamBody<R>` helper in `src/api/models.ts` — the
event shapes are contract types, not hand-written ones. A non-OK response never reaches the parser:
`ApiError.fromResponse` turns it into the usual `ApiError`, so a 429 or a 409 is presented by
`toastApiError` like every other failure.

## Consequences

- One transport, one auth path, one error presentation; the contract still gates what the app can
  call, including the event payloads.
- Cost: we own an SSE parser. It is about forty lines and unit-tested against hand-built
  `ReadableStream`s (chunk splits, comment lines, escaped newlines inside a `data:` JSON string),
  but a protocol detail the API adds later — multi-line `data:` fields, `id:` or `retry:` lines —
  is our code to update, not a library's.
- Cost: an error that happens after the response headers are sent arrives as an `error` event with
  HTTP status 200. The hook re-raises it as an `ApiError` carrying the event's own code, so
  `toastApiError` still picks the right toast, but `ApiError.status` is 200 for those.
- No proxy change: Caddy's `reverse_proxy` already flushes a `text/event-stream` response as it is
  written, and `flush_interval -1` is explicitly wrong here — the Caddy docs say a negative value
  "does not cancel the request to the backend even if the client disconnects early", which would
  defeat the abort-on-disconnect rule the API relies on to stop the model (spec 3.3 and 4.3).
- The turn carries an `AbortSignal` so leaving the page cancels the request. That makes the hook
  responsible for three things a plain mutation would not need: dropping cache writes that arrive
  after the abort, swallowing the abort error instead of toasting it, and clearing the controller
  when the turn settles.
- `parseAs: "stream"` is an openapi-fetch 0.17 API, and `signal` reaches `fetch` only because
  openapi-fetch spreads unknown init keys into the `Request`. Pinning that version matters more
  than it did.
