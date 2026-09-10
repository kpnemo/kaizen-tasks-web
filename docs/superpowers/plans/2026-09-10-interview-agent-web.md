# Interview agent (web lane) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/request-feature` into a two-panel interview — a streamed chat with the Kaizen assistant on the left and the live five-field draft on the right — that ends by opening the existing feature-request form prefilled and carrying `conversationId`.

**Architecture:** Three new conversation routes are consumed through the existing typed `openapi-fetch` client; the turn route is called with `parseAs: "stream"` and its `ReadableStream` body is decoded by a new shared, React-free SSE parser in `src/api/conversation-stream.ts`. Server state stays in TanStack Query: one query key `["feature-request","conversation"]` holds the whole `Conversation`, and the stream's `state` event replaces it. `RequestFeaturePage` becomes a switchboard over three modes (interview, review, plain form); the existing form becomes a component that accepts `initialValues`, `conversationId`, and a note line. Each turn is tied to an `AbortController` that fires on unmount, so leaving the page cancels the request and the API stops the model (spec 3.3). No proxy change is needed: Caddy's `reverse_proxy` already flushes `text/event-stream` responses immediately, and `flush_interval -1` must not be set because it "does not cancel the request to the backend even if the client disconnects early", which would defeat the abort-on-disconnect rule (spec 4.3).

**Tech Stack:** React 19, TypeScript strict, Vite 7, Tailwind 4, shadcn/ui, TanStack Query 5, react-router 7, openapi-fetch 0.17.0 (`parseAs: "stream"` → `data` is `Response["body"]`, i.e. `ReadableStream<Uint8Array> | null`), Vitest 5 + Testing Library + MSW 2.15, Caddy.

**Spec:** `../../../../docs/superpowers/specs/2026-09-10-agentic-feature-request-design.md` (repo-absolute: `webapp/docs/superpowers/specs/2026-09-10-agentic-feature-request-design.md`). Sections 1, 2, 3.2, 3.3 (the contract this lane consumes), 4, 5, 6.

## Global Constraints

Every task's requirements implicitly include this section. Rules copied verbatim from the spec and from `CLAUDE.md`.

**Working directory:** every command in this plan runs from the web checkout root `/Users/Mike.Bogdanovsky/Projects/nice-product-workshop-Sep.2026/webapp/frontend`. No step changes directory, and no path in this plan is relative to anything else.

**From `CLAUDE.md` ("Rules that do not bend"):**

- Every request goes through `src/api/client.ts`, typed from `src/api/openapi.json`. The app cannot call a route the contract lacks. Pull with `npm run api:pull`; never hand-edit `openapi.json` or `types.ts`. Model types derive from `paths` in `src/api/models.ts`.
- Server state is TanStack Query through hooks in `<domain>/hooks.ts`; there is no global state library.
- The access token lives in `src/api/auth-store.ts` in memory only (ADR 0003). A 401 is handled by the client middleware: one refresh, one replay, then logout.
- Every user-visible error is an `ApiError` rendered through `toastApiError` or a field error.
- Requests use the relative `/api/v1` on the page origin. No absolute API origin exists (ADR 0001).
- Every feature ships a happy-path test and an error-state test (Vitest, Testing Library, MSW).
- Projector rules: 18px base, 44px hit areas, visible focus ring, no hover-only control.
- The smoke test's accessible names (`README.md`, "Selector contract") are a cross-repo contract.
- A feature never imports another feature. ESLint enforces the feature rule.

**Projector rules (spec 2):** 18px base, 44px chips and buttons, visible focus, no hover-only control.

**Layout (spec 2 and 4.1):** two panels side by side from 900px, stacked below, Tailwind classes; 44px chips; the chips' accessible names are their text. The chat panel is about 60% of the width.

**Accessibility (spec 4.4):** "Chips and buttons are real buttons with their visible text as the name."

**Docs-check (`scripts/docs-check.sh`, Stop hook and CI):**

- Rule A: any code change needs a bullet under `[Unreleased]` in `CHANGELOG.md` (a release cut that adds a dated version heading also counts). "Code" is `src/*`, `.railway/*`, `scripts/*`, `package.json`, `Caddyfile`, `vite.config.ts`, `index.html`.
- Rule B: a change to `src/api/openapi.json` needs `src/api/types.ts` regenerated with no diff.
- Rule C: a change to a file matching `docs/architectural-files.txt` needs an ADR in the change.
- The gate diffs the whole branch against the merge base with `origin/develop`, so an ADR or bullet added in an earlier task on this branch still satisfies later tasks — but every task in this plan adds its own `CHANGELOG.md` bullet anyway.
- `npm run docs:check` must print `docs-check: OK` before every commit.

**Architectural files (`docs/architectural-files.txt`), verbatim:**

```
src/api/**
Caddyfile
.railway/**
src/app/router.tsx
src/main.tsx
```

Tasks 1 and 2 both touch `src/api/**` and are therefore ADR-bearing. `Caddyfile`, `.railway/**`, `src/app/router.tsx`, and `src/main.tsx` are **not** changed by this plan (spec 4: "`src/app/router.tsx` is unchanged"; spec 4.3: "`Caddyfile` is unchanged").

**Branch and commits:**

- All work happens on `feat/interview-agent`, branched off `develop`. The controller opens the PR to `develop`; no task in this plan pushes to `develop` or `main` and no task merges anything.
- Every commit message ends with the trailer:

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
```

**Contract:** the contract comes from the API repo's branch `feat/interview-agent` (spec 6, milestone A1). Before the PR to `develop` is opened, re-pull from `develop` (`npm run api:pull -- develop`) so the committed copy matches what `develop` serves.

**Decisions this plan makes where the spec left a detail open** (each is restated in the task that first needs it, and used consistently everywhere after):

1. **`ConversationEvent` is `{ event, data }`,** discriminated on `event` (`"delta" | "state" | "error" | "done"`), matching the wire format `event: <name>\ndata: <json>` of spec 3.3. Task 1 asserts this against the pulled contract with `expectTypeOf`.
2. **A `StreamBody<R>` helper** joins `JsonBody`/`JsonRequest` in `models.ts`, because the turn route's 200 content key is `text/event-stream`, not `application/json`.
3. **`useConversation(enabled: boolean)`** takes an enabled flag so the query does not fire while `GET /health` says the feature is unavailable.
4. **Skip sends `{ content: "(skipped)", skip: true }`** — the contract requires `content` to be 1..2000 characters, and the API records exactly that string (spec 3.2).
5. **Auto-start:** the page POSTs a new conversation exactly once when the GET resolves to `null` (spec 2, "otherwise the API creates one"), guarded by a ref that re-arms whenever a conversation exists.
6. **The plain form is a real link with a query parameter** (`/request-feature?mode=form`) so "Skip the interview, fill the form" has role `link` as the selector contract requires; "Review and file" is a button that flips local state.
7. **The failed turn keeps the PM's message as a local bubble and restores the text into the answer box,** so pressing Send resends it; the resend replaces the bubble rather than duplicating it.
8. **Readiness chip copy:** `Readiness <n> of 20`, `title` = `Clarity <c> · Complexity <x> · Risk <r>`; before the first score the chip reads `Readiness not scored yet` with no title.
9. **Empty draft placeholder:** `Not filled in yet`.
10. **"Review and file" is enabled when `status === "ready" || questionCount >= 8`.** The API sets `ready` in both spec-2 cases; the count is the belt-and-braces path.
11. **Once `status !== "open"` the answer box, the chips and the skip chip are hidden or disabled** — the turn route answers 409 for a non-open conversation (spec 3.2). "Start over" stays enabled.
12. **The turn is abortable.** `useSendTurn` makes an `AbortController` per turn, passes its signal to `client.POST`, aborts it when the panel unmounts, drops late `delta`/`state` writes, and swallows the abort instead of toasting it. Spec 3.3: "If the client disconnects, the model stream is aborted and nothing is persisted."
13. **Completion is the end of the body, not the `done` event.** `readConversationStream` resolves when the reader reports `done`; the server calls `res.end()` right after the `done` event (spec 3.2). A stream that closes without a `state` or an `error` is an `UPSTREAM_ERROR` the PM can resend past.
14. **A failed start is recoverable in place.** A failed `GET` and a failed `POST` both surface through `toastApiError` and leave an explicit "Try again" button that re-arms the auto-start. No bare `role="alert"` block stands in for the toast.
15. **`Caddyfile` is not touched** (spec 4.3, corrected 2026-09-10): Caddy already flushes `text/event-stream` immediately, and `flush_interval -1` would keep the backend request alive after the client disconnects.
16. **Chips and the plain-form link wrap on a narrow screen.** The shared `Button` is `whitespace-nowrap shrink-0 h-9`; chips override all three with `min-h-11 h-auto max-w-full shrink whitespace-normal` (tailwind-merge keeps the later utility of each group), both panels carry `min-w-0`, and the grid's tracks are `minmax(0,3fr)` / `minmax(0,2fr)` so a long chip cannot force a horizontal scrollbar at or below 900px.

---

### Task 1: Contract pull, model aliases, ADR 0005

**Files:**

- Modify: `src/api/openapi.json` (replaced by `npm run api:pull`, never hand-edited)
- Modify: `src/api/types.ts` (regenerated, never hand-edited)
- Modify: `src/api/models.ts`
- Modify: `src/api/models.test.ts`
- Create: `docs/adr/0005-streamed-conversation-through-the-typed-client.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `CHANGELOG.md`

**Interfaces:**

- Consumes: `JsonBody<R>`, `JsonRequest<R>`, `ErrorCode` from `src/api/models.ts`; `paths` from `src/api/types.ts`.
- Produces, all exported from `src/api/models.ts`:
  - `type StreamBody<R> = R extends { content: { "text/event-stream": infer B } } ? B : never`
  - `type Conversation` — `{ id: string; status: "open" | "ready" | "filed" | "abandoned"; messages: ConversationMessage[]; draft: FeatureRequestDraft; score: RubricScore | null; questionCount: number; stillMissing: string[]; issueNumber: number | null; createdAt: string; updatedAt: string }`
  - `type ConversationMessage` — `{ id: string; role: "assistant" | "user"; content: string; at: string; options?: string[]; skipped?: boolean }`
  - `type FeatureRequestDraft` — keys `"title" | "problem" | "proposedBehavior" | "acceptanceCriteria" | "outOfScope"`, values `string`
  - `type RubricScore` — `{ clarity: number; complexity: number; risk: number; archChange: boolean; readiness: number; reasons: { clarity: string; complexity: string; risk: string } }`
  - `type ConversationTurnBody` — `{ content: string; skip?: boolean }`
  - `type ConversationEvent` — `{ event: "delta"; data: { text: string } } | { event: "state"; data: { conversation: Conversation } } | { event: "error"; data: { code: ErrorCode; message: string } } | { event: "done"; data: Record<string, never> }`
  - `FeatureRequestBody` (existing alias) gains an optional `conversationId?: string` from the pulled contract.

- [ ] **Step 1: Branch off `develop`**

```bash
git fetch origin
git checkout develop
git pull --ff-only
git checkout -b feat/interview-agent
```

- [ ] **Step 2: Write the failing type test**

Append this block to `src/api/models.test.ts` (inside the file, after the existing `describe`), and extend the existing `import type { … } from "./models";` list with `Conversation`, `ConversationEvent`, `ConversationMessage`, `ConversationTurnBody`, `FeatureRequestBody`, `FeatureRequestDraft`, `RubricScore`:

```ts
describe("conversation models derived from the contract", () => {
  it("match the interview contract (spec 3.2 and 3.3)", () => {
    expectTypeOf<Conversation["status"]>().toEqualTypeOf<
      "open" | "ready" | "filed" | "abandoned"
    >();
    expectTypeOf<Conversation["messages"]>().toEqualTypeOf<ConversationMessage[]>();
    expectTypeOf<Conversation["questionCount"]>().toEqualTypeOf<number>();
    expectTypeOf<Conversation["stillMissing"]>().toEqualTypeOf<string[]>();
    expectTypeOf<Conversation["issueNumber"]>().toEqualTypeOf<number | null>();
    expectTypeOf<ConversationMessage["role"]>().toEqualTypeOf<"assistant" | "user">();
    expectTypeOf<ConversationMessage["options"]>().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<ConversationMessage["skipped"]>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<keyof FeatureRequestDraft>().toEqualTypeOf<
      "title" | "problem" | "proposedBehavior" | "acceptanceCriteria" | "outOfScope"
    >();
    expectTypeOf<FeatureRequestDraft["title"]>().toEqualTypeOf<string>();
    expectTypeOf<RubricScore["readiness"]>().toEqualTypeOf<number>();
    expectTypeOf<RubricScore["archChange"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ConversationTurnBody["content"]>().toEqualTypeOf<string>();
    expectTypeOf<ConversationTurnBody["skip"]>().toEqualTypeOf<boolean | undefined>();
    // The stream's event union is discriminated on `event`, mirroring the wire format
    // `event: <name>\ndata: <json>` (spec 3.3).
    expectTypeOf<ConversationEvent["event"]>().toEqualTypeOf<
      "delta" | "state" | "error" | "done"
    >();
    expectTypeOf<Extract<ConversationEvent, { event: "delta" }>["data"]>().toEqualTypeOf<{
      text: string;
    }>();
    expectTypeOf<Extract<ConversationEvent, { event: "state" }>["data"]>().toEqualTypeOf<{
      conversation: Conversation;
    }>();
    expectTypeOf<
      Extract<ConversationEvent, { event: "error" }>["data"]["message"]
    >().toEqualTypeOf<string>();
    // The existing submit body carries the conversation (spec 3.2, row 4).
    expectTypeOf<FeatureRequestBody["conversationId"]>().toEqualTypeOf<string | undefined>();
  });
});
```

- [ ] **Step 3: Run the type test to verify it fails**

Run: `npm run typecheck`

Expected: FAIL with `error TS2305: Module '"./models"' has no exported member 'Conversation'.` (and the same for `ConversationMessage`, `ConversationTurnBody`, `ConversationEvent`, `FeatureRequestDraft`, `RubricScore`).

`expectTypeOf` is erased at runtime, so `npm run typecheck` — not `vitest` — is this test's runner.

- [ ] **Step 4: Pull the contract from the API branch and regenerate the types**

```bash
npm run api:pull -- feat/interview-agent
npm run api:types
```

