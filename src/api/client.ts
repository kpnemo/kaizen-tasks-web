import createClient, { type Middleware } from "openapi-fetch";
import { authStore } from "./auth-store";
import { ApiError } from "./errors";
import type { paths } from "./types";

/**
 * Same-origin API root. The path is always the relative "/api/v1"; resolving it against the
 * page origin only makes jsdom and the browser agree on the absolute form. No other origin exists.
 */
export const API_BASE = new URL("/api/v1", window.location.origin).href;

/** A 401 from these routes is an answer, not an expired token. */
const AUTH_ROUTES = new Set(["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"]);

/** Routes that need no session: no bearer token is attached and a 401 never triggers a refresh, so
 *  the footer's health read can never touch the auth state. */
const PUBLIC_ROUTES = new Set(["/health"]);

let refreshInFlight: Promise<string | null> | null = null;

/** POST /auth/refresh once, shared by every concurrent caller. Resolves to the new token or null. */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as { data?: { accessToken?: unknown } };
        return typeof body.data?.accessToken === "string" ? body.data.accessToken : null;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/** Clones of in-flight requests, keyed by openapi-fetch's per-request id, kept until the response arrives. */
const replayable = new Map<string, Request>();

const authMiddleware: Middleware = {
  async onRequest({ request, id, schemaPath }) {
    if (PUBLIC_ROUTES.has(schemaPath)) return request;
    const token = authStore.getToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    if (!AUTH_ROUTES.has(schemaPath)) replayable.set(id, request.clone());
    return request;
  },
  async onResponse({ response, id }) {
    const clone = replayable.get(id);
    replayable.delete(id);
    if (response.status !== 401 || !clone) return response;

    const token = await refreshAccessToken();
    if (!token) {
      authStore.clear();
      return response;
    }
    authStore.setToken(token);
    clone.headers.set("Authorization", `Bearer ${token}`);
    const replay = await fetch(clone);
    if (replay.status === 401) authStore.clear();
    return replay;
  },
};

export const client = createClient<paths>({ baseUrl: API_BASE, credentials: "include" });
client.use(authMiddleware);

/** Throws ApiError for any non-2xx result; returns the parsed body otherwise. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw ApiError.fromResponse(result.response, result.error);
  }
  return result.data as T;
}
