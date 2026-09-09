import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { client, unwrap } from "@/api/client";
import { ApiError, isApiError } from "@/api/errors";
import type {
  CreateTaskBody,
  TaskDetail,
  TaskListEnvelope,
  TaskStatus,
  UpdateTaskBody,
} from "@/api/models";
import { toastApiError } from "@/components/api-error-toast";
import { activeAiInterval, DETAIL_POLL_MS, isAiActive, LIST_POLL_MS } from "@/lib/polling";

export type TaskFilters = { status?: TaskStatus; tagId?: string };

export const taskKeys = {
  all: ["tasks"] as const,
  list: (filters: TaskFilters) => ["tasks", filters] as const,
  detail: (id: string) => ["tasks", id] as const,
};

const isListQuery = (queryKey: readonly unknown[]) =>
  queryKey[0] === "tasks" && typeof queryKey[1] === "object" && queryKey[1] !== null;

/** Invalidates every list query without touching cached details. */
export function invalidateTaskLists(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ predicate: (query) => isListQuery(query.queryKey) });
}

export function useTasks(filters: TaskFilters) {
  return useInfiniteQuery({
    queryKey: taskKeys.list(filters),
    queryFn: async ({ pageParam }) =>
      unwrap(
        await client.GET("/tasks", {
          params: { query: { ...filters, limit: 50, cursor: pageParam ?? undefined } },
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last: TaskListEnvelope) => last.meta.nextCursor ?? null,
    refetchInterval: (query) =>
      activeAiInterval(
        query.state.data?.pages.flatMap((page) => page.data),
        LIST_POLL_MS,
      ),
  });
}

export function useTask(id: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async () => unwrap(await client.GET("/tasks/{id}", { params: { path: { id } } })).data,
    refetchInterval: (q) => activeAiInterval(q.state.data, DETAIL_POLL_MS),
  });

  // When the AI settles, refresh the list so its chips update (spec 4.4).
  const wasActive = useRef(false);
  useEffect(() => {
    const active = isAiActive(query.data);
    if (wasActive.current && !active) void invalidateTaskLists(queryClient);
    wasActive.current = active;
  }, [query.data, queryClient]);

  return query;
}

function useSettleDetail() {
  const queryClient = useQueryClient();
  return (task: TaskDetail) => {
    queryClient.setQueryData(taskKeys.detail(task.id), task);
    if (task.parentId) {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(task.parentId) });
    }
    void invalidateTaskLists(queryClient);
  };
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const settle = useSettleDetail();
  return useMutation({
    mutationFn: async (body: CreateTaskBody) => unwrap(await client.POST("/tasks", { body })).data,
    onSuccess: (task) => {
      if (!task.parentId) {
        // Show the new root first, in thinking state, before the list refetch lands.
        queryClient.setQueriesData<{ pages: TaskListEnvelope[]; pageParams: unknown[] }>(
          { predicate: (query) => isListQuery(query.queryKey) },
          (old) =>
            old
              ? {
                  ...old,
                  pages: old.pages.map((page, i) =>
                    i === 0 ? { ...page, data: [task, ...page.data] } : page,
                  ),
                }
              : old,
        );
      }
      settle(task);
    },
    onError: toastApiError,
  });
}

export function useUpdateTask() {
  const settle = useSettleDetail();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateTaskBody & { id: string }) =>
      unwrap(await client.PATCH("/tasks/{id}", { params: { path: { id } }, body })).data,
    onSuccess: settle,
    onError: toastApiError,
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; parentId: string | null }) => {
      unwrap(await client.DELETE("/tasks/{id}", { params: { path: { id } } }));
    },
    onSuccess: (_data, { id, parentId }) => {
      queryClient.removeQueries({ queryKey: taskKeys.detail(id) });
      if (parentId) void queryClient.invalidateQueries({ queryKey: taskKeys.detail(parentId) });
      void invalidateTaskLists(queryClient);
    },
    onError: toastApiError,
  });
}

/** Runs or re-runs the breakdown. A CONFLICT means a generation is already active. */
export function useBreakdown() {
  const settle = useSettleDetail();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await client.POST("/tasks/{id}/breakdown", { params: { path: { id } } })).data,
    onSuccess: settle,
    onError: (error) => {
      if (isApiError(error) && error.code === "CONFLICT") {
        toastApiError(
          new ApiError({
            code: "CONFLICT",
            message: "Already working on it",
            status: 409,
            requestId: error.requestId,
          }),
        );
        return;
      }
      toastApiError(error);
    },
  });
}

export function useAcceptAll() {
  const settle = useSettleDetail();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await client.POST("/tasks/{id}/suggestions/accept-all", { params: { path: { id } } }))
        .data,
    onSuccess: settle,
    onError: toastApiError,
  });
}

export function useDismissAll() {
  const settle = useSettleDetail();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await client.POST("/tasks/{id}/suggestions/dismiss-all", { params: { path: { id } } }))
        .data,
    onSuccess: settle,
    onError: toastApiError,
  });
}

export function useReplaceTags() {
  const settle = useSettleDetail();
  return useMutation({
    mutationFn: async ({ id, tagIds }: { id: string; tagIds: string[] }) =>
      unwrap(await client.PUT("/tasks/{id}/tags", { params: { path: { id } }, body: { tagIds } }))
        .data,
    onSuccess: settle,
    onError: toastApiError,
  });
}