`api:pull` already runs `api:types`; running it again must leave `src/api/types.ts` byte-identical (that is exactly what docs-check Rule B asserts).

- [ ] **Step 5: Verify the pulled contract carries the three routes and the event union**

```bash
node -e '
const s = JSON.parse(require("fs").readFileSync("src/api/openapi.json", "utf8"));
const p = s.paths;
for (const route of ["/feature-requests/conversation", "/feature-requests/conversation/{id}/messages"]) {
  if (!p[route]) throw new Error("missing route " + route);
}
if (!p["/feature-requests/conversation/{id}/messages"].post.responses["200"].content["text/event-stream"])
  throw new Error("the turn route has no text/event-stream 200");
if (!s.components.schemas.ConversationEvent) throw new Error("no ConversationEvent component");
console.log("contract OK:", Object.keys(p).filter((k) => k.includes("conversation")).join(", "));
'
```

Expected: `contract OK: /feature-requests/conversation, /feature-requests/conversation/{id}/messages`

- [ ] **Step 6: Add the model aliases**

Append to `src/api/models.ts`, after the existing `FeatureRequestResult` alias:

```ts
/** The body of a response whose content is the SSE stream. openapi-typescript keys stream content
 *  by its media type exactly as it keys JSON, so the turn route's events are reachable from `paths`
 *  like every other model (spec 3.3). */
export type StreamBody<R> = R extends { content: { "text/event-stream": infer B } } ? B : never;

export type Conversation = JsonBody<
  paths["/feature-requests/conversation"]["get"]["responses"][200]
>["data"];
export type ConversationMessage = Conversation["messages"][number];
export type FeatureRequestDraft = Conversation["draft"];
export type RubricScore = NonNullable<Conversation["score"]>;
export type ConversationTurnBody = JsonRequest<
  paths["/feature-requests/conversation/{id}/messages"]["post"]["requestBody"]
>;
/** The discriminated union the turn route streams: `{ event, data }`, one per `event:`/`data:` frame. */
export type ConversationEvent = StreamBody<
  paths["/feature-requests/conversation/{id}/messages"]["post"]["responses"][200]
>;
```

- [ ] **Step 7: Run the type test to verify it passes**

Run: `npm run typecheck && npx vitest run src/api/models.test.ts`

Expected: typecheck clean; `2 passed` in `src/api/models.test.ts`.

- [ ] **Step 8: Write ADR 0005 with the `write-adr` skill**

Follow `.claude/skills/write-adr/SKILL.md` (numbering: next after 0004; title states the decision, not the topic; consequences include at least one cost). Create `docs/adr/0005-streamed-conversation-through-the-typed-client.md`:

```markdown
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
```

- [ ] **Step 9: Link the ADR from `docs/ARCHITECTURE.md`**

In `docs/ARCHITECTURE.md`, at the end of the "Contract copy and typed client" section, add:

```markdown
One route is not JSON: `POST /feature-requests/conversation/{id}/messages` answers with
`text/event-stream`. It goes through the same client with `parseAs: "stream"`, and
`src/api/conversation-stream.ts` decodes the frames into the contract's own `ConversationEvent`
union (ADR 0005).
```

- [ ] **Step 10: Add the CHANGELOG bullet**

Under `## [Unreleased]` in `CHANGELOG.md`, add an `### Added` section (create it if absent) with:

```markdown
- Contract copy for the feature-request interview: `GET`/`POST /feature-requests/conversation`, the streamed turn route, and `conversationId` on `POST /feature-requests`; model aliases `Conversation`, `ConversationMessage`, `FeatureRequestDraft`, `RubricScore`, `ConversationTurnBody`, `ConversationEvent` and the `StreamBody` helper (ADR 0005).
```

- [ ] **Step 11: Run the docs gate**

Run: `npm run docs:check`

Expected: `docs-check: OK`

- [ ] **Step 12: Commit**

```bash
git add src/api/openapi.json src/api/types.ts src/api/models.ts src/api/models.test.ts \
  docs/adr/0005-streamed-conversation-through-the-typed-client.md docs/ARCHITECTURE.md CHANGELOG.md
git commit -m "$(cat <<'EOM'
feat: pull the interview contract and derive its model types

ADR 0005 records reading the streamed turn route through the typed client.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOM
)"
```

---

### Task 2: The SSE parser

**Files:**

- Create: `src/api/conversation-stream.ts`
- Test: `src/api/conversation-stream.test.ts`

**Interfaces:**

- Consumes: `Conversation`, `ConversationEvent` from `src/api/models.ts` (Task 1).
- Produces, exported from `src/api/conversation-stream.ts`:
  - `type ConversationStreamError = Extract<ConversationEvent, { event: "error" }>["data"]` — `{ code: ErrorCode; message: string }`
  - `type ConversationStreamHandlers = { onDelta: (text: string) => void; onState: (conversation: Conversation) => void; onError: (failure: ConversationStreamError) => void; onDone: () => void }`
  - `function readConversationStream(stream: ReadableStream<Uint8Array>, handlers: ConversationStreamHandlers): Promise<void>` — resolves when the body ends, which is what the client treats as completion (spec 3.2: the server calls `res.end()` right after the `done` event); never throws for a malformed frame (it skips it).

- [ ] **Step 1: Write the failing test**

Create `src/api/conversation-stream.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { readConversationStream, type ConversationStreamHandlers } from "./conversation-stream";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function spies() {
  return {
    onDelta: vi.fn(),
    onState: vi.fn(),
    onError: vi.fn(),
    onDone: vi.fn(),
  } satisfies ConversationStreamHandlers;
}

const CONVERSATION = { id: "c-1", status: "open", questionCount: 1 };

describe("readConversationStream", () => {
  it("dispatches deltas in order, then the state, then done", async () => {
    const handlers = spies();
    await readConversationStream(
      streamOf(
        'event: delta\ndata: {"text":"Got it. "}\n\n',
        'event: delta\ndata: {"text":"Who has the problem?"}\n\n',
        `event: state\ndata: ${JSON.stringify({ conversation: CONVERSATION })}\n\n`,
        "event: done\ndata: {}\n\n",
      ),
      handlers,
    );
    expect(handlers.onDelta.mock.calls).toEqual([["Got it. "], ["Who has the problem?"]]);
    expect(handlers.onState).toHaveBeenCalledExactlyOnceWith(CONVERSATION);
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it("ignores comment lines such as the 15 second ping", async () => {
    const handlers = spies();
    await readConversationStream(
      streamOf(
        ": ping\n\n",
        ': ping\n\nevent: delta\ndata: {"text":"hi"}\n\n',
        "event: done\ndata: {}\n\n",
      ),
      handlers,
    );
    expect(handlers.onDelta.mock.calls).toEqual([["hi"]]);
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });

  it("reassembles an event split across chunks", async () => {
    const handlers = spies();
    await readConversationStream(
      streamOf("event: de", 'lta\ndata: {"te', 'xt":"split"}', "\n\nevent: done\ndata: {}\n\n"),
      handlers,
    );
    expect(handlers.onDelta.mock.calls).toEqual([["split"]]);
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });

  it("keeps an escaped newline inside a data line's JSON string", async () => {
    const handlers = spies();
    await readConversationStream(
      streamOf(
        'event: delta\ndata: {"text":"first line\\nsecond line"}\n\n',
        "event: done\ndata: {}\n\n",
      ),
      handlers,
    );
    expect(handlers.onDelta.mock.calls).toEqual([["first line\nsecond line"]]);
  });

  it("dispatches an error event instead of a state", async () => {
    const handlers = spies();
    await readConversationStream(
      streamOf(
        'event: delta\ndata: {"text":"Got it. "}\n\n',
        'event: error\ndata: {"code":"UPSTREAM_ERROR","message":"The assistant did not answer"}\n\n',
        "event: done\ndata: {}\n\n",
      ),
      handlers,
    );
    expect(handlers.onError).toHaveBeenCalledExactlyOnceWith({
      code: "UPSTREAM_ERROR",
      message: "The assistant did not answer",
    });
    expect(handlers.onState).not.toHaveBeenCalled();
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });

  it("skips a frame with an unknown name or unparseable data", async () => {
    const handlers = spies();
    await readConversationStream(
      streamOf(
        "event: heartbeat\ndata: {}\n\n",
        "event: delta\ndata: not json\n\n",
        'event: delta\ndata: {"text":"ok"}\n\n',
        "event: done\ndata: {}\n\n",
      ),
      handlers,
    );
    expect(handlers.onDelta.mock.calls).toEqual([["ok"]]);
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });

  it("dispatches a final frame that arrives without a trailing blank line", async () => {
    const handlers = spies();
    await readConversationStream(streamOf("event: done\ndata: {}"), handlers);
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/api/conversation-stream.test.ts`

Expected: FAIL — `Failed to resolve import "./conversation-stream" from "src/api/conversation-stream.test.ts". Does the file exist?`

- [ ] **Step 3: Write the parser**

Create `src/api/conversation-stream.ts`:

```ts
import type { Conversation, ConversationEvent } from "./models";

/** The payload of one `ConversationEvent` member, by name. */
type PayloadOf<K extends ConversationEvent["event"]> = Extract<
  ConversationEvent,
  { event: K }
>["data"];

/** The `error` event's payload: the API's own error code and message (spec 3.3). */
export type ConversationStreamError = PayloadOf<"error">;

export type ConversationStreamHandlers = {
  onDelta: (text: string) => void;
  onState: (conversation: Conversation) => void;
  onError: (failure: ConversationStreamError) => void;
  onDone: () => void;
};

/** A frame ends at a blank line; CRLF is tolerated in case a proxy rewrites the line endings. */
const FRAME_END = /\r?\n\r?\n/;

function dispatch(frame: string, handlers: ConversationStreamHandlers): void {
  let name = "";
  const data: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line === "" || line.startsWith(":")) continue; // blank or comment (`: ping`)
    if (line.startsWith("event:")) name = line.slice("event:".length).trim();
    else if (line.startsWith("data:")) data.push(line.slice("data:".length).replace(/^ /, ""));
  }
  if (name === "" || data.length === 0) return;
  let payload: unknown;
  try {
    payload = JSON.parse(data.join("\n"));
  } catch {
    return; // a frame we cannot read is skipped; `done` still ends the turn
  }
  switch (name) {
    case "delta":
      handlers.onDelta((payload as PayloadOf<"delta">).text);
      return;
    case "state":
      handlers.onState((payload as PayloadOf<"state">).conversation);
      return;
    case "error":
      handlers.onError(payload as PayloadOf<"error">);
      return;
    case "done":
      handlers.onDone();
      return;
    default:
      return;
  }
}

/** Reads one `text/event-stream` body to the end, dispatching each event (spec 3.3). Resolves when
 *  the body closes: the server calls `res.end()` right after the `done` event, and the end of the
 *  body — not the `done` event alone — is what the client treats as completion (spec 3.2).
 *  A malformed frame is skipped, never thrown. */
export async function readConversationStream(
  stream: ReadableStream<Uint8Array>,
  handlers: ConversationStreamHandlers,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (let end = FRAME_END.exec(buffer); end; end = FRAME_END.exec(buffer)) {
        dispatch(buffer.slice(0, end.index), handlers);
        buffer = buffer.slice(end.index + end[0].length);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim() !== "") dispatch(buffer, handlers);
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/api/conversation-stream.test.ts && npm run lint && npm run typecheck`

Expected: `7 passed`, lint clean, typecheck clean.

- [ ] **Step 5: Add the CHANGELOG bullet**

Under `## [Unreleased]` → `### Added` in `CHANGELOG.md`:

```markdown
- `src/api/conversation-stream.ts`: a `text/event-stream` reader that turns the interview's `delta`, `state`, `error`, and `done` frames into typed callbacks, tolerant of comment lines and chunk splits.
```

- [ ] **Step 6: Run the docs gate**

Run: `npm run docs:check`

