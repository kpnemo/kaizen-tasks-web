import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authStore } from "@/api/auth-store";
import { ApiError } from "@/api/errors";
import type { Conversation } from "@/api/models";
import { toastApiError } from "@/components/api-error-toast";
import { db } from "../../../tests/msw/db";
import { demoUser } from "../../../tests/msw/fixtures";
import { API, err } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { makeQueryClient } from "../../../tests/render";
import { conversationKey, useConversation, useSendTurn, useStartConversation } from "./hooks";

// `renderHook` mounts only `QueryClientProvider`, no `<Toaster />`, so a sonner DOM query can never
// see a toast either way; a spy on the one function every toast goes through is the real assertion
// (`vitest.config.ts`'s `restoreMocks: true` clears its call history before every test).
vi.mock("@/components/api-error-toast", () => ({ toastApiError: vi.fn() }));

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

  it("sends finish: true and shows the finish label as the pending message", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, async ({ request }) => {
        bodies.push(await request.json());
        return err("UPSTREAM_ERROR", "stop here");
      }),
    );
    const { result } = renderHook(() => useSendTurn(), { wrapper: wrap(makeQueryClient()) });
    act(() =>
      result.current.send({ id: "c-1", content: "Finish with what we have", finish: true }),
    );
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ content: "Finish with what we have", finish: true });
    expect(result.current.pendingMessage).toBe("Finish with what we have");
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
    expect(toastApiError).not.toHaveBeenCalled();
  });
});
