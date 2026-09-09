import { queryOptions } from "@tanstack/react-query";
import { client } from "./client";
import type { Health } from "./models";

/** GET /health, read once per session. `null` when the API is unhealthy (503) so callers can tell
 *  "unknown" from "unavailable". Shared by the footer (version and commit) and feature detection
 *  (`data.features.featureRequests`), so both read the same cached response. */
export const healthQueryOptions = queryOptions({
  queryKey: ["health"],
  queryFn: async (): Promise<Health | null> => {
    const result = await client.GET("/health");
    return result.data?.data ?? null;
  },
  staleTime: Infinity,
  gcTime: Infinity,
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
});