Expected: `docs-check: OK` (Rule C is satisfied by ADR 0005 from Task 1, which is in this branch's diff).

- [ ] **Step 7: Commit**

```bash
git add src/api/conversation-stream.ts src/api/conversation-stream.test.ts CHANGELOG.md
git commit -m "$(cat <<'EOM'
feat: SSE reader for the interview conversation stream

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOM
)"
```

---

### Task 3: MSW conversation fixtures, store, and handlers

**Files:**

- Modify: `tests/msw/fixtures.ts`
- Modify: `tests/msw/db.ts`
- Modify: `tests/msw/handlers.ts`
- Test: `tests/msw/conversation-handlers.test.ts` (create)

**Interfaces:**

- Consumes: `Conversation`, `ConversationEvent`, `ConversationMessage`, `ConversationTurnBody`, `FeatureRequestBody`, `FeatureRequestDraft`, `RubricScore` from `src/api/models.ts` (Task 1); `client`, `unwrap` from `src/api/client.ts`; `readConversationStream` from `src/api/conversation-stream.ts` (Task 2).
- Produces:
  - `tests/msw/fixtures.ts`: `const GREETING: string`; `const EMPTY_DRAFT: FeatureRequestDraft`; `function makeMessage(overrides: Partial<ConversationMessage> & Pick<ConversationMessage, "id" | "role" | "content">): ConversationMessage`; `function makeConversation(overrides: Partial<Conversation> & Pick<Conversation, "id">): Conversation`
  - `tests/msw/db.ts`: `const C_OPEN = "c-1"`; `db.conversation: Conversation | null`; `db.openConversation(overrides?: Partial<Conversation>): Conversation`; `db.startConversation(): Conversation`; `db.advanceTurn(content: string, skip: boolean): { deltas: string[]; conversation: Conversation }`
  - `tests/msw/handlers.ts`: `function sse(events: ConversationEvent[]): HttpResponse`; `conversationHandlers` added to the exported `handlers` array; the existing `POST /feature-requests` handler accepts `conversationId` and enforces the spec's states — only `open` or `ready` may be attached, `filed` or `abandoned` answers 409 `CONFLICT`, and an unknown or another caller's id answers 404 `NOT_FOUND` (spec 3.2).

- [ ] **Step 1: Write the failing test**

Create `tests/msw/conversation-handlers.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { authStore } from "@/api/auth-store";
import { client, unwrap } from "@/api/client";
import { readConversationStream } from "@/api/conversation-stream";
import type { Conversation } from "@/api/models";
import { C_OPEN, db } from "./db";
import { demoUser, GREETING } from "./fixtures";

/** The five request fields, so the submit cases differ only in their `conversationId`. */
const FIVE = {
  title: "Snooze a task until a date",
  problem: "Tasks I cannot act on yet clutter the list.",
  proposedBehavior: "A snooze button hides the task until a date.",
  acceptanceCriteria: "It reappears on the chosen date.",
  outOfScope: "Recurring snoozes.",
};

type TurnResult = { deltas: string[]; state: Conversation | null; done: boolean; status: number };

/** Drives one turn through the typed client and the real parser, so the handlers are exercised the
 *  way the app uses them. A non-OK answer has no stream body; its status is returned instead.
 *  `seen` is an object rather than two `let`s because TypeScript does not track assignments made
 *  inside a callback. */
async function turn(id: string, content: string, skip = false): Promise<TurnResult> {
  const result = await client.POST("/feature-requests/conversation/{id}/messages", {
    params: { path: { id } },
    body: { content, skip },
    parseAs: "stream",
  });
  const deltas: string[] = [];
  const seen: { state: Conversation | null; done: boolean } = { state: null, done: false };
  const body = result.data;
  if (body) {
    await readConversationStream(body, {
      onDelta: (text) => deltas.push(text),
      onState: (conversation) => {
        seen.state = conversation;
      },
      onError: () => {},
      onDone: () => {
        seen.done = true;
      },
    });
  }
  return { deltas, state: seen.state, done: seen.done, status: result.response.status };
}

describe("conversation MSW handlers", () => {
  beforeEach(() => {
    authStore.setSession({ token: "test-token", user: demoUser });
  });

  it("404s before a conversation exists, then creates one with the greeting", async () => {
    const missing = await client.GET("/feature-requests/conversation");
    expect(missing.response.status).toBe(404);

    const created = unwrap(await client.POST("/feature-requests/conversation", {})).data;
    expect(created.status).toBe("open");
    expect(created.messages).toHaveLength(1);
    expect(created.messages[0]).toMatchObject({ role: "assistant", content: GREETING });

    const fetched = unwrap(await client.GET("/feature-requests/conversation")).data;
    expect(fetched.id).toBe(created.id);
  });

  it("streams deltas then a state carrying the new question and its options", async () => {
    const conversation = db.openConversation();
    const first = await turn(conversation.id, "I want to snooze tasks");
    expect(first.deltas.length).toBeGreaterThan(1);
    expect(first.done).toBe(true);
    expect(first.state?.questionCount).toBe(1);
    const last = first.state?.messages.at(-1);
    expect(last?.role).toBe("assistant");
    expect(last?.content).toBe(first.deltas.join(""));
    expect(last?.options).toHaveLength(3);
  });

  it("counts a skip and reaches ready on the fourth turn", async () => {
    const conversation = db.openConversation();
    await turn(conversation.id, "A supervisor before coaching");
    await turn(conversation.id, "(skipped)", true);
    const third = await turn(conversation.id, "The task leaves the list");
    expect(third.state?.questionCount).toBe(3);
    const fourth = await turn(conversation.id, "That is all");
    expect(fourth.state?.status).toBe("ready");
    expect(fourth.state?.score?.readiness).toBe(16);
    expect(fourth.state?.draft.acceptanceCriteria).not.toBe("");
    expect(fourth.state?.messages.some((m) => m.skipped === true)).toBe(true);
  });

  it("409s on a conversation that is no longer open and 404s on someone else's", async () => {
    const conversation = db.openConversation({ status: "ready" });
    expect((await turn(conversation.id, "hello")).status).toBe(409);
    expect((await turn("c-nope", "hello")).status).toBe(404);
  });

  it("marks the conversation filed when the request carries its id", async () => {
    const conversation = db.openConversation({ status: "ready" });
    const filed = unwrap(
      await client.POST("/feature-requests", {
        body: { ...FIVE, conversationId: conversation.id },
      }),
    ).data;
    expect(filed.issueNumber).toBe(42);
    expect(db.conversation?.status).toBe("filed");
    expect(db.conversation?.issueNumber).toBe(42);
  });

  it("rejects a conversation that cannot be attached", async () => {
    db.openConversation({ status: "filed", issueNumber: 7 });
    const conflict = await client.POST("/feature-requests", {
      body: { ...FIVE, conversationId: C_OPEN },
    });
    expect(conflict.response.status).toBe(409);

    db.openConversation({ status: "abandoned" });
    const abandoned = await client.POST("/feature-requests", {
      body: { ...FIVE, conversationId: C_OPEN },
    });
    expect(abandoned.response.status).toBe(409);

    db.openConversation();
    const someoneElse = await client.POST("/feature-requests", {
      body: { ...FIVE, conversationId: "c-not-mine" },
    });
    expect(someoneElse.response.status).toBe(404);
    expect(db.conversation?.status).toBe("open");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/msw/conversation-handlers.test.ts`

Expected: FAIL — `TypeError: db.openConversation is not a function`, and the first case fails with an MSW `onUnhandledRequest: "error"` failure for `POST /api/v1/feature-requests/conversation`.

- [ ] **Step 3: Add the conversation fixtures**

Append to `tests/msw/fixtures.ts` (and extend its `import type` line to `import type { Conversation, ConversationMessage, FeatureRequestDraft, User } from "@/api/models";`):

```ts
/** The fixed first assistant message the API writes with no model call (spec 2, "Start"). */
export const GREETING =
  "Tell me the idea in a sentence or two: who has the problem and what would be different.";

export const EMPTY_DRAFT: FeatureRequestDraft = {
  title: "",
  problem: "",
  proposedBehavior: "",
  acceptanceCriteria: "",
  outOfScope: "",
};

export function makeMessage(
  overrides: Partial<ConversationMessage> & Pick<ConversationMessage, "id" | "role" | "content">,
): ConversationMessage {
  return { at: ISO, ...overrides };
}

/** A fresh open conversation: the greeting, an empty draft, no score. */
export function makeConversation(
  overrides: Partial<Conversation> & Pick<Conversation, "id">,
): Conversation {
  return {
    status: "open",
    messages: [makeMessage({ id: "m-greeting", role: "assistant", content: GREETING })],
    draft: EMPTY_DRAFT,
    score: null,
    questionCount: 0,
    stillMissing: [],
    issueNumber: null,
    createdAt: ISO,
    updatedAt: ISO,
    ...overrides,
  };
}
```

- [ ] **Step 4: Add the conversation store to the fake database**

In `tests/msw/db.ts`, extend the type import to
`import type { Conversation, ConversationMessage, FeatureRequestDraft, RubricScore, Tag, TaskDetail, TaskSummary } from "@/api/models";`
and the fixture import to `import { ISO, makeConversation, makeMessage } from "./fixtures";`, then add above `export const db`:

```ts
export const C_OPEN = "c-1";

/** The scripted interview the API's fake adapter serves (spec 3.4), so the web tests exercise the
 *  same four turns staging serves with AI_MODEL_PROVIDER=fake. */
const TURNS: { reply: string; options: string[]; draft: Partial<FeatureRequestDraft> }[] = [
  {
    reply: "Got it. Who has this problem, and when does it come up?",
    options: [
      "A team supervisor before a coaching session",
      "An agent during a call",
      "A workforce planner on Monday",
    ],
    draft: { title: "Snooze a task until a date" },
  },
  {
    reply: "Thanks. What would you see on screen that you cannot see today?",
    options: [
      "A snooze control on each task",
      "A filter that hides snoozed tasks",
      "A date picker in the row",
    ],
    draft: { problem: "Tasks I cannot act on yet clutter the list." },
  },
  {
    reply: "Good. Name one thing you could check to say this works.",
    options: [
      "A snoozed task leaves the list",
      "It reappears on the chosen date",
      "The header count drops",
    ],
    draft: { proposedBehavior: "A snooze button hides the task until a date." },
  },
];

const READY_REPLY = "That is enough to file. The request reads as ready.";

const READY_DRAFT: FeatureRequestDraft = {
  title: "Snooze a task until a date",
  problem: "Tasks I cannot act on yet clutter the list.",
  proposedBehavior: "A snooze button hides the task until a date.",
  acceptanceCriteria:
    "- A snoozed task leaves the list\n- It reappears on the chosen date\n- The header count drops",
  outOfScope: "Recurring snoozes.",
};

const READY_SCORE: RubricScore = {
  clarity: 4,
  complexity: 2,
  risk: 2,
  archChange: false,
  readiness: 16,
  reasons: {
    clarity: "The user, the moment, and three checkable criteria are named.",
    complexity: "One list view and one new field.",
    risk: "No data migration and no new integration.",
  },
};

/** Two chunks per reply, so a test can watch the text grow. */
function splitReply(reply: string): string[] {
  const cut = reply.indexOf(" ") + 1;
  return [reply.slice(0, cut), reply.slice(cut)];
}
```

Then add to the `db` object literal, after `tags: [] as Tag[],`:

```ts
  conversation: null as Conversation | null,
```

set it in `reset()` (`this.conversation = null;` next to `counter = 100;`), and add these methods:

```ts
  /** Seeds the caller's open conversation, as GET returns it after the API created one. */
  openConversation(overrides: Partial<Conversation> = {}): Conversation {
    const conversation = makeConversation({ id: C_OPEN, ...overrides });
    this.conversation = conversation;
    return conversation;
  },
  /** POST /feature-requests/conversation: abandons an open or ready one, then creates a new one. */
  startConversation(): Conversation {
    const conversation = makeConversation({ id: nextId("c") });
    this.conversation = conversation;
    return conversation;
  },
  /** One turn of the scripted interview; returns the deltas to stream and the persisted state. */
  advanceTurn(content: string, skip: boolean): { deltas: string[]; conversation: Conversation } {
    const current = this.conversation;
    if (!current) throw new Error("advanceTurn: no conversation");
    const asked: ConversationMessage[] = [
      ...current.messages,
      makeMessage({
        id: nextId("m"),
        role: "user",
        content: skip ? "(skipped)" : content,
        skipped: skip,
      }),
    ];
    const step = TURNS[current.questionCount];
    const now = new Date().toISOString();
    const conversation: Conversation = step
      ? {
          ...current,
          messages: [
            ...asked,
            makeMessage({
              id: nextId("m"),
              role: "assistant",
              content: step.reply,
              options: step.options,
            }),
          ],
          draft: { ...current.draft, ...step.draft },
          questionCount: current.questionCount + 1,
          updatedAt: now,
        }
      : {
          ...current,
          status: "ready",
          messages: [
            ...asked,
            makeMessage({ id: nextId("m"), role: "assistant", content: READY_REPLY }),
          ],
          draft: READY_DRAFT,
          score: READY_SCORE,
          stillMissing: [],
          updatedAt: now,
        };
    this.conversation = conversation;
    return { deltas: splitReply(step ? step.reply : READY_REPLY), conversation };
  },
```

- [ ] **Step 5: Add the SSE response helper and the conversation handlers**

In `tests/msw/handlers.ts`, extend the type import with `Conversation`, `ConversationEvent`, and `ConversationTurnBody`, and the db import with `db`, then add `sse` next to `ok` and `err`:

```ts
/** A `text/event-stream` body built from the contract's events (spec 3.3): a `: ping` comment
 *  first, then one `event:`/`data:` frame per entry, each enqueued as its own chunk so a test can
 *  observe the reply growing. */
export function sse(events: ConversationEvent[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(": ping\n\n"));
      for (const event of events) {
        controller.enqueue(
          encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`),
        );
      }
      controller.close();
    },
  });
  return new HttpResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "x-request-id": REQUEST_ID,
    },
  });
}

export const conversationHandlers = [
  http.get(`${API}/feature-requests/conversation`, () => {
    const conversation = db.conversation;
    if (!conversation || (conversation.status !== "open" && conversation.status !== "ready")) {
      return err("NOT_FOUND", "No open conversation");
    }
    return ok(conversation);
  }),
  http.post(`${API}/feature-requests/conversation`, () => ok(db.startConversation(), {}, 201)),
  http.post<IdParams>(
    `${API}/feature-requests/conversation/:id/messages`,
    async ({ params, request }) => {
      const conversation = db.conversation;
      if (!conversation || conversation.id !== params.id) {
        return err("NOT_FOUND", "Conversation not found");
      }
      if (conversation.status !== "open") {
        return err("CONFLICT", "This conversation is already closed");
      }
      const body = (await request.json()) as ConversationTurnBody;
      const turn = db.advanceTurn(body.content, body.skip === true);
      const events: ConversationEvent[] = [
        ...turn.deltas.map((text) => ({ event: "delta" as const, data: { text } })),
        { event: "state", data: { conversation: turn.conversation } },
        { event: "done", data: {} },
      ];
      return sse(events);
    },
  ),
];
```

Replace the existing `POST /feature-requests` handler body so it honours `conversationId`:

```ts
export const featureRequestHandlers = [
  http.post(`${API}/feature-requests`, async ({ request }) => {
    const body = (await request.json()) as FeatureRequestBody;
    if (!body.title?.trim()) {
      return err("VALIDATION_ERROR", "Invalid request", [
        { path: "body.title", message: "Title is required" },
      ]);
    }
    if (body.conversationId) {
      const conversation: Conversation | null = db.conversation;
      if (!conversation || conversation.id !== body.conversationId) {
        // Not the caller's, or no such conversation (spec 3.2).
        return err("NOT_FOUND", "Conversation not found");
      }
      if (conversation.status !== "open" && conversation.status !== "ready") {
        // Already filed or abandoned: nothing left to attach (spec 3.2).
        return err("CONFLICT", "This conversation was already filed");
      }
      db.conversation = { ...conversation, status: "filed", issueNumber: 42 };
    }
    return ok(
      {
        issueNumber: 42,
        issueUrl: "https://github.com/kpnemo/kaizen-tasks-assembly-line/issues/42",
      },
      {},
      201,
    );
  }),
];
```

and add the new list to the exported `handlers` array:

```ts
export const handlers = [
  ...authHandlers,
  ...taskHandlers,
  ...tagHandlers,
  ...featureRequestHandlers,
  ...conversationHandlers,
  ...healthHandlers,
];
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/msw/conversation-handlers.test.ts && npm run lint && npm run typecheck`

Expected: `6 passed`, lint clean, typecheck clean.

- [ ] **Step 7: Run the whole suite to prove nothing regressed**

Run: `npm test`

Expected: every existing file still passes (the `POST /feature-requests` handler change is additive; `RequestFeaturePage.test.tsx` is untouched at this point).

- [ ] **Step 8: Add the CHANGELOG bullet and run the docs gate**

Under `## [Unreleased]` → `### Added`:

