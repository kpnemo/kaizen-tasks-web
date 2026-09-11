import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "@/api/client";
import { toApiError } from "@/api/errors";
import { healthQueryOptions } from "@/api/health-query";
import type {
  DeployStagingResult,
  PipelineSnapshot,
  ShipBody,
  ShipResult,
  ShipRetryBody,
} from "@/api/models";
import { toastApiError } from "@/components/api-error-toast";

/** The one snapshot the page lives on. Every mutation invalidates it on success. */
export const pipelineKey = ["pipeline"] as const;

/** The page refetches while it is on screen, the interval the task list already uses while the
 *  assistant works; the API answers from a 30-second cache, so this costs it nothing (ADR 0010). */
export const PIPELINE_POLL_MS = 10_000;

/** Whether the running API mounted the pipeline routes: `data.features.pipeline` from GET /health,
 *  read through the shared health query so the footer, the request link and this page share one
 *  request per session. `undefined` only while the answer is still on its way. A failing health
 *  check counts as unavailable, whichever way it fails: a 503 the query surfaces as `null`, or a
 *  request that never got an answer and left the query in error. The page must never sit on its
 *  skeletons waiting for a feature it cannot confirm. */
export function usePipelineAvailable(): { available: boolean | undefined } {
  const query = useQuery(healthQueryOptions);
  if (query.isError) return { available: false };
  const available = query.data === undefined ? undefined : query.data?.features.pipeline === true;
  return { available };
}

/** GET /pipeline, polled every ten seconds while mounted and never in a background tab. `enabled`
 *  is false until health has confirmed the feature, so it never fires on an API without it. */
export function usePipeline(enabled: boolean) {
  return useQuery({
    queryKey: pipelineKey,
    enabled,
    queryFn: async (): Promise<PipelineSnapshot> => unwrap(await client.GET("/pipeline")).data,
    refetchInterval: PIPELINE_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

/** The dialog maps every ApiError itself (wrong passphrase, lockout, conflict, and the rest inline),
 *  so only a failure that never reached the API is toasted, the way every other request is. */
function toastNetworkFailure(error: unknown): void {
  if (toApiError(error).status === 0) toastApiError(error);
}

function useInvalidatePipeline() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: pipelineKey });
}

export type DeployStagingVariables = { number: number; passphrase: string };

/** POST /pipeline/issues/{number}/deploy-staging: merges the issue's green pull requests. */
export function useDeployStaging() {
  const invalidate = useInvalidatePipeline();
  return useMutation({
    mutationFn: async ({
      number,
      passphrase,
    }: DeployStagingVariables): Promise<DeployStagingResult> =>
      unwrap(
        await client.POST("/pipeline/issues/{number}/deploy-staging", {
          params: { path: { number } },
          body: { passphrase },
        }),
      ).data,
    onSuccess: invalidate,
    onError: toastNetworkFailure,
  });
}

/** POST /pipeline/ship: dispatches the ship workflow for the version and issue set the button
 *  showed, echoed back so the API can refuse a stale click. */
export function useShip() {
  const invalidate = useInvalidatePipeline();
  return useMutation({
    mutationFn: async (body: ShipBody): Promise<ShipResult> =>
      unwrap(await client.POST("/pipeline/ship", { body })).data,
    onSuccess: invalidate,
    onError: toastNetworkFailure,
  });
}

/** POST /pipeline/ship/retry: re-dispatches a failed or cancelled ship with the version recorded
 *  on the issue, never recomputed. */
export function useRetryShip() {
  const invalidate = useInvalidatePipeline();
  return useMutation({
    mutationFn: async (body: ShipRetryBody): Promise<ShipResult> =>
      unwrap(await client.POST("/pipeline/ship/retry", { body })).data,
    onSuccess: invalidate,
    onError: toastNetworkFailure,
  });
}
