import { http, HttpResponse } from "msw";
import type { ErrorCode } from "@/api/models";
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
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API}/auth/me`, ({ request }) => {
    if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
      return err("UNAUTHORIZED", "Missing token");
    }
    return ok({ user: demoUser });
  }),
];

export const handlers = [...authHandlers];
