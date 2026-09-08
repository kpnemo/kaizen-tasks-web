import type { ErrorCode, ErrorEnvelope } from "./models";

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "UPSTREAM_ERROR",
  "UNAVAILABLE",
  "INTERNAL",
] as const satisfies readonly ErrorCode[];

export type ValidationDetail = { path: string; message: string };
export type RateLimitDetails = { scope: "user" | "global"; limit: number; resetAt: string };

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

/** Every failed API call is thrown as an ApiError decoded from the error envelope. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;
  readonly requestId: string;

  constructor(input: {
    code: ErrorCode;
    message: string;
    status: number;
    details?: unknown;
    requestId?: string;
  }) {
    super(input.message);
    this.name = "ApiError";
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
    this.requestId = input.requestId ?? "";
  }

  /** VALIDATION_ERROR details keyed by field name, with the "body." / "query." / "params." prefix removed. */
  fieldErrors(): Record<string, string> {
    if (this.code !== "VALIDATION_ERROR" || !Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const detail of this.details as Partial<ValidationDetail>[]) {
      if (typeof detail?.path !== "string" || typeof detail.message !== "string") continue;
      const key = detail.path.replace(/^(body|query|params)\./, "");
      if (!(key in out)) out[key] = detail.message;
    }
    return out;
  }

  /** RATE_LIMITED details, or null for any other code or a malformed payload. */
  rateLimit(): RateLimitDetails | null {
    if (this.code !== "RATE_LIMITED") return null;
    const d = this.details as Partial<RateLimitDetails> | null | undefined;
    if (!d || typeof d.resetAt !== "string") return null;
    return {
      scope: d.scope === "global" ? "global" : "user",
      limit: Number(d.limit ?? 0),
      resetAt: d.resetAt,
    };
  }

  static fromResponse(response: Response, body: unknown): ApiError {
    const headerId = response.headers.get("x-request-id") ?? "";
    const envelope = body as Partial<ErrorEnvelope> | null | undefined;
    const error = envelope && typeof envelope === "object" ? envelope.error : undefined;
    if (error && typeof error === "object" && typeof error.message === "string") {
      return new ApiError({
        code: isErrorCode(error.code) ? error.code : "INTERNAL",
        message: error.message,
        status: response.status,
        details: error.details,
        requestId: typeof error.requestId === "string" ? error.requestId : headerId,
      });
    }
    return new ApiError({
      code: "INTERNAL",
      message: `Request failed with status ${response.status}`,
      status: response.status,
      requestId: headerId,
    });
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Normalizes anything thrown around a request (network failures included) into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  return new ApiError({
    code: "INTERNAL",
    message: error instanceof Error ? error.message : "Something went wrong",
    status: 0,
  });
}
