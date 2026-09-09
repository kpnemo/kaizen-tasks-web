import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toastApiError } from "@/components/api-error-toast";
import { client, unwrap } from "./client";
import { isApiError } from "./errors";
import type { CreateTagBody, UpdateTagBody } from "./models";

export const tagKeys = { all: ["tags"] as const };

/** The user's tags, shared by the tasks and tags features. */
export function useTags() {
  return useQuery({
    queryKey: tagKeys.all,
    queryFn: async () => unwrap(await client.GET("/tags")).data,
    staleTime: 30_000,
  });
}

/** Tags are embedded in task rows, so every tag change refreshes both caches. */
function useInvalidateTagsAndTasks() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: tagKeys.all });
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };
}

/** CONFLICT (duplicate name) is left to the caller so it can land on the name field. */
export function useCreateTag() {
  const invalidate = useInvalidateTagsAndTasks();
  return useMutation({
    mutationFn: async (body: CreateTagBody) => unwrap(await client.POST("/tags", { body })).data,
    onSuccess: invalidate,
    onError: (error) => {
      if (!(isApiError(error) && error.code === "CONFLICT")) toastApiError(error);
    },
  });
}

export function useUpdateTag() {
  const invalidate = useInvalidateTagsAndTasks();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateTagBody & { id: string }) =>
      unwrap(await client.PATCH("/tags/{id}", { params: { path: { id } }, body })).data,
    onSuccess: invalidate,
    onError: toastApiError,
  });
}

export function useDeleteTag() {
  const invalidate = useInvalidateTagsAndTasks();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await client.DELETE("/tags/{id}", { params: { path: { id } } }));
    },
    onSuccess: invalidate,
    onError: toastApiError,
  });
}