```markdown
- Test doubles for the interview: MSW handlers for the three conversation routes, a `sse()` helper that turns contract events into a `text/event-stream` body, and a scripted four-turn conversation in the fake database that mirrors the API's fake adapter; `POST /feature-requests` now enforces the contract's conversation states (404 for an id that is not the caller's, 409 for one already filed or abandoned).
```

Run: `npm run docs:check`

Expected: `docs-check: OK`

- [ ] **Step 9: Commit**

```bash
git add tests/msw/fixtures.ts tests/msw/db.ts tests/msw/handlers.ts \
  tests/msw/conversation-handlers.test.ts CHANGELOG.md
git commit -m "$(cat <<'EOM'
test: MSW handlers, fixtures, and an SSE body helper for the interview

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOM
)"
```

---

### Task 4: The conversation hooks

**Files:**

- Modify: `src/features/feature-request/hooks.ts`
- Test: `src/features/feature-request/hooks.test.tsx` (create)

**Interfaces:**

- Consumes: `client`, `unwrap` from `src/api/client.ts`; `ApiError` from `src/api/errors.ts`; `readConversationStream` from `src/api/conversation-stream.ts` (Task 2); `Conversation` from `src/api/models.ts` (Task 1); `toastApiError` from `src/components/api-error-toast.tsx`; `makeQueryClient` from `tests/render.tsx`; `db`, `sse`, `API`, `err` from the MSW modules (Task 3).
- Produces, exported from `src/features/feature-request/hooks.ts` (alongside the existing `useFeatureRequestAvailable`):
  - `const conversationKey = ["feature-request", "conversation"] as const`
  - `function useConversation(enabled: boolean): UseQueryResult<Conversation | null, Error>`
  - `function useStartConversation(): UseMutationResult<Conversation, Error, void>`
  - `type SendTurnVariables = { id: string; content: string; skip?: boolean }`
  - `function useSendTurn(): { send: UseMutateFunction<Conversation, Error, SendTurnVariables>; reset: () => void; isStreaming: boolean; streamingText: string; pendingMessage: string | null }`
  - `useSubmitFeatureRequest()` gains an `onSuccess` that clears the cached conversation when the body carried a `conversationId`.

`useSendTurn` owns an `AbortController` per turn (spec 3.3: "If the client disconnects, the model stream is aborted and nothing is persisted"). It aborts on unmount, drops `delta` and `state` writes that arrive after the abort, and re-raises the abort as a private `TurnAborted` the error path swallows, so leaving the page mid-answer never toasts.

- [ ] **Step 1: Write the failing test**

Create `src/features/feature-request/hooks.test.tsx`:

```tsx
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authStore } from "@/api/auth-store";
import { ApiError } from "@/api/errors";
import type { Conversation } from "@/api/models";
import { db } from "../../../tests/msw/db";
import { demoUser } from "../../../tests/msw/fixtures";
import { API, err } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { makeQueryClient } from "../../../tests/render";
import { conversationKey, useConversation, useSendTurn, useStartConversation } from "./hooks";

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** A turn whose second half waits for `release()`, so a test can assert the pending state while
 *  the reply is genuinely mid-flight instead of after it has already finished. */
function gatedTurn(answered: Conversation) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  server.use(
    http.post(`${API}/feature-requests/conversation/:id/messages`, () => {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(encoder.encode('event: delta\ndata: {"text":"Got it. "}\n\n'));
          await gate;
          controller.enqueue(encoder.encode('event: delta\ndata: {"text":"Who?"}\n\n'));
          controller.enqueue(
            encoder.encode(`event: state\ndata: ${JSON.stringify({ conversation: answered })}\n\n`),
          );
          controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
          controller.close();
        },
      });
      return new HttpResponse(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      });
    }),
  );
  return () => release();
}

function answeredFrom(conversation: Conversation): Conversation {
  return {
    ...conversation,
    questionCount: 1,
    messages: [
      ...conversation.messages,
      { id: "m-u", role: "user", content: "I want to snooze tasks", at: conversation.createdAt },
      {
        id: "m-a",
        role: "assistant",
        content: "Got it. Who?",
        at: conversation.createdAt,
        options: ["A supervisor"],
      },
    ],
  };
}

describe("conversation hooks", () => {
  beforeEach(() => {
    authStore.setSession({ token: "test-token", user: demoUser });
  });

  it("reads null when there is no open conversation and the conversation when there is", async () => {
    const empty = renderHook(() => useConversation(true), { wrapper: wrap(makeQueryClient()) });
    await waitFor(() => expect(empty.result.current.isSuccess).toBe(true));
    expect(empty.result.current.data).toBeNull();

    db.openConversation();
    const filled = renderHook(() => useConversation(true), { wrapper: wrap(makeQueryClient()) });
    await waitFor(() => expect(filled.result.current.data?.id).toBe("c-1"));
  });

  it("does not fetch while the feature is unconfirmed", async () => {
    let probes = 0;
    server.use(
      http.get(`${API}/feature-requests/conversation`, () => {
        probes += 1;
        return err("NOT_FOUND", "none");
      }),
    );
    const { result } = renderHook(() => useConversation(false), {
      wrapper: wrap(makeQueryClient()),
    });
    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(probes).toBe(0);
  });

  it("seeds the query when a conversation is started", async () => {
    const client = makeQueryClient();
    const { result } = renderHook(() => useStartConversation(), { wrapper: wrap(client) });
    act(() => result.current.mutate());
    await waitFor(() =>
      expect(client.getQueryData<Conversation>(conversationKey)?.messages).toHaveLength(1),
    );
    expect(client.getQueryData<Conversation>(conversationKey)?.status).toBe("open");
  });

  it("appends deltas while the reply streams, then replaces the conversation", async () => {
    const conversation = db.openConversation();
    const release = gatedTurn(answeredFrom(conversation));

    const client = makeQueryClient();
    client.setQueryData(conversationKey, conversation);
    const { result } = renderHook(() => useSendTurn(), { wrapper: wrap(client) });
    act(() => result.current.send({ id: conversation.id, content: "I want to snooze tasks" }));

    await waitFor(() => expect(result.current.streamingText).toBe("Got it. "));
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.pendingMessage).toBe("I want to snooze tasks");

    release();
    await waitFor(() =>
      expect(client.getQueryData<Conversation>(conversationKey)?.questionCount).toBe(1),
    );
    expect(result.current.streamingText).toBe("");
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.pendingMessage).toBeNull();
  });

  it("raises the stream's error event and leaves the conversation alone", async () => {
    const conversation = db.openConversation();
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('event: delta\ndata: {"text":"Got"}\n\n'));
            controller.enqueue(
              encoder.encode(
                'event: error\ndata: {"code":"UPSTREAM_ERROR","message":"The assistant did not answer"}\n\n',
              ),
            );
            controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
            controller.close();
          },
        });
        return new HttpResponse(body, {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        });
      }),
    );
    const client = makeQueryClient();
    client.setQueryData(conversationKey, conversation);
    const { result } = renderHook(() => useSendTurn(), { wrapper: wrap(client) });
    const onError = vi.fn();
    act(() =>
      result.current.send({ id: conversation.id, content: "I want to snooze tasks" }, { onError }),
    );

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    const raised = onError.mock.calls[0][0] as ApiError;
    expect(raised).toBeInstanceOf(ApiError);
    expect(raised.code).toBe("UPSTREAM_ERROR");
    expect(raised.message).toBe("The assistant did not answer");
    expect(client.getQueryData<Conversation>(conversationKey)).toEqual(conversation);
    expect(result.current.pendingMessage).toBe("I want to snooze tasks");
    expect(result.current.streamingText).toBe("");
  });

  it("treats a rate limit before the stream as a normal ApiError with its reset hour", async () => {
    const conversation = db.openConversation();
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, () =>
        err("RATE_LIMITED", "Hourly limit reached", {
          scope: "user",
          limit: 60,
          resetAt: "2026-09-10T12:00:00.000Z",
        }),
      ),
    );
    const client = makeQueryClient();
    client.setQueryData(conversationKey, conversation);
    const { result } = renderHook(() => useSendTurn(), { wrapper: wrap(client) });
    const onError = vi.fn();
    act(() => result.current.send({ id: conversation.id, content: "hello" }, { onError }));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    const raised = onError.mock.calls[0][0] as ApiError;
    expect(raised.code).toBe("RATE_LIMITED");
    expect(raised.rateLimit()).toEqual({
      scope: "user",
      limit: 60,
      resetAt: "2026-09-10T12:00:00.000Z",
    });
    expect(client.getQueryData<Conversation>(conversationKey)).toEqual(conversation);
    expect(result.current.pendingMessage).toBe("hello");
  });

  it("records a skip as the (skipped) message and counts the question", async () => {
    const conversation = db.openConversation();
    const client = makeQueryClient();
    client.setQueryData(conversationKey, conversation);
    const { result } = renderHook(() => useSendTurn(), { wrapper: wrap(client) });
    act(() => result.current.send({ id: conversation.id, content: "(skipped)", skip: true }));

    await waitFor(() =>
      expect(client.getQueryData<Conversation>(conversationKey)?.questionCount).toBe(1),
    );
    const cached = client.getQueryData<Conversation>(conversationKey);
    expect(cached?.messages.some((m) => m.skipped === true)).toBe(true);
    expect(cached?.messages.at(-2)?.content).toBe("(skipped)");
  });

  it("abandons the turn on unmount: no cache write and no toast", async () => {
    const conversation = db.openConversation();
    const release = gatedTurn(answeredFrom(conversation));

    const client = makeQueryClient();
    client.setQueryData(conversationKey, conversation);
    const { result, unmount } = renderHook(() => useSendTurn(), { wrapper: wrap(client) });
    act(() => result.current.send({ id: conversation.id, content: "I want to snooze tasks" }));

    // Positive evidence that the stream really was open before we walked away.
    await waitFor(() => expect(result.current.streamingText).toBe("Got it. "));
    unmount();
    await act(async () => {
      release();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(client.getQueryData<Conversation>(conversationKey)).toEqual(conversation);
    expect(document.querySelectorAll("[data-sonner-toast]")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/feature-request/hooks.test.tsx`

Expected: FAIL — `SyntaxError: The requested module './hooks' does not provide an export named 'conversationKey'` (and the same for `useConversation`, `useSendTurn`, `useStartConversation`).

- [ ] **Step 3: Write the hooks**

Replace `src/features/feature-request/hooks.ts` with:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { client, unwrap } from "@/api/client";
import { readConversationStream } from "@/api/conversation-stream";
import { ApiError } from "@/api/errors";
import { healthQueryOptions } from "@/api/health-query";
import type { Conversation, FeatureRequestBody } from "@/api/models";
import { toastApiError } from "@/components/api-error-toast";

/** The caller's one open or ready conversation. `null` means "none yet" (the API answers 404). */
export const conversationKey = ["feature-request", "conversation"] as const;

/** The PM left the page mid-turn. Not a failure to show: the API aborts the model and persists
 *  nothing (spec 3.3), so there is nothing for the PM to act on. */
class TurnAborted extends Error {
  constructor() {
    super("The turn was abandoned");
    this.name = "TurnAborted";
  }
}

/** Whether the running API mounted the feature-request route: `data.features.featureRequests` from
 *  GET /health (master plan interface "Health", ruling R2), read through the shared health query so
 *  the footer and this feature share one request per session. `undefined` while unknown; a failing
 *  health check (503 UNAVAILABLE, surfaced as `null` by the query) counts as unavailable. */
export function useFeatureRequestAvailable(): { available: boolean | undefined } {
  const query = useQuery(healthQueryOptions);
  const available =
    query.data === undefined ? undefined : query.data?.features.featureRequests === true;
  return { available };
}

/** GET /feature-requests/conversation. 404 is an answer, not an error: it means "start a new one".
 *  `enabled` is false while health has not confirmed the feature, so the query never fires on an
 *  API that did not mount the route. */
export function useConversation(enabled: boolean) {
  return useQuery({
    queryKey: conversationKey,
    enabled,
    queryFn: async (): Promise<Conversation | null> => {
      const result = await client.GET("/feature-requests/conversation");
      if (result.response.status === 404) return null;
      return unwrap(result).data;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** POST /feature-requests/conversation: abandons any open or ready one and starts a new one with
 *  the greeting (spec 3.2). Also the "Start over" action. */
export function useStartConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Conversation> =>
      unwrap(await client.POST("/feature-requests/conversation", {})).data,
    onSuccess: (conversation) => {
      queryClient.setQueryData(conversationKey, conversation);
    },
    onError: toastApiError,
  });
}

export type SendTurnVariables = { id: string; content: string; skip?: boolean };

/** One PM answer. The route answers `text/event-stream`, so the request is made with
 *  `parseAs: "stream"` and the body is decoded by `readConversationStream` (ADR 0005).
 *  A non-OK response never reaches the parser: it becomes an ApiError like any other failure, so a
 *  429 still carries `scope`, `limit`, and `resetAt` for the toast. An `error` event is re-raised
 *  with the event's own code. Nothing is persisted on a failed turn (spec 3.3), so the cached
 *  conversation is left alone and `pendingMessage` keeps the PM's text in the transcript for a
 *  clean resend. The turn is aborted when the panel unmounts; cache writes that arrive after the
 *  abort are dropped and the abort itself is swallowed rather than toasted. */
export function useSendTurn() {
  const queryClient = useQueryClient();
  const [streamingText, setStreamingText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
    },
    [],
  );

  const mutation = useMutation<Conversation, Error, SendTurnVariables>({
    mutationFn: async ({ id, content, skip }) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setStreamingText("");
      try {
        const result = await client.POST("/feature-requests/conversation/{id}/messages", {
          params: { path: { id } },
          body: { content, skip },
          parseAs: "stream",
          signal: controller.signal,
        });
        const body = result.data;
        if (!result.response.ok || !body) {
          throw ApiError.fromResponse(result.response, result.error);
        }
        const outcome: { conversation: Conversation | null; failure: ApiError | null } = {
          conversation: null,
          failure: null,
        };
        await readConversationStream(body, {
          onDelta: (text) => {
            if (controller.signal.aborted) return;
            setStreamingText((current) => current + text);
          },
          onState: (conversation) => {
            if (controller.signal.aborted) return;
            outcome.conversation = conversation;
            setStreamingText("");
            queryClient.setQueryData(conversationKey, conversation);
          },
          onError: (failure) => {
            outcome.failure = new ApiError({
              code: failure.code,
              message: failure.message,
              status: result.response.status,
            });
          },
          onDone: () => {
            if (controller.signal.aborted) return;
            setStreamingText("");
          },
        });
        // Reaching here means the body closed, which is completion (spec 3.2).
        if (controller.signal.aborted) throw new TurnAborted();
        if (outcome.failure) throw outcome.failure;
        if (!outcome.conversation) {
          throw new ApiError({
            code: "UPSTREAM_ERROR",
            message: "The assistant did not finish the answer. Send it again.",
            status: result.response.status,
          });
        }
        return outcome.conversation;
      } catch (error) {
        if (controller.signal.aborted) throw new TurnAborted();
        throw error;
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    onError: (error) => {
      if (error instanceof TurnAborted) return;
      toastApiError(error);
    },
  });

  // The PM's own message, shown at the end of the transcript while the turn is in flight and left
  // there after a failure, because the API persists nothing in that case (spec 3.3).
  const local = mutation.isPending || mutation.isError ? mutation.variables : undefined;

  return {
    send: mutation.mutate,
    reset: mutation.reset,
    isStreaming: mutation.isPending,
    streamingText,
    pendingMessage: local ? (local.skip ? "(skipped)" : local.content) : null,
  };
}

export function useSubmitFeatureRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: FeatureRequestBody) =>
      unwrap(await client.POST("/feature-requests", { body })).data,
    onSuccess: (_result, body) => {
      // The API marks a filed conversation `filed`; the next visit starts a new one (spec 2).
      if (body.conversationId) queryClient.setQueryData(conversationKey, null);
    },
  });
}
```

`signal` reaches `fetch` because openapi-fetch spreads every init key it does not consume into the `Request` it builds; `FetchOptions<T>` already includes `Omit<RequestInit, "body" | "headers">`, so it typechecks.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/feature-request/hooks.test.tsx && npm run lint && npm run typecheck`

