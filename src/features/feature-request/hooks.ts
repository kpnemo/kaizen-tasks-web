import { useMutation, useQuery } from "@tanstack/react-query";
import { client, unwrap } from "@/api/client";
import { healthQueryOptions } from "@/api/health-query";
import type { FeatureRequestBody } from "@/api/models";

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

export function useSubmitFeatureRequest() {
  return useMutation({
    mutationFn: async (body: FeatureRequestBody) =>
      unwrap(await client.POST("/feature-requests", { body })).data,
  });
}
