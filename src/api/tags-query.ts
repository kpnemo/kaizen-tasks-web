import { useQuery } from "@tanstack/react-query";
import { client, unwrap } from "./client";

export const tagKeys = { all: ["tags"] as const };

/** The user's tags, shared by the tasks and tags features. */
export function useTags() {
  return useQuery({
    queryKey: tagKeys.all,
    queryFn: async () => unwrap(await client.GET("/tags")).data,
    staleTime: 30_000,
  });
}