Expected: `8 passed`, lint clean, typecheck clean.

- [ ] **Step 5: Add the CHANGELOG bullet and run the docs gate**

Under `## [Unreleased]` → `### Added` in `CHANGELOG.md`:

```markdown
- Conversation hooks: `useConversation`, `useStartConversation`, and `useSendTurn` (streamed reply text, the assistant's state replacing the cached conversation, the failed-turn path that keeps the PM's message, and an abort on unmount so leaving the page cancels the model).
```

Run: `npm run docs:check`

Expected: `docs-check: OK`

- [ ] **Step 6: Commit**

```bash
git add src/features/feature-request/hooks.ts src/features/feature-request/hooks.test.tsx CHANGELOG.md
git commit -m "$(cat <<'EOM'
feat: conversation query and abortable streamed turn mutation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOM
)"
```

---

### Task 5: ConversationPanel

**Files:**

- Create: `src/features/feature-request/components/ConversationPanel.tsx`
- Test: `src/features/feature-request/components/ConversationPanel.test.tsx`

**Interfaces:**

- Consumes: `Conversation` from `src/api/models.ts` (Task 1); `useConversation`, `useSendTurn`, `useStartConversation`, `conversationKey` from `../hooks` (Task 4); `Button` from `@/components/ui/button`; `Textarea` from `@/components/ui/textarea`; `cn` from `@/lib/cn`.
- Produces: `function ConversationPanel({ conversation }: { conversation: Conversation }): JSX.Element` — the only export of the file (the `react-refresh/only-export-components` rule is on for `src/**`).

Accessible names this component owns, all cross-repo contract (`README.md`, "Selector contract"): heading `Kaizen assistant`, button `Start over`, list `Conversation`, textbox `Your answer`, button `Send`, button `Skip this question`, and one button per option chip named by its own text.

Two design notes. First, spec 4.1 names `MessageList`, `OptionChips`, and `AnswerBox`; they share one `send` handler and one disabled state, so they are sections of this single ~120-line file rather than separate modules. Second, the component takes the conversation as a prop but the turn mutation writes to the query cache, so the **test renders it through a harness that subscribes to `useConversation`** — otherwise the panel would keep re-rendering the original fixture and the new question could never appear.

- [ ] **Step 1: Write the failing test**

Create `src/features/feature-request/components/ConversationPanel.test.tsx`:

```tsx
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { authStore } from "@/api/auth-store";
import type { Conversation } from "@/api/models";
import { Toaster } from "@/components/ui/sonner";
import { db } from "../../../../tests/msw/db";
import { demoUser, GREETING } from "../../../../tests/msw/fixtures";
import { API, err } from "../../../../tests/msw/handlers";
import { server } from "../../../../tests/msw/server";
import { makeQueryClient } from "../../../../tests/render";
import { conversationKey, useConversation } from "../hooks";
import { ConversationPanel } from "./ConversationPanel";

/** The panel takes its conversation as a prop, but a turn replaces the cached conversation. The
 *  harness subscribes to the same query the hook writes to, so the panel re-renders with the new
 *  assistant message exactly as the page does. */
function Harness() {
  const conversation = useConversation(true);
  if (!conversation.data) {
    return <p role="status">Loading the conversation</p>;
  }
  return <ConversationPanel conversation={conversation.data} />;
}

function renderPanel(): { user: ReturnType<typeof userEvent.setup>; queryClient: QueryClient } {
  const queryClient = makeQueryClient();
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <Harness />
      <Toaster />
    </QueryClientProvider>,
  );
  return { user, queryClient };
}

describe("ConversationPanel", () => {
  beforeEach(() => {
    authStore.setSession({ token: "test-token", user: demoUser });
  });

  it("shows the greeting, sends an answer, and shows the assistant's chips", async () => {
    db.openConversation();
    const { user } = renderPanel();
    expect(await screen.findByText(GREETING)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kaizen assistant" })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "I want to snooze tasks");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByRole("button", { name: "A team supervisor before a coaching session" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Got it. Who has this problem, and when does it come up?"),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
    expect(screen.getByRole("list", { name: "Conversation" })).toBeInTheDocument();
  });

  it("sends an option chip's own text", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, async ({ request }) => {
        bodies.push(await request.json());
        return err("UPSTREAM_ERROR", "stop here");
      }),
    );
    db.openConversation({
      questionCount: 1,
      messages: [
        {
          id: "m-1",
          role: "assistant",
          content: "Who has this problem?",
          at: "2026-09-01T09:00:00.000Z",
          options: ["An agent during a call"],
        },
      ],
    });
    const { user } = renderPanel();
    await user.click(await screen.findByRole("button", { name: "An agent during a call" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ content: "An agent during a call" });
  });

  it("sends skip: true from the skip chip", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, async ({ request }) => {
        bodies.push(await request.json());
        return err("UPSTREAM_ERROR", "stop here");
      }),
    );
    db.openConversation();
    const { user } = renderPanel();
    await user.click(await screen.findByRole("button", { name: "Skip this question" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ content: "(skipped)", skip: true });
  });

  it("sends on Enter and inserts a newline on Shift+Enter", async () => {
    db.openConversation();
    const { user } = renderPanel();
    await screen.findByText(GREETING);
    const box = screen.getByRole("textbox", { name: "Your answer" });
    await user.type(box, "first{Shift>}{Enter}{/Shift}second");
    expect(box).toHaveValue("first\nsecond");
    await user.type(box, "{Enter}");
    expect(
      await screen.findByText("Got it. Who has this problem, and when does it come up?"),
    ).toBeInTheDocument();
  });

  it("keeps the PM's message and the text after a failed turn, and re-enables the input", async () => {
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, () =>
        err("UPSTREAM_ERROR", "The assistant is unavailable"),
      ),
    );
    db.openConversation();
    const { user } = renderPanel();
    await screen.findByText(GREETING);
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "I want to snooze tasks");
    await user.click(screen.getByRole("button", { name: "Send" }));

    // The toast is the positive evidence that the failure path ran.
    expect(await screen.findByText("The assistant is unavailable")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue(
      "I want to snooze tasks",
    );
    expect(screen.getAllByText("I want to snooze tasks").length).toBeGreaterThan(0);
  });

  it("disables the answer box once the conversation is ready and keeps Start over", async () => {
    db.openConversation({ status: "ready" });
    renderPanel();
    await screen.findByText(GREETING);
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Skip this question" })).toBeNull();
    expect(screen.getByRole("button", { name: "Start over" })).toBeEnabled();
  });

  it("starts a new conversation from Start over", async () => {
    const before = db.openConversation();
    const { user, queryClient } = renderPanel();
    await screen.findByText(GREETING);
    await user.click(screen.getByRole("button", { name: "Start over" }));
    await waitFor(() => {
      const started = queryClient.getQueryData<Conversation>(conversationKey);
      expect(typeof started?.id).toBe("string");
      expect(started?.id).not.toBe(before.id);
    });
  });

  it("lets a long chip wrap instead of forcing a horizontal scrollbar", async () => {
    db.openConversation();
    renderPanel();
    const skip = await screen.findByRole("button", { name: "Skip this question" });
    expect(skip).toHaveClass("whitespace-normal");
    expect(skip).not.toHaveClass("whitespace-nowrap");
    expect(skip).toHaveClass("min-h-11");
    expect(skip).not.toHaveClass("shrink-0");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/feature-request/components/ConversationPanel.test.tsx`

Expected: FAIL — `Failed to resolve import "./ConversationPanel" from "src/features/feature-request/components/ConversationPanel.test.tsx". Does the file exist?`

- [ ] **Step 3: Write the component**

Create `src/features/feature-request/components/ConversationPanel.tsx`:

```tsx
import { useState } from "react";
import type { Conversation } from "@/api/models";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { useSendTurn, useStartConversation } from "../hooks";

/** A chip is at least 44px tall (the projector floor; `min-h-11` is 49.5px at the app's 18px root)
 *  and wraps rather than overflowing: the shared Button is `h-9 whitespace-nowrap shrink-0`, and
 *  tailwind-merge keeps the later utility of each of those three groups. */
const CHIP = "min-h-11 h-auto max-w-full shrink whitespace-normal rounded-full px-4 py-2 text-left";

function Bubble({ who, text }: { who: "assistant" | "user"; text: string }) {
  return (
    <li
      className={cn(
        "max-w-[46ch] min-w-0 rounded-xl px-4 py-3 break-words whitespace-pre-line",
        who === "assistant" ? "bg-accent text-accent-foreground" : "ml-auto border bg-background",
      )}
    >
      <span className="sr-only">{who === "assistant" ? "Assistant: " : "You: "}</span>
      {text}
    </li>
  );
}

/** The chat half of the interview (spec 2 and 4.1): the transcript, the streaming reply, the
 *  option chips, the skip chip, and the answer box. Every chip and button is a real button whose
 *  visible text is its accessible name (spec 4.4). */
export function ConversationPanel({ conversation }: { conversation: Conversation }) {
  const turn = useSendTurn();
  const start = useStartConversation();
  const [answer, setAnswer] = useState("");

  const last = conversation.messages.at(-1);
  const options = last?.role === "assistant" ? (last.options ?? []) : [];
  const closed = conversation.status !== "open";
  const busy = turn.isStreaming || start.isPending;

  function send(content: string, skip = false) {
    const text = content.trim();
    if (text === "" || busy || closed) return;
    setAnswer("");
    turn.send(
      { id: conversation.id, content: text, skip: skip ? true : undefined },
      // Nothing was persisted, so put the PM's own words back in the box: Send resends them.
      { onError: () => setAnswer(skip ? "" : text) },
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-bold">Kaizen assistant</h2>
        <Button
          variant="outline"
          className={cn(CHIP, "ml-auto")}
          disabled={busy}
          onClick={() => {
            turn.reset();
            setAnswer("");
            start.mutate();
          }}
        >
          Start over
        </Button>
      </div>

      <ol aria-label="Conversation" className="flex min-w-0 flex-col gap-3">
        {conversation.messages.map((message) => (
          <Bubble key={message.id} who={message.role} text={message.content} />
        ))}
        {turn.pendingMessage ? <Bubble who="user" text={turn.pendingMessage} /> : null}
        {turn.isStreaming && turn.streamingText !== "" ? (
          <li
            aria-live="polite"
            className="max-w-[46ch] min-w-0 rounded-xl bg-accent px-4 py-3 break-words whitespace-pre-line text-accent-foreground"
          >
            <span className="sr-only">Assistant: </span>
            {turn.streamingText}
          </li>
        ) : null}
      </ol>

      {turn.isStreaming && turn.streamingText === "" ? (
        <p role="status" className="animate-thinking text-muted-foreground">
          Thinking
        </p>
      ) : null}

      {!closed && !busy ? (
        <div className="flex min-w-0 flex-wrap gap-2">
          {options.map((option) => (
            <Button key={option} variant="outline" className={CHIP} onClick={() => send(option)}>
              {option}
            </Button>
          ))}
          <Button variant="ghost" className={CHIP} onClick={() => send("(skipped)", true)}>
            Skip this question
          </Button>
        </div>
      ) : null}

      <form
        className="flex min-w-0 flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          send(answer);
        }}
      >
        <Textarea
          aria-label="Your answer"
          placeholder="Type your answer. Enter sends, Shift+Enter starts a new line."
          rows={3}
          maxLength={2000}
          value={answer}
          disabled={busy || closed}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(answer);
            }
          }}
        />
        <Button
          type="submit"
          className="min-h-11 h-auto self-start"
          disabled={busy || closed || answer.trim() === ""}
        >
          Send
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/feature-request/components/ConversationPanel.test.tsx && npm run lint && npm run typecheck`

Expected: `8 passed`, lint clean, typecheck clean.

- [ ] **Step 5: Check the projector and narrow-layout rules**

Read the file and confirm: every chip and the Send button carry `min-h-11` (44px floor) with `h-auto whitespace-normal max-w-full shrink` so a long option wraps instead of overflowing; the panel root, the message list, the chip row, and every bubble carry `min-w-0`; `Button` already ships `focus-visible:ring-[3px]`; no control is revealed by hover only; copy is sentence case with plain verbs.

