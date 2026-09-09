import type { AiStatus } from "@/api/models";

export const LIST_POLL_MS = 3000;
export const DETAIL_POLL_MS = 2000;

type WithAi = { aiStatus: AiStatus };

export function isAiActive(task: WithAi | null | undefined): boolean {
  return task?.aiStatus === "pending" || task?.aiStatus === "running";
}

/** Refetch interval for a query holding one task or many: the interval while any is active, else false. */
export function activeAiInterval(
  data: WithAi | WithAi[] | null | undefined,
  intervalMs: number,
): number | false {
  const tasks = Array.isArray(data) ? data : data ? [data] : [];
  return tasks.some(isAiActive) ? intervalMs : false;
}
