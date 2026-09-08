import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import type { ErrorCode } from "@/api/models";
import { Toaster } from "@/components/ui/sonner";
import { toastApiError } from "./api-error-toast";

function apiError(code: ErrorCode, message: string, details?: unknown) {
  return new ApiError({ code, message, status: 400, details, requestId: "req-42" });
}

function show(error: unknown) {
  render(<Toaster />);
  act(() => toastApiError(error));
}

describe("toastApiError", () => {
  it("VALIDATION_ERROR lists the fields", async () => {
    show(
      apiError("VALIDATION_ERROR", "Invalid request", [
        { path: "body.title", message: "Title is required" },
      ]),
    );
    expect(await screen.findByText("Check the highlighted fields")).toBeInTheDocument();
    expect(screen.getByText("title: Title is required")).toBeInTheDocument();
  });

  it("RATE_LIMITED shows the scope and the reset time", async () => {
    show(
      apiError("RATE_LIMITED", "Hourly limit reached", {
        scope: "global",
        limit: 300,
        resetAt: "2026-09-22T10:30:00.000Z",
      }),
    );
    expect(await screen.findByText("The session's hourly limit is reached")).toBeInTheDocument();
    expect(screen.getByText(/Try again after \d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it("UNAVAILABLE says the assistant is paused", async () => {
    show(apiError("UNAVAILABLE", "AI is paused"));
    expect(await screen.findByText("The assistant is paused")).toBeInTheDocument();
  });

  it("CONFLICT shows the message", async () => {
    show(apiError("CONFLICT", "Already working on it"));
    expect(await screen.findByText("Already working on it")).toBeInTheDocument();
  });

  it("UNAUTHORIZED renders nothing (the client middleware owns it)", async () => {
    show(apiError("UNAUTHORIZED", "Token expired"));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Token expired")).not.toBeInTheDocument();
  });

  it("every other code shows the message with the request id", async () => {
    show(apiError("INTERNAL", "Something broke"));
    expect(await screen.findByText("Something broke")).toBeInTheDocument();
    expect(screen.getByText("Request req-42")).toBeInTheDocument();
  });

  it("wraps non-API errors", async () => {
    show(new TypeError("Failed to fetch"));
    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
  });
});