- [ ] **Step 6: Add the CHANGELOG bullet and run the docs gate**

Under `## [Unreleased]` → `### Added`:

```markdown
- `ConversationPanel`: the interview transcript with the streaming reply, a thinking indicator, wrapping option chips, a "Skip this question" chip, the "Your answer" box (Enter sends, Shift+Enter is a newline), and "Start over".
```

Run: `npm run docs:check`

Expected: `docs-check: OK`

- [ ] **Step 7: Commit**

```bash
git add src/features/feature-request/components/ConversationPanel.tsx \
  src/features/feature-request/components/ConversationPanel.test.tsx CHANGELOG.md
git commit -m "$(cat <<'EOM'
feat: the interview chat panel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOM
)"
```

---

### Task 6: DraftPanel

**Files:**

- Create: `src/features/feature-request/components/DraftPanel.tsx`
- Test: `src/features/feature-request/components/DraftPanel.test.tsx`

**Interfaces:**

- Consumes: `Conversation`, `FeatureRequestDraft` from `src/api/models.ts` (Task 1); `Badge` from `@/components/ui/badge`; `Button` from `@/components/ui/button`; `cn` from `@/lib/cn`; `Link` from `react-router`.
- Produces: `function DraftPanel({ conversation, onReview }: { conversation: Conversation; onReview: () => void }): JSX.Element` — the only export of the file.

Accessible names this component owns: region `Your request`, button `Review and file`, link `Skip the interview, fill the form`.

- [ ] **Step 1: Write the failing test**

Create `src/features/feature-request/components/DraftPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Conversation } from "@/api/models";
import { db } from "../../../../tests/msw/db";
import { DraftPanel } from "./DraftPanel";

function renderPanel(conversation: Conversation, onReview = vi.fn()) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <DraftPanel conversation={conversation} onReview={onReview} />
    </MemoryRouter>,
  );
  return { user, onReview };
}

describe("DraftPanel", () => {
  it("shows a placeholder for every empty field and no score yet", () => {
    renderPanel(db.openConversation());
    expect(screen.getByRole("region", { name: "Your request" })).toBeInTheDocument();
    for (const label of [
      "Title",
      "Problem",
      "Proposed behavior",
      "Acceptance criteria",
      "Out of scope",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Not filled in yet")).toHaveLength(5);
    expect(screen.getByText("Readiness not scored yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review and file" })).toBeDisabled();
  });

  it("shows the readiness chip with the sub-scores in its title and the filled fields", () => {
    renderPanel(
      db.openConversation({
        status: "ready",
        draft: {
          title: "Snooze a task until a date",
          problem: "Tasks I cannot act on yet clutter the list.",
          proposedBehavior: "A snooze button hides the task until a date.",
          acceptanceCriteria: "It reappears on the chosen date.",
          outOfScope: "",
        },
        score: {
          clarity: 4,
          complexity: 2,
          risk: 2,
          archChange: false,
          readiness: 16,
          reasons: { clarity: "Named", complexity: "Small", risk: "Low" },
        },
      }),
    );
    expect(screen.getByText("Readiness 16 of 20")).toHaveAttribute(
      "title",
      "Clarity 4 · Complexity 2 · Risk 2",
    );
    expect(screen.getByText("Snooze a task until a date")).toBeInTheDocument();
    expect(screen.getAllByText("Not filled in yet")).toHaveLength(1);
  });

  it("enables Review and file when the conversation is ready", async () => {
    const { user, onReview } = renderPanel(db.openConversation({ status: "ready" }));
    const button = screen.getByRole("button", { name: "Review and file" });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it("enables Review and file after the eighth question even while open", () => {
    renderPanel(db.openConversation({ questionCount: 8 }));
    expect(screen.getByRole("button", { name: "Review and file" })).toBeEnabled();
  });

  it("offers the plain form as a link that carries mode=form and wraps when narrow", () => {
    renderPanel(db.openConversation());
    const link = screen.getByRole("link", { name: "Skip the interview, fill the form" });
    expect(link).toHaveAttribute("href", "/request-feature?mode=form");
    expect(link).toHaveClass("whitespace-normal");
    expect(link).not.toHaveClass("whitespace-nowrap");
    expect(link).toHaveClass("min-h-11");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/feature-request/components/DraftPanel.test.tsx`

Expected: FAIL — `Failed to resolve import "./DraftPanel" from "src/features/feature-request/components/DraftPanel.test.tsx". Does the file exist?`

- [ ] **Step 3: Write the component**

Create `src/features/feature-request/components/DraftPanel.tsx`:

```tsx
import { Link } from "react-router";
import type { Conversation, FeatureRequestDraft } from "@/api/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const FIELDS: { key: keyof FeatureRequestDraft; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "problem", label: "Problem" },
  { key: "proposedBehavior", label: "Proposed behavior" },
  { key: "acceptanceCriteria", label: "Acceptance criteria" },
  { key: "outOfScope", label: "Out of scope" },
];

const EMPTY = "Not filled in yet";

/** 44px floor, and wraps rather than overflowing on a narrow screen: the shared Button ships
 *  `h-9 whitespace-nowrap shrink-0` and tailwind-merge keeps the later utility of each group. */
const WRAPS = "min-h-11 h-auto max-w-full shrink whitespace-normal text-left";

/** The right half of the interview (spec 2 and 4.1): the readiness chip, the five fields as
 *  read-only text, and the two ways out — review the prefilled form, or skip to the plain one. */
export function DraftPanel({
  conversation,
  onReview,
}: {
  conversation: Conversation;
  onReview: () => void;
}) {
  const score = conversation.score;
  // The API sets `ready` both when the request scores as ready and at the eighth question
  // (spec 2, "Ready"); the count is the belt-and-braces path if a turn's status lags.
  const ready = conversation.status === "ready" || conversation.questionCount >= 8;

  return (
    <section
      aria-label="Your request"
      className="flex min-w-0 flex-col gap-4 self-start rounded-xl border bg-card p-4"
    >
      <Badge
        variant="outline"
        className="min-h-11 max-w-full self-start px-4 py-2 text-base whitespace-normal"
        title={
          score
            ? `Clarity ${score.clarity} · Complexity ${score.complexity} · Risk ${score.risk}`
            : undefined
        }
      >
        {score ? `Readiness ${score.readiness} of 20` : "Readiness not scored yet"}
      </Badge>

      <dl className="flex min-w-0 flex-col gap-4">
        {FIELDS.map((field) => {
          const value = conversation.draft[field.key]?.trim() ?? "";
          return (
            <div key={field.key} className="flex min-w-0 flex-col gap-1">
              <dt className="text-sm font-semibold text-muted-foreground">{field.label}</dt>
              <dd
                className={cn(
                  "break-words whitespace-pre-line",
                  value === "" && "text-muted-foreground italic",
                )}
              >
                {value === "" ? EMPTY : value}
              </dd>
            </div>
          );
        })}
      </dl>

      <Button className={WRAPS} disabled={!ready} onClick={onReview}>
        Review and file
      </Button>
      <Button asChild variant="link" className={cn(WRAPS, "self-start")}>
        <Link to="/request-feature?mode=form">Skip the interview, fill the form</Link>
      </Button>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/feature-request/components/DraftPanel.test.tsx && npm run lint && npm run typecheck`

Expected: `5 passed`, lint clean, typecheck clean.

- [ ] **Step 5: Add the CHANGELOG bullet and run the docs gate**

Under `## [Unreleased]` → `### Added`:

```markdown
- `DraftPanel`: the readiness chip (sub-scores in its title), the five request fields as read-only text with placeholders, "Review and file", and the wrapping link to the plain form.
```

Run: `npm run docs:check`

Expected: `docs-check: OK`

- [ ] **Step 6: Commit**

```bash
git add src/features/feature-request/components/DraftPanel.tsx \
  src/features/feature-request/components/DraftPanel.test.tsx CHANGELOG.md
git commit -m "$(cat <<'EOM'
feat: the live draft panel beside the interview

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOM
)"
```

---

### Task 7: The page switchboard and the prefilled form

**Files:**

- Create: `src/features/feature-request/components/FeatureRequestForm.tsx`
- Modify: `src/features/feature-request/RequestFeaturePage.tsx` (whole file replaced)
- Modify: `src/features/feature-request/RequestFeaturePage.test.tsx` (three tests gain one navigation step each)
- Test: `src/features/feature-request/InterviewFlow.test.tsx` (create)

**Interfaces:**

- Consumes: `ConversationPanel` (Task 5), `DraftPanel` (Task 6), `useConversation`, `useStartConversation`, `useSubmitFeatureRequest`, `useFeatureRequestAvailable`, `conversationKey` (Task 4); `Conversation`, `FeatureRequestBody`, `FeatureRequestDraft`, `FeatureRequestResult` from `src/api/models.ts` (Task 1); `Field`, `Button`, `Input`, `Textarea`, `toastApiError`, `toApiError`.
- Produces:
  - `function FeatureRequestForm({ initialValues, conversationId, note, onFiled }: { initialValues?: FeatureRequestDraft; conversationId?: string; note?: string; onFiled: (result: FeatureRequestResult) => void }): JSX.Element` — the only export of `components/FeatureRequestForm.tsx`
  - `function RequestFeaturePage(): JSX.Element` — unchanged export name and route (`src/app/router.tsx` is not touched)

Modes (spec 4.1): `interview` by default; `form` when the URL carries `?mode=form` ("Skip the interview, fill the form"); `review` when "Review and file" was clicked, which renders the same form with `initialValues`, `conversationId`, and the note line.

Failure handling (spec 2, "Errors"): a failed `GET` and a failed `POST` both surface through `toastApiError` — the GET through an effect, since TanStack Query v5 has no `onError` on `useQuery`, and the POST through `useStartConversation`'s own `onError`. Neither leaves the page stranded: a "Try again" button clears the one-shot guard and refetches, which re-arms the auto-start.

- [ ] **Step 1: Write the failing test**

