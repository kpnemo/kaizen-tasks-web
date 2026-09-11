import { CircleAlert, Info, RefreshCw, Sparkles } from "lucide-react";
import type { TaskDetail } from "@/api/models";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { skipReasonLabel } from "@/lib/format";
import { isAiActive } from "@/lib/polling";
import { useBreakdown } from "../hooks";
import { BANNER_ACTIONS, BANNER_ACTIONS_TWO_ROWS, BANNER_ROW } from "./banner";

/** AI state under the header: thinking, failed with retry, skipped with reason, or nothing when
 *  done — once done and settled, Regenerate lives next to the status group in `TaskHeader`
 *  instead of in a lone row here, so it stays reachable without pushing the suggestions further
 *  down the page. Regenerate is always offered somewhere and disabled while a generation is
 *  pending or running. Three states, one `Alert` shape: the failed one is destructive and keeps
 *  the alert role; the other two are status regions named "Assistant". */
export function AiBanner({ task }: { task: TaskDetail }) {
  const breakdown = useBreakdown();
  const active = isAiActive(task);
  const rerun = (label: string) => (
    <Button
      variant="outline"
      onClick={() => breakdown.mutate(task.id)}
      disabled={active || breakdown.isPending}
    >
      {breakdown.isPending ? (
        <Spinner data-icon="inline-start" aria-hidden="true" />
      ) : (
        <RefreshCw data-icon="inline-start" aria-hidden="true" />
      )}
      {label}
    </Button>
  );

  if (active) {
    return (
      <Alert role="status" aria-label="Assistant" className={cn(BANNER_ROW, "animate-thinking")}>
        <Sparkles aria-hidden="true" />
        <AlertTitle>Thinking about the steps</AlertTitle>
        <div className={BANNER_ACTIONS}>{rerun("Regenerate")}</div>
      </Alert>
    );
  }
  if (task.aiStatus === "failed") {
    return (
      <Alert variant="destructive" className={BANNER_ROW}>
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Breakdown failed</AlertTitle>
        <AlertDescription className="text-base">{task.aiError ?? "Try again"}</AlertDescription>
        <div className={BANNER_ACTIONS_TWO_ROWS}>{rerun("Retry")}</div>
      </Alert>
    );
  }
  if (task.aiStatus === "skipped") {
    return (
      <Alert role="status" aria-label="Assistant" className={BANNER_ROW}>
        <Info aria-hidden="true" />
        <AlertTitle>The assistant skipped this task</AlertTitle>
        <AlertDescription className="text-base">
          {skipReasonLabel(task.aiSkipReason)}
        </AlertDescription>
        <div className={BANNER_ACTIONS_TWO_ROWS}>{rerun("Regenerate")}</div>
      </Alert>
    );
  }
  return null;
}
