import { useMutation, useQuery } from "@tanstack/react-query";
import { client, unwrap } from "@/api/client";
import type { FeatureRequestBody } from "@/api/models";

/** Whether the running API mounted the feature-request route: `data.features.featureRequests` from
 *  GET /health (master plan interface "Health", ruling R2). Read once per session; `undefined` while
 *  unknown; a failing health check (503 UNAVAILABLE) counts as unavailable. */
export function useFeatureRequestAvailable(): { available: boolean | undefined } {
  const query = useQuery({
    queryKey: ["health", "features"],
    queryFn: async () => {
      const result = await client.GET("/health");
      return result.data?.data.features?.featureRequests === true;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return { available: query.data };
}

export function useSubmitFeatureRequest() {
  return useMutation({
    mutationFn: async (body: FeatureRequestBody) =>
      unwrap(await client.POST("/feature-requests", { body })).data,
  });
}
