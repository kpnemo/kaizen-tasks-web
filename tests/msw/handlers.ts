import { http, HttpResponse } from "msw";
import type {
  Conversation,
  ConversationEvent,
  ConversationTurnBody,
  CreateTagBody,
  CreateTaskBody,
  ErrorCode,
  FeatureRequestBody,
  FeatureRequestSummary,
  ReplaceTagsBody,
  UpdateMeBody,
  UpdateTagBody,
  UpdateTaskBody,
} from "@/api/models";
import pkg from "../../package.json";
import { db, makeTag, makeTask, nextId } from "./db";
import { demoUser } from "./fixtures";

export const API = "http://localhost:3000/api/v1";
export const DEMO_PASSWORD = "kaizen-demo-2026";
export const REQUEST_ID = "req-test";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  UNAVAILABLE: 503,
  INTERNAL: 500,
};

/** Success envelope: { data, meta: { requestId, ...meta } }. */
export function ok<T>(data: T, meta: Record<string, unknown> = {}, status = 200) {
  return HttpResponse.json({ data, meta: { requestId: REQUEST_ID, ...meta } }, { status });
}

/** Error envelope with the status derived from the code, exactly like the API. */
export function err(code: ErrorCode, message: string, details?: unknown) {
  return HttpResponse.json(
    { error: { code, message, details, requestId: REQUEST_ID } },
    { status: STATUS[code], headers: { "x-request-id": REQUEST_ID } },
  );
}

const noContent = () => new HttpResponse(null, { status: 204 });
type IdParams = { id: string };

