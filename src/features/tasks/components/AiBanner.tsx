import { RefreshCw, Sparkles } from "lucide-react";
import type { TaskDetail } from "@/api/models";
import { Button } from "@/components/ui/button";
import { skipReasonLabel } from "@/lib/format";
import { isAiActive } from "@/lib/polling";
import { useBreakdown } from "../hooks";

/** AI state under the header: thinking, failed with retry, skipped with reason, or nothing when
 *  done. Regenerate is always offered and disabled while a generation is pending or running. */
export function AiBanner({ task }: { task: TaskDetail }) {
  const breakdown = useBreakdown();
  const active = isAiActive(task);
  const regenerate = (
    <Button
      variant="outline"
      onClick={() => breakdown.mutate(task.id)}
      disabled={active || breakdown.isPending}
    >
      <RefreshCw aria-hidden="true" />
      Regenerate
    </Button>
  );

  if (active) {
    return (
      <div
        role="status"
        aria-label="Assistant"
        className="animate-thinking flex flex-wrap items-center gap-3 rounded-xl bg-accent px-4 py-3 text-accent-foreground"
      >
        <Sparkles className="size-5" aria-hidden="true" />
        <span className="flex-1 font-semibold">Thinking about the steps</span>
        {regenerate}
      </div>
    );
  }
  if (task.aiStatus === "failed") {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/50 bg-card px-4 py-3"
      >
        <span className="flex-1 font-semibold">
          Breakdown failed: {task.aiError ?? "try again"}
        </span>
        <Button onClick={() => breakdown.mutate(task.id)} disabled={breakdown.isPending}>
          <RefreshCw aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }
  if (task.aiStatus === "skipped") {
    return (
      <div
        role="status"
        aria-label="Assistant"
        className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-muted-foreground"
      >
        <span className="flex-1">
          The assistant skipped this task: {skipReasonLabel(task.aiSkipReason)}
        </span>
        {regenerate}
      </div>
    );
  }
  return <div className="flex justify-end">{regenerate}</div>;
}