Create `src/features/feature-request/InterviewFlow.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { Conversation, FeatureRequestBody } from "@/api/models";
import { db } from "../../../tests/msw/db";
import { GREETING } from "../../../tests/msw/fixtures";
import { API, err } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";

const READY = {
  status: "ready" as const,
  draft: {
    title: "Snooze a task until a date",
    problem: "Tasks I cannot act on yet clutter the list.",
    proposedBehavior: "A snooze button hides the task until a date.",
    acceptanceCriteria: "It reappears on the chosen date.",
    outOfScope: "Recurring snoozes.",
  },
  score: {
    clarity: 4,
    complexity: 2,
    risk: 2,
    archChange: false,
    readiness: 15,
    reasons: { clarity: "Named", complexity: "Small", risk: "Low" },
  },
};

/** Records every filed body and answers 201 like the real route. */
function captureFiling(bodies: FeatureRequestBody[]) {
  server.use(
    http.post(`${API}/feature-requests`, async ({ request }) => {
      const body = (await request.json()) as FeatureRequestBody;
      bodies.push(body);
      const conversation = db.conversation;
      if (body.conversationId && conversation && conversation.id === body.conversationId) {
        db.conversation = { ...conversation, status: "filed", issueNumber: 42 };
      }
      return HttpResponse.json(
        {
          data: {
            issueNumber: 42,
            issueUrl: "https://github.com/kpnemo/kaizen-tasks-assembly-line/issues/42",
          },
          meta: { requestId: "req-test" },
        },
        { status: 201 },
      );
    }),
  );
}

/** Waits for the answer box to be usable, types, and sends. */
async function answer(user: UserEvent, text: string) {
  const box = await screen.findByRole("textbox", { name: "Your answer" });
  await waitFor(() => expect(box).toBeEnabled());
  await user.type(box, text);
  await user.click(screen.getByRole("button", { name: "Send" }));
}

describe("the feature-request interview", () => {
  it("starts a conversation on the first visit and shows the greeting", async () => {
    renderApp({ route: "/request-feature" });
    expect(await screen.findByText(GREETING)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kaizen assistant" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Your request" })).toBeInTheDocument();
    expect(screen.getAllByText("Not filled in yet")).toHaveLength(5);
    await waitFor(() => expect(db.conversation?.status).toBe("open"));
  });

  it("resumes the open conversation instead of starting a new one", async () => {
    const conversation = db.openConversation({ questionCount: 1 });
    renderApp({ route: "/request-feature" });
    expect(await screen.findByText(GREETING)).toBeInTheDocument();
    expect(db.conversation?.id).toBe(conversation.id);
  });

  it("toasts a failed start and reaches the greeting from Try again", async () => {
    server.use(
      http.post(
        `${API}/feature-requests/conversation`,
        () => err("UPSTREAM_ERROR", "Could not start the interview"),
        { once: true },
      ),
    );
    const { user } = renderApp({ route: "/request-feature" });
    expect(await screen.findByText("Could not start the interview")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText(GREETING)).toBeInTheDocument();
    expect(db.conversation?.status).toBe("open");
  });

  it("toasts a failed read of the open conversation and recovers from Try again", async () => {
    server.use(
      http.get(
        `${API}/feature-requests/conversation`,
        () => err("INTERNAL", "The conversation could not be read"),
        { once: true },
      ),
    );
    const { user } = renderApp({ route: "/request-feature" });
    expect(await screen.findByText("The conversation could not be read")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText(GREETING)).toBeInTheDocument();
  });

  it("streams the reply, then shows the chips and the growing draft", async () => {
    db.openConversation();
    const { user } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);
    await answer(user, "I want to snooze tasks");

    expect(
      await screen.findByRole("button", { name: "A team supervisor before a coaching session" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Got it. Who has this problem, and when does it come up?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Snooze a task until a date")).toBeInTheDocument();
    expect(screen.getAllByText("Not filled in yet")).toHaveLength(4);
  });

  it("sends a skip and counts it as an answered question", async () => {
    db.openConversation();
    const { user } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);
    await user.click(screen.getByRole("button", { name: "Skip this question" }));
    await waitFor(() => expect(db.conversation?.questionCount).toBe(1));
    expect(db.conversation?.messages.some((m) => m.skipped === true)).toBe(true);
    expect(db.conversation?.messages.at(-2)?.content).toBe("(skipped)");
  });

  it("opens the prefilled form from Review and file and files with the conversation id", async () => {
    const conversation = db.openConversation(READY);
    const bodies: FeatureRequestBody[] = [];
    captureFiling(bodies);
    const { user } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);
    expect(screen.getByText("Readiness 15 of 20")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review and file" }));

    expect(await screen.findByRole("form", { name: "Request a feature" })).toBeInTheDocument();
    expect(screen.getByText("Refined with the assistant · readiness 15 of 20")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Snooze a task until a date");
    expect(screen.getByLabelText("Acceptance criteria")).toHaveValue(
      "It reappears on the chosen date.",
    );

    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Request #42 filed" })).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
    expect(bodies[0].conversationId).toBe(conversation.id);
    expect(bodies[0].title).toBe("Snooze a task until a date");
  });

  it("interviews to readiness, files, and starts fresh afterwards", async () => {
    db.openConversation();
    const bodies: FeatureRequestBody[] = [];
    captureFiling(bodies);
    const { user } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);

    await answer(user, "A supervisor before a coaching session");
    await screen.findByText("Got it. Who has this problem, and when does it come up?");
    await answer(user, "A snooze control on each task");
    await screen.findByText("Thanks. What would you see on screen that you cannot see today?");
    await answer(user, "It reappears on the chosen date");
    await screen.findByText("Good. Name one thing you could check to say this works.");
    await answer(user, "That is everything");
    expect(
      await screen.findByText("That is enough to file. The request reads as ready."),
    ).toBeInTheDocument();

    expect(await screen.findByText("Readiness 16 of 20")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeDisabled();
    const filedId = db.conversation?.id;

    await user.click(screen.getByRole("button", { name: "Review and file" }));
    expect(await screen.findByRole("form", { name: "Request a feature" })).toBeInTheDocument();
    expect(screen.getByText("Refined with the assistant · readiness 16 of 20")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("heading", { name: "Request #42 filed" })).toBeInTheDocument();
    expect(bodies[0].conversationId).toBe(filedId);
    expect(db.conversation?.status).toBe("filed");

    // The next visit starts a new interview from the greeting (spec 2, "Review and file").
    await user.click(screen.getByRole("button", { name: "File another" }));
    expect(await screen.findByText(GREETING)).toBeInTheDocument();
    await waitFor(() => expect(db.conversation?.status).toBe("open"));
    expect(db.conversation?.id).not.toBe(filedId);
    expect(db.conversation?.messages).toHaveLength(1);
  });

  it("shows the plain form with no conversation id from the skip link", async () => {
    db.openConversation();
    const bodies: FeatureRequestBody[] = [];
    captureFiling(bodies);
    const { user } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);
    await user.click(screen.getByRole("link", { name: "Skip the interview, fill the form" }));

    expect(await screen.findByRole("form", { name: "Request a feature" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your request" })).toBeNull();
    expect(screen.getByLabelText("Title")).toHaveValue("");

    await user.type(screen.getByLabelText("Title"), "Snooze a task until Monday");
    await user.type(screen.getByLabelText("Problem"), "Tasks clutter the list.");
    await user.type(screen.getByLabelText("Proposed behavior"), "A snooze button.");
    await user.type(screen.getByLabelText("Acceptance criteria"), "It comes back on the date.");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0].conversationId).toBeUndefined();
  });

  it("shows a rate limit as a toast and leaves the input usable", async () => {
    db.openConversation();
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, () =>
        err("RATE_LIMITED", "Hourly limit reached", {
          scope: "user",
          limit: 60,
          resetAt: "2026-09-10T12:00:00.000Z",
        }),
      ),
    );
    const { user } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);
    await answer(user, "I want to snooze tasks");

    expect(await screen.findByText("Your hourly limit is reached")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue(
      "I want to snooze tasks",
    );
    expect(screen.getAllByText("I want to snooze tasks").length).toBeGreaterThan(1);
  });

  it("shows the stream's own error as a toast and keeps the transcript", async () => {
    db.openConversation();
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('event: delta\ndata: {"text":"Got"}\n\n'));
            controller.enqueue(
              encoder.encode(
                'event: error\ndata: {"code":"UPSTREAM_ERROR","message":"The assistant did not answer"}\n\n',
              ),
            );
            controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
            controller.close();
          },
        });
        return new HttpResponse(body, {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        });
      }),
    );
    const { user } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);
    await answer(user, "I want to snooze tasks");

    expect(await screen.findByText("The assistant did not answer")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeEnabled();
  });

  it("abandons the turn when the PM leaves mid-stream: no toast, no cache write", async () => {
    const conversation = db.openConversation();
    const answered: Conversation = { ...conversation, questionCount: 1 };
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            controller.enqueue(encoder.encode('event: delta\ndata: {"text":"Got it. "}\n\n'));
            await gate;
            controller.enqueue(
              encoder.encode(
                `event: state\ndata: ${JSON.stringify({ conversation: answered })}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
            controller.close();
          },
        });
        return new HttpResponse(body, {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        });
      }),
    );

    const { user, queryClient } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);
    await answer(user, "I want to snooze tasks");
    // Positive evidence that the stream was open before the PM walked away.
    expect(await screen.findByText("Got it.")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Tasks" }));
    await screen.findByRole("heading", { name: "Tasks" });
    release();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(
      queryClient.getQueryData<Conversation>(["feature-request", "conversation"])?.questionCount,
    ).toBe(0);
    // sonner marks each rendered toast with data-sonner-toast; the abort must not raise one.
    expect(document.querySelectorAll("[data-sonner-toast]")).toHaveLength(0);
  });

  it("keeps the two panels in one column and lets the grid shrink below 900px", async () => {
    db.openConversation();
    renderApp({ route: "/request-feature" });
    const grid = (await screen.findByRole("region", { name: "Your request" })).parentElement;
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-1");
    expect(grid?.className).toContain("min-[900px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/feature-request/InterviewFlow.test.tsx`

Expected: FAIL — the first case fails with `Unable to find an element with the text: Tell me the idea in a sentence or two: …`, because `RequestFeaturePage` still renders the plain form.

- [ ] **Step 3: Extract the form into its own component**

Create `src/features/feature-request/components/FeatureRequestForm.tsx` (the five fields, hints, and submit behaviour move here unchanged; the new parts are `initialValues`, `conversationId`, and `note`):

```tsx
import { useState, type ChangeEvent } from "react";
import { toApiError } from "@/api/errors";
import type { FeatureRequestBody, FeatureRequestDraft, FeatureRequestResult } from "@/api/models";
import { toastApiError } from "@/components/api-error-toast";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitFeatureRequest } from "../hooks";

const EMPTY: FeatureRequestBody = {
  title: "",
  problem: "",
  proposedBehavior: "",
  acceptanceCriteria: "",
  outOfScope: "",
};

const FIELDS: {
  key: keyof FeatureRequestDraft;
  label: string;
  hint: string;
  multiline: boolean;
}[] = [
  {
    key: "title",
    label: "Title",
    hint: "One line, the way you would name it in a release note",
    multiline: false,
  },
  { key: "problem", label: "Problem", hint: "What is hard today, and for whom", multiline: true },
  {
    key: "proposedBehavior",
    label: "Proposed behavior",
    hint: "What the product should do instead",
    multiline: true,
  },
  {
    key: "acceptanceCriteria",
    label: "Acceptance criteria",
    hint: "How we will know it works",
    multiline: true,
  },
  {
    key: "outOfScope",
    label: "Out of scope",
    hint: "What this request deliberately leaves out (optional)",
    multiline: true,
  },
];

/** The five-field issue form. With `initialValues` it opens prefilled from the interview draft and
 *  posts `conversationId` alongside the fields, so the issue carries the self-score and the
 *  transcript (spec 2, "Review and file"). Every value stays editable. */
export function FeatureRequestForm({
  initialValues,
  conversationId,
  note,
  onFiled,
}: {
  initialValues?: FeatureRequestDraft;
  conversationId?: string;
  note?: string;
  onFiled: (result: FeatureRequestResult) => void;
}) {
  const submit = useSubmitFeatureRequest();
  const [values, setValues] = useState<FeatureRequestBody>(() => ({ ...EMPTY, ...initialValues }));
  const error = submit.error ? toApiError(submit.error) : null;
  const fields = error?.fieldErrors() ?? {};

  return (
    <div className="space-y-8">
      <h1>Request a feature</h1>
      <p className="max-w-prose text-muted-foreground">
        The same five fields as the GitHub issue form. Clear requests with acceptance criteria get
        implemented first.
      </p>
      {note ? <p className="font-semibold text-muted-foreground">{note}</p> : null}
      <form
        aria-label="Request a feature"
        className="max-w-2xl space-y-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const body: FeatureRequestBody = {
            ...values,
            outOfScope: values.outOfScope?.trim() ? values.outOfScope : undefined,
            ...(conversationId ? { conversationId } : {}),
          };
          submit.mutate(body, {
            onSuccess: onFiled,
            onError: (e) => {
              if (toApiError(e).code !== "VALIDATION_ERROR") toastApiError(e);
            },
          });
        }}
      >
        {FIELDS.map((field) => {
          const id = `fr-${field.key}`;
          const shared = {
            id,
            value: values[field.key] ?? "",
            "aria-invalid": Boolean(fields[field.key]),
            "aria-describedby": fields[field.key] ? `${id}-error` : `${id}-hint`,
            onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              setValues((v) => ({ ...v, [field.key]: e.target.value })),
          };
          return (
            <Field
              key={field.key}
              id={id}
              label={field.label}
              hint={field.hint}
              error={fields[field.key]}
            >
              {field.multiline ? (
                <Textarea rows={3} {...shared} />
              ) : (
                <Input maxLength={200} {...shared} />
              )}
            </Field>
          );
        })}
        {error && error.code !== "VALIDATION_ERROR" ? (
          <p className="text-muted-foreground">
            Nothing was filed. Fix the problem above and send again.
          </p>
        ) : null}
        <Button type="submit" className="min-h-11 h-auto" disabled={submit.isPending}>
          Send request
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Turn the page into the switchboard**

Replace `src/features/feature-request/RequestFeaturePage.tsx` entirely with:

```tsx
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { FeatureRequestResult } from "@/api/models";
import { toastApiError } from "@/components/api-error-toast";
import { Button } from "@/components/ui/button";
import { ConversationPanel } from "./components/ConversationPanel";
import { DraftPanel } from "./components/DraftPanel";
import { FeatureRequestForm } from "./components/FeatureRequestForm";
import { useConversation, useFeatureRequestAvailable, useStartConversation } from "./hooks";

/** The three modes of /request-feature (spec 4.1): the interview by default, the prefilled form
 *  after "Review and file", and the plain form when the URL carries ?mode=form. */
export function RequestFeaturePage() {
  const { available } = useFeatureRequestAvailable();
  const [searchParams] = useSearchParams();
  const [reviewing, setReviewing] = useState(false);
  const [filed, setFiled] = useState<FeatureRequestResult | null>(null);
  const conversation = useConversation(available === true);
  const start = useStartConversation();

  const formOnly = searchParams.get("mode") === "form";
  const interview = available === true && !formOnly && !reviewing && filed === null;

  // useQuery has no onError in TanStack Query v5, so the read failure is toasted here. The start
  // failure toasts through useStartConversation's own onError.
  useEffect(() => {
    if (conversation.isError) toastApiError(conversation.error);
  }, [conversation.isError, conversation.error]);

  // Spec 2, "Start": resume the caller's open conversation, otherwise ask the API to create one
  // (its first assistant message is the fixed greeting). The ref re-arms whenever a conversation
  // exists, so "File another" opens a fresh interview.
  const requested = useRef(false);
  useEffect(() => {
    if (!interview) return;
    if (conversation.data) {
      requested.current = false;
      return;
    }
    if (conversation.isPending || conversation.isError || start.isPending || requested.current) {
      return;
    }
    requested.current = true;
    start.mutate();
  }, [interview, conversation.data, conversation.isPending, conversation.isError, start]);

  /** Clears the one-shot guard and re-reads; a `null` read then re-arms the auto-start. */
  function retryStart() {
    requested.current = false;
    start.reset();
    void conversation.refetch();
  }

  if (available === undefined) {
    return (
      <p role="status" className="text-muted-foreground">
        Checking availability
      </p>
    );
  }
  if (!available) {
    return (
      <div className="space-y-4">
        <h1>Request a feature</h1>
        <p className="text-muted-foreground">
          Feature requests are not available in this environment.
        </p>
      </div>
    );
  }
  if (filed) {
    return (
      <div className="space-y-4">
        <h1>Request #{filed.issueNumber} filed</h1>
        <p>
          Thank you. It is now in the queue the engineering harness triages.{" "}
          <a
            href={filed.issueUrl}
            className="font-semibold text-primary underline"
            target="_blank"
            rel="noreferrer"
          >
            Open the issue
          </a>
        </p>
        <Button
          variant="outline"
          className="min-h-11 h-auto"
          onClick={() => {
            setFiled(null);
            setReviewing(false);
          }}
        >
          File another
        </Button>
      </div>
    );
  }
  if (interview) {
    if (conversation.isError || start.isError) {
      // The message itself was toasted; this is the way back, not a second copy of the error.
      return (
        <div className="space-y-4">
          <h1>Request a feature</h1>
          <p className="max-w-prose text-muted-foreground">
            The interview could not be started. You can try again, or fill the form yourself.
          </p>
          <Button className="min-h-11 h-auto" onClick={retryStart}>
            Try again
          </Button>
          <Button asChild variant="link" className="min-h-11 h-auto self-start whitespace-normal">
            <Link to="/request-feature?mode=form">Skip the interview, fill the form</Link>
          </Button>
        </div>
      );
    }
    if (!conversation.data) {
      return (
        <p role="status" className="text-muted-foreground">
          Starting the interview
        </p>
      );
    }
    return (
      <div className="space-y-6">
        <h1>Request a feature</h1>
        <p className="max-w-prose text-muted-foreground">
          Answer a few questions and the assistant fills the request beside you. Nothing is filed
          until you review it.
        </p>
        <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ConversationPanel conversation={conversation.data} />
          <DraftPanel conversation={conversation.data} onReview={() => setReviewing(true)} />
        </div>
      </div>
    );
  }

  const refined = reviewing ? conversation.data : null;
  const score = refined?.score ?? null;
  return (
    <FeatureRequestForm
      initialValues={refined?.draft}
      conversationId={refined?.id}
      note={score ? `Refined with the assistant · readiness ${score.readiness} of 20` : undefined}
      onFiled={setFiled}
    />
  );
}
```

- [ ] **Step 5: Adjust the three existing form tests so they reach the form**

In `src/features/feature-request/RequestFeaturePage.test.tsx`, make exactly these three edits; every assertion stays as it is.

1. In `"shows the link when health reports featureRequests true and files the request"`, after the heading assertion insert:

```tsx
await user.click(screen.getByRole("link", { name: "Skip the interview, fill the form" }));
await screen.findByRole("form", { name: "Request a feature" });
```

2. In `"maps VALIDATION_ERROR onto the field"`, change the render line to:

```tsx
const { user } = renderApp({ route: "/request-feature?mode=form" });
```

3. In `"shows an upstream failure as a toast with the request id"`, change the render line to:

```tsx
const { user } = renderApp({ route: "/request-feature?mode=form" });
```

- [ ] **Step 6: Run both page test files to verify they pass**

Run: `npx vitest run src/features/feature-request`

Expected: `RequestFeaturePage.test.tsx` `6 passed`, `InterviewFlow.test.tsx` `13 passed`, `hooks.test.tsx` `8 passed`, `components/ConversationPanel.test.tsx` `8 passed`, `components/DraftPanel.test.tsx` `5 passed`.

- [ ] **Step 7: Run the whole suite, lint, and typecheck**

Run: `npm test && npm run lint && npm run typecheck`

Expected: all files pass; lint and typecheck clean.

- [ ] **Step 8: Check the narrow layout by hand**

jsdom has no layout engine, so the class contract in step 1 is the only automated guard. Confirm the real thing once:

```bash
VITE_PROXY_TARGET=http://localhost:3000 npm run dev
```

Open `http://localhost:5173/request-feature` and check three widths in the browser's device toolbar: **1280px** (two columns, chat wider than the draft), **900px** (still two columns, no horizontal scrollbar, the longest option chip wraps onto two lines inside its own chip), and **375px** (one column, the draft below the chat, still no horizontal scrollbar, and the "Skip the interview, fill the form" link wraps rather than pushing the panel wide). Note the result in the pull request description.

- [ ] **Step 9: Add the CHANGELOG bullets and run the docs gate**

Under `## [Unreleased]` → `### Added` in `CHANGELOG.md`:

```markdown
- `/request-feature` is an interview: two panels side by side from 900px (stacked below, chips and links wrapping rather than overflowing), the assistant's questions on the left and the live draft on the right; "Review and file" opens the existing form prefilled with the note `Refined with the assistant · readiness N of 20` and files it with `conversationId`; `?mode=form` still shows the plain form. A failed start is toasted and offers "Try again"; leaving the page mid-answer cancels the turn.
```

Under `## [Unreleased]` add a `### Changed` section with:

```markdown
- The five-field request form moved into `components/FeatureRequestForm.tsx` and now takes `initialValues`, `conversationId`, and a note line; `RequestFeaturePage` is the switchboard over the interview, the review, and the plain form. `src/app/router.tsx` is unchanged.
```

Run: `npm run docs:check`

Expected: `docs-check: OK`

- [ ] **Step 10: Commit**

```bash
git add src/features/feature-request CHANGELOG.md
git commit -m "$(cat <<'EOM'
feat: the request-a-feature interview switchboard and prefilled form

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOM
)"
```

---

### Task 8: Docs and the 1.1.0 release cut

**Files:**

- Modify: `README.md` (Features list, Selector contract table, Docs section)
- Modify: `CHANGELOG.md` (release cut)
- Modify: `package.json`, `package-lock.json` (version bump)

**Interfaces:**

- Consumes: the accessible names produced by Tasks 5, 6, and 7 — heading `Kaizen assistant`, list `Conversation`, textbox `Your answer`, button `Send`, button `Skip this question`, button `Start over`, region `Your request`, button `Review and file`, link `Skip the interview, fill the form`, and one button per option chip named by its own text.
- Produces: version `1.1.0` in `package.json` (the same number the API repo cuts, per `CLAUDE.md`'s "Versions" convention and spec 5), and the selector rows a future smoke step can drive.

The spec fixes the number: "ships as 1.1.0 in both app repos". The smoke test itself does not change in this release (spec 4.4).

- [ ] **Step 1: Re-pull the contract from `develop` and confirm no drift**

The web PR merges after the API's does (spec 6, step 3: "the contract on `develop` must match").

```bash
npm run api:pull -- develop
git diff --stat src/api/openapi.json src/api/types.ts
npm test
```

Expected: no diff in either file (the API branch was merged unchanged), and the suite still green. If either file changed, commit both with the trailer before continuing — Rule B requires `types.ts` to be regenerated in the same change.

- [ ] **Step 2: Add the feature to the README's feature list**

In `README.md`, under "## Features", directly after the existing bullet that begins `- Request a feature: the issue form's five fields`, add:

```markdown
- Request a feature, refined: an assistant interviews you one question at a time, the five fields fill in live beside the chat with a readiness chip, and "Review and file" opens the form prefilled and files it with the transcript and the self-score; "Skip the interview, fill the form" goes straight to the plain form
```

- [ ] **Step 3: Add the selector-contract rows**

In `README.md`, in the "## Selector contract (smoke test)" table, add three rows directly above the `| Anywhere  | log out |` row:

```markdown
| Interview | chat | heading "Kaizen assistant"; list "Conversation"; textbox "Your answer"; button "Send" (URL `/request-feature`) |
| Interview | chips | button "Skip this question", button "Start over", and one button per option named by its own visible text |
| Interview | draft | region "Your request"; button "Review and file"; link "Skip the interview, fill the form" (href `/request-feature?mode=form`) |
```

- [ ] **Step 4: List ADR 0005 in the README's Docs section**

Replace the ADR line under "## Docs":

```markdown
- `docs/adr/`: 0001 same-origin proxy, 0002 contract copied not linked, 0003 access token in memory,
  0004 version in the footer, 0005 streamed conversation through the typed client.
```

- [ ] **Step 5: Verify the documented names actually exist**

```bash
npx vitest run src/features/feature-request 2>&1 | tail -20
grep -c 'Skip the interview, fill the form' README.md src/features/feature-request/components/DraftPanel.tsx
```

Expected: the feature's tests pass, and the grep prints `README.md:1` and `DraftPanel.tsx:1`.

- [ ] **Step 6: Cut 1.1.0 with the `release-notes` skill**

Follow `.claude/skills/release-notes/SKILL.md`. The version is fixed by the spec at `1.1.0` (a new feature, matching the API repo's number on the same day), so step 2 of that skill needs no judgement call.

In `CHANGELOG.md`, insert `## [1.1.0] - 2026-09-10` directly below `## [Unreleased]` and move every `### Added` and `### Changed` subsection accumulated by Tasks 1 to 7 under it, keeping Keep a Changelog order and the bullets in the order they were added. Leave `## [Unreleased]` in place with no bullets.

```bash
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.version = "1.1.0";
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
'
npm install --package-lock-only
```

- [ ] **Step 7: Run the gates**

Run: `npm run lint && npm test && npm run typecheck && npm run docs:check`

Expected: all clean, and `docs-check: OK` — Rule A accepts the release cut because the diff adds a dated version heading.

- [ ] **Step 8: Commit the docs and the release**

```bash
git add README.md
git commit -m "$(cat <<'EOM'
docs: README feature bullet and selector rows for the interview

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOM
)"

git add CHANGELOG.md package.json package-lock.json
git commit -m "$(cat <<'EOM'
chore: release 1.1.0

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOM
)"
```

- [ ] **Step 9: Push the branch and stop**

```bash
git push -u origin feat/interview-agent
```

The pull request to `develop` is opened by the controller, not by this plan. Nothing here merges anything, and nothing pushes to `develop` or `main`.

---

## Self-Review

**1. Spec coverage**

| Spec                                                                                                                                                                                                     | Where                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Goal — interview, live fields, review then file, transcript on the issue                                                                                                                               | Tasks 4 to 7 (the `conversationId` on the filed body carries the transcript, which the API appends)                                     |
| 2 Chat panel: transcript, streaming reply, 3–4 option chips, skip chip, "Your answer" + Send, Enter sends / Shift+Enter newline, input disabled while streaming, thinking indicator until the first word | Task 5                                                                                                                                  |
| 2 Your request panel: five read-only fields with placeholders, readiness chip with sub-scores in `title`, "Review and file", "Skip the interview, fill the form"                                         | Task 6                                                                                                                                  |
| 2 Start: resume the open conversation, otherwise create one whose first message is the greeting; a failed start is recoverable                                                                           | Task 7 (auto-start effect, the toast, and "Try again"), Task 3 (the greeting fixture)                                                   |
| 2 Turns, Ready                                                                                                                                                                                           | Task 3's scripted four turns; Task 6's `ready` predicate; Task 7's end-to-end run to readiness                                          |
| 2 Review and file: prefilled editable form, the note line, `conversationId` on the post, success shows the issue link, the conversation is cleared and the next visit is fresh                           | Tasks 4 (`useSubmitFeatureRequest` clears the cached conversation) and 7 (the end-to-end test files then reaches a new greeting)        |
| 2 Skip the interview                                                                                                                                                                                     | Task 6 link, Task 7 `?mode=form`                                                                                                        |
| 2 Start over                                                                                                                                                                                             | Task 5                                                                                                                                  |
| 2 Errors: toast through `toastApiError`, input re-enabled, the transcript keeps the PM's message, rate limit names the hour                                                                              | Task 4 (`pendingMessage`, `toastApiError`, the 429 `details` assertions), Task 5, Task 7's rate-limit and stream-error tests            |
| 2 Projector rules and the narrow layout                                                                                                                                                                  | Global Constraints; `min-h-11 h-auto whitespace-normal` chips and `min-w-0` panels in Tasks 5 to 7; Task 5 step 5; Task 7 steps 1 and 8 |
| 3.2 the four routes, the `Conversation` shape, the 429 `details`, submit's 404 and 409                                                                                                                   | Task 1 aliases, Task 3 handlers and the rejection test, Task 4's rate-limit test                                                        |
| 3.2 the body ends right after `done`; the client treats the end of the body as completion                                                                                                                | Task 2's parser and its final-frame test, Task 4's `mutationFn` comment                                                                 |
| 3.3 stream protocol: `delta`, `state`, `error`, `done`, `: ping` comments, abort on disconnect                                                                                                           | Task 2 parser and its tests, Task 3's `sse()` helper, Task 4's `AbortController` and unmount test, Task 7's leave-mid-stream test       |
| 4.1 `conversation-stream.ts`                                                                                                                                                                             | Task 2                                                                                                                                  |
| 4.1 hooks                                                                                                                                                                                                | Task 4                                                                                                                                  |
| 4.1 `RequestFeaturePage` switchboard                                                                                                                                                                     | Task 7                                                                                                                                  |
| 4.1 `ConversationPanel`, `DraftPanel`, the form's new props                                                                                                                                              | Tasks 5, 6, 7                                                                                                                           |
| 4.2 MSW handlers and every listed test                                                                                                                                                                   | Tasks 3 to 7; the existing form tests stay green (Task 7 step 5)                                                                        |
| 4.3 `Caddyfile` unchanged, no `flush_interval`, `vite.config.ts` unchanged                                                                                                                               | No task touches them; stated in the header's architecture note, in Global Constraints, in decision 15, and in ADR 0005's consequences   |
| 4.4 accessible names and the README selector rows; the smoke test unchanged                                                                                                                              | Tasks 5, 6 and Task 8 step 3                                                                                                            |
| 5 Web docs: ADR 0005, README features and selector rows, CHANGELOG, release 1.1.0                                                                                                                        | Tasks 1 and 8                                                                                                                           |
| 6 Order: pull from `feat/interview-agent`, work on that branch, PR to `develop` after A2                                                                                                                 | Task 1 steps 1 and 4, Task 8 steps 1 and 9                                                                                              |

Not in scope for this lane and deliberately absent: everything in spec 3.1, 3.4, 3.5, 3.6, 3.7 (API), and the assembly-line bullet in spec 5.

**2. Placeholder scan**

No "TBD", "TODO", "implement later", "add appropriate error handling", or "similar to Task N" appears. Every code step carries the code; every test step carries the test; every run step carries the command and the expected result. The one repeated block (the form's `FIELDS` array) is written out in full in Task 7 rather than referenced, because it moves file.

**3. Type consistency**

- `Conversation`, `ConversationMessage`, `FeatureRequestDraft`, `RubricScore`, `ConversationTurnBody`, `ConversationEvent`, `StreamBody` are defined in Task 1 and used with those exact names in Tasks 2 to 7.
- `readConversationStream(stream, handlers)` and `ConversationStreamHandlers` (`onDelta`, `onState`, `onError`, `onDone`) are defined in Task 2 and called with exactly those four handler names in Tasks 3 and 4.
- `conversationKey` is `["feature-request", "conversation"]` in Task 4 and read with that name in Tasks 4, 5, and (as the literal) 7.
- `SendTurnVariables` is `{ id, content, skip? }` in Task 4 and passed in that shape by Task 5.
- `useSendTurn()` returns `send`, `reset`, `isStreaming`, `streamingText`, `pendingMessage` in Task 4; Task 5 uses exactly those five names.
- `useConversation(enabled: boolean)` takes its flag in Task 4 and is called as `useConversation(available === true)` in Task 7 and `useConversation(true)` in the Task 5 harness.
- `db.openConversation`, `db.startConversation`, `db.advanceTurn`, `db.conversation`, `C_OPEN`, `sse`, `GREETING`, `makeConversation`, `makeMessage`, `EMPTY_DRAFT` are defined in Task 3 and used with those names in Tasks 4 to 7.
- `DraftPanel({ conversation, onReview })` and `ConversationPanel({ conversation })` are defined in Tasks 5 and 6 and used with those props in Task 7 and in the Task 5 harness.
- `FeatureRequestForm({ initialValues, conversationId, note, onFiled })` is defined and used only in Task 7.
- The chip class strings are the same three utilities everywhere they are asserted: `min-h-11`, `h-auto`, `whitespace-normal` (Task 5's `CHIP`, Task 6's `WRAPS`, and the class assertions in both test files).
- The placeholder string `Not filled in yet`, the chip copy `Readiness N of 20` / `Readiness not scored yet`, the title format `Clarity C · Complexity X · Risk R`, and the note `Refined with the assistant · readiness N of 20` are identical in Task 6, Task 7, and their tests.
