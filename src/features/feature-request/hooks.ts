import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { client, unwrap } from "@/api/client";
import { readConversationStream } from "@/api/conversation-stream";
import { ApiError } from "@/api/errors";
import { healthQueryOptions } from "@/api/health-query";
import type { Conversation, FeatureRequestBody, FeatureRequestSummary } from "@/api/models";
import { toastApiError } from "@/components/api-error-toast";

/** The caller's one open or ready conversation. `null` means "none yet" (the API answers 404). */
export const conversationKey = ["feature-request", "conversation"] as const;

/** GET /feature-requests: every request filed so far, open first then closed (issue #22). */
export const featureRequestsKey = ["feature-request", "list"] as const;

export function useFeatureRequests() {
  return useQuery({
    queryKey: featureRequestsKey,
    queryFn: async (): Promise<FeatureRequestSummary[]> =>
      unwrap(await client.GET("/feature-requests")).data,
    staleTime: 10_000,
  });
}

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
      // The new issue belongs at the top of "Requests so far" without a reload (issue #22).
      void queryClient.invalidateQueries({ queryKey: featureRequestsKey });
    },
  });
}