export const authHandlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email === demoUser.email && body.password === DEMO_PASSWORD) {
      return ok({ user: demoUser, accessToken: "access-1" });
    }
    return err("UNAUTHORIZED", "Invalid email or password");
  }),
  http.post(`${API}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string; displayName: string };
    if (body.email === demoUser.email)
      return err("CONFLICT", "An account with this email already exists");
    return ok(
      {
        user: {
          ...demoUser,
          id: "22222222-2222-4222-8222-222222222222",
          email: body.email,
          displayName: body.displayName,
        },
        accessToken: "access-new",
      },
      {},
      201,
    );
  }),
  http.post(`${API}/auth/refresh`, () => ok({ accessToken: "access-refreshed" })),
  http.post(`${API}/auth/logout`, noContent),
  http.get(`${API}/auth/me`, ({ request }) => {
    if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
      return err("UNAUTHORIZED", "Missing token");
    }
    return ok({ user: demoUser });
  }),
  http.patch(`${API}/auth/me`, async ({ request }) => {
    if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
      return err("UNAUTHORIZED", "Missing token");
    }
    const body = (await request.json()) as UpdateMeBody;
    return ok({ user: { ...demoUser, theme: body.theme } });
  }),
];

function newestFirst(a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) {
  return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
}

export const taskHandlers = [
  http.get(`${API}/tasks`, ({ request }) => {
    const q = new URL(request.url).searchParams;
    const parentId = q.get("parentId");
    const status = q.get("status");
    const tagId = q.get("tagId");
    const limit = Number(q.get("limit") ?? 50);
    const cursor = q.get("cursor");
    let rows = db.rows.filter((r) => (parentId ? r.parentId === parentId : r.parentId === null));
    if (status) rows = rows.filter((r) => r.status === status);
    if (tagId) rows = rows.filter((r) => r.tags.some((t) => t.id === tagId));
    rows = [...rows].sort(newestFirst);
    const start = cursor ? rows.findIndex((r) => r.id === cursor) : 0;
    if (start < 0) {
      return err("VALIDATION_ERROR", "Invalid request", [
        { path: "query.cursor", message: "Bad cursor" },
      ]);
    }
    const page = rows.slice(start, start + limit);
    return ok(
      page.map((r) => db.summary(r)),
      { nextCursor: rows[start + limit]?.id ?? null },
    );
  }),
  http.post(`${API}/tasks`, async ({ request }) => {
    const body = (await request.json()) as CreateTaskBody;
    if (!body.title || !body.title.trim()) {
      return err("VALIDATION_ERROR", "Invalid request", [
        { path: "body.title", message: "Title is required" },
      ]);
    }
    const parent = body.parentId ? db.find(body.parentId) : undefined;
    if (body.parentId && !parent) return err("NOT_FOUND", "Task not found");
    const tagIds = body.tagIds ?? [];
    const tags = db.tags.filter((t) => tagIds.includes(t.id));
    if (tags.length !== tagIds.length) {
      return err("VALIDATION_ERROR", "Invalid request", [
        { path: "body.tagIds", message: "Unknown tag" },
      ]);
    }
    const now = new Date().toISOString();
    const row = makeTask({
      id: nextId("t"),
      title: body.title,
      description: body.description ?? null,
      parentId: body.parentId ?? null,
      aiStatus: parent ? "skipped" : "pending",
      position: parent ? db.children(parent.id).length : 0,
      tags,
      createdAt: now,
      updatedAt: now,
    });
    db.rows.push(row);
    return ok(db.detail(row.id), {}, 201);
  }),
  http.get<IdParams>(`${API}/tasks/:id`, ({ params }) => {
    const detail = db.detail(params.id);
    return detail ? ok(detail) : err("NOT_FOUND", "Task not found");
  }),
  http.patch<IdParams>(`${API}/tasks/:id`, async ({ params, request }) => {
    const row = db.find(params.id);
    if (!row) return err("NOT_FOUND", "Task not found");
    const body = (await request.json()) as UpdateTaskBody;
    if (body.suggestionState !== undefined && row.origin !== "ai") {
      return err("VALIDATION_ERROR", "Invalid request", [
        { path: "body.suggestionState", message: "Only AI suggestions carry a suggestion state" },
      ]);
    }
    if (body.title !== undefined) row.title = body.title;
    if (body.description !== undefined) row.description = body.description;
    if (body.status !== undefined) row.status = body.status;
    if (body.suggestionState !== undefined) row.suggestionState = body.suggestionState;
    if (body.position !== undefined) db.move(row, body.position);
    row.updatedAt = new Date().toISOString();
    return ok(db.detail(row.id));
  }),
  http.delete<IdParams>(`${API}/tasks/:id`, ({ params }) => {
    if (!db.find(params.id)) return err("NOT_FOUND", "Task not found");
    db.remove(params.id);
    return noContent();
  }),
  http.post<IdParams>(`${API}/tasks/:id/breakdown`, ({ params }) => {
    const row = db.find(params.id);
    if (!row) return err("NOT_FOUND", "Task not found");
    if (row.aiStatus === "pending" || row.aiStatus === "running") {
      return err("CONFLICT", "Already working on it");
    }
    row.aiStatus = "pending";
    row.aiError = null;
    row.aiSkipReason = null;
    return ok(db.detail(row.id), {}, 202);
  }),
  http.post<IdParams>(`${API}/tasks/:id/suggestions/accept-all`, ({ params }) => {
    if (!db.find(params.id)) return err("NOT_FOUND", "Task not found");
    for (const c of db.children(params.id))
      if (c.suggestionState === "suggested") c.suggestionState = "accepted";
    return ok(db.detail(params.id));
  }),
  http.post<IdParams>(`${API}/tasks/:id/suggestions/dismiss-all`, ({ params }) => {
    if (!db.find(params.id)) return err("NOT_FOUND", "Task not found");
    for (const c of db.children(params.id))
      if (c.suggestionState === "suggested") c.suggestionState = "dismissed";
    return ok(db.detail(params.id));
  }),
  http.put<IdParams>(`${API}/tasks/:id/tags`, async ({ params, request }) => {
    const row = db.find(params.id);
    if (!row) return err("NOT_FOUND", "Task not found");
    const body = (await request.json()) as ReplaceTagsBody;
    const tags = db.tags.filter((t) => body.tagIds.includes(t.id));
    if (tags.length !== body.tagIds.length) {
      return err("VALIDATION_ERROR", "Invalid request", [
        { path: "body.tagIds", message: "Unknown tag" },
      ]);
    }
    row.tags = tags;
    return ok(db.detail(row.id));
  }),
];

export const tagHandlers = [
  http.get(`${API}/tags`, () => ok(db.tags)),
  http.post(`${API}/tags`, async ({ request }) => {
    const body = (await request.json()) as CreateTagBody;
    if (db.tags.some((t) => t.name.toLowerCase() === body.name.toLowerCase())) {
      return err("CONFLICT", "A tag with this name already exists");
    }
    const tag = makeTag({
      id: nextId("tag"),
      name: body.name,
      color: body.color,
      createdAt: new Date().toISOString(),
    });
    db.tags.push(tag);
    return ok(tag, {}, 201);
  }),
  http.patch<IdParams>(`${API}/tags/:id`, async ({ params, request }) => {
    const tag = db.tags.find((t) => t.id === params.id);
    if (!tag) return err("NOT_FOUND", "Tag not found");
    const body = (await request.json()) as UpdateTagBody;
    if (
      body.name !== undefined &&
      db.tags.some((t) => t.id !== tag.id && t.name.toLowerCase() === body.name!.toLowerCase())
    ) {
      return err("CONFLICT", "A tag with this name already exists");
    }
    if (body.name !== undefined) tag.name = body.name;
    if (body.color !== undefined) tag.color = body.color;
    for (const row of db.rows) row.tags = row.tags.map((t) => (t.id === tag.id ? { ...tag } : t));
    return ok(tag);
  }),
  http.delete<IdParams>(`${API}/tags/:id`, ({ params }) => {
    if (!db.tags.some((t) => t.id === params.id)) return err("NOT_FOUND", "Tag not found");
    db.tags = db.tags.filter((t) => t.id !== params.id);
    for (const row of db.rows) row.tags = row.tags.filter((t) => t.id !== params.id);
    return noContent();
  }),
];

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

/** One row of GET /feature-requests as the API shapes it; override what a test cares about. */
export function featureRequestSummary(
  over: Partial<FeatureRequestSummary> & { number: number },
): FeatureRequestSummary {
  return {
    title: `Request ${over.number}`,
    state: "open",
    stage: "triaged",
    readiness: 16,
    labels: ["feature-request", "clarity:5", "complexity:3", "risk:3", "triaged"],
    url: `https://github.com/kpnemo/kaizen-tasks-assembly-line/issues/${over.number}`,
    createdAt: "2026-09-09T13:09:53Z",
    closedAt: null,
    ...over,
  };
}

let featureRequestList: FeatureRequestSummary[] = [];
/** What GET /feature-requests answers by default; reset to empty before every test. */
export function setFeatureRequestList(items: FeatureRequestSummary[]): void {
  featureRequestList = items;
}

export const featureRequestHandlers = [
  http.get(`${API}/feature-requests`, () => ok(featureRequestList)),
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

/** The health payload. `features.featureRequests` is the flag the request-a-feature feature reads (R2). */
export function healthBody(featureRequests = true) {
  return {
    status: "ok" as const,
    commit: "test-sha",
    version: pkg.version,
    env: "test",
    checks: { db: "ok", redis: "ok" },
    features: { featureRequests },
  };
}

export const healthHandlers = [http.get(`${API}/health`, () => ok(healthBody()))];

export const handlers = [
  ...authHandlers,
  ...taskHandlers,
  ...tagHandlers,
  ...featureRequestHandlers,
  ...conversationHandlers,
  ...healthHandlers,
];
