import { describe, expect, it } from "vitest";
import { ApiError, isApiError, toApiError } from "./errors";

function res(status: number, headers: Record<string, string> = {}) {
  return new Response(null, { status, headers });
}

describe("ApiError.fromResponse", () => {
  it("decodes the error envelope", () => {
    const err = ApiError.fromResponse(res(409), {
      error: { code: "CONFLICT", message: "Already working on it", requestId: "req-1" },
    });
    expect(err.code).toBe("CONFLICT");
    expect(err.message).toBe("Already working on it");
    expect(err.status).toBe(409);
    expect(err.requestId).toBe("req-1");
  });

  it("falls back to INTERNAL for a body that is not an envelope", () => {
    const err = ApiError.fromResponse(res(502, { "x-request-id": "req-2" }), "<html>");
    expect(err.code).toBe("INTERNAL");
    expect(err.status).toBe(502);
    expect(err.requestId).toBe("req-2");
    expect(err.message).toContain("502");
  });

  it("falls back to INTERNAL for an unknown code", () => {
    const err = ApiError.fromResponse(res(418), {
      error: { code: "TEAPOT", message: "short and stout", requestId: "req-3" },
    });
    expect(err.code).toBe("INTERNAL");
    expect(err.message).toBe("short and stout");
  });
});

describe("ApiError helpers", () => {
  it("maps VALIDATION_ERROR details onto field names without the body prefix", () => {
    const err = ApiError.fromResponse(res(400), {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: [
          { path: "body.title", message: "Title is required" },
          { path: "body.title", message: "Duplicate message is ignored" },
          { path: "query.limit", message: "Too large" },
        ],
        requestId: "req-4",
      },
    });
    expect(err.fieldErrors()).toEqual({ title: "Title is required", limit: "Too large" });
  });

  it("returns no field errors for other codes", () => {
    const err = new ApiError({ code: "NOT_FOUND", message: "Missing", status: 404 });
    expect(err.fieldErrors()).toEqual({});
    expect(err.rateLimit()).toBeNull();
  });

  it("exposes RATE_LIMITED details", () => {
    const err = ApiError.fromResponse(res(429), {
      error: {
        code: "RATE_LIMITED",
        message: "Hourly limit reached",
        details: { scope: "global", limit: 300, resetAt: "2026-09-22T10:00:00.000Z" },
        requestId: "req-5",
      },
    });
    expect(err.rateLimit()).toEqual({
      scope: "global",
      limit: 300,
      resetAt: "2026-09-22T10:00:00.000Z",
    });
  });

  it("wraps unknown throwables", () => {
    expect(isApiError(new Error("x"))).toBe(false);
    const wrapped = toApiError(new TypeError("Failed to fetch"));
    expect(wrapped.code).toBe("INTERNAL");
    expect(wrapped.message).toBe("Failed to fetch");
    expect(toApiError(wrapped)).toBe(wrapped);
  });
});
