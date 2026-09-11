import { CircleAlert, CircleSlash, RefreshCw, Sparkles } from "lucide-react";
import { Link } from "react-router";
import type { TaskSummary } from "@/api/models";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { pluralize, skipReasonLabel } from "@/lib/format";

/** The AI state of a list row, in words (spec 4.3 and the smoke selector contract): one Badge
 *  variant per meaning (secondary while the assistant works or stood down, default for a count of
 *  suggestions, destructive for a failure) and one lucide icon per state, so no state is told by
 *  colour alone. The count comes from the summary's `suggestionCount` (ruling R1); the smoke test
 *  only needs the word "failed" and the "N suggestions" pattern. The failure's message and its
 *  Retry are `AiFailureAlert`, which the row places on its own line. */
export function AiChip({ task }: { task: TaskSummary }) {
  switch (task.aiStatus) {
    case "pending":
    case "running":
      return (
        <Badge variant="secondary" className="animate-thinking">
          <Sparkles aria-hidden="true" />
          Thinking
        </Badge>
      );
    case "done":
      if (task.suggestionCount === 0) return null;
      return (
        <Badge asChild>
          <Link to={`/tasks/${task.id}`}>
            <Sparkles aria-hidden="true" />
            {pluralize(task.suggestionCount, "suggestion")}
          </Link>
        </Badge>
      );
    case "skipped":
      return (
        <Badge variant="secondary">
          <CircleSlash aria-hidden="true" />
          {skipReasonLabel(task.aiSkipReason)}
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <CircleAlert aria-hidden="true" />
          Breakdown failed
        </Badge>
      );
    default:
      return null;
  }
}

/** A failed breakdown's message, where nothing clips it: an Alert that keeps "Breakdown failed"
 *  and the API's `aiError` together in one alert, beside an outline Retry that spins while the
 *  breakdown is requested again and keeps its name meanwhile. */
export function AiFailureAlert({
  task,
  onRetry,
  retrying = false,
  className,
}: {
  task: TaskSummary;
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-6", className)}>
      <Alert variant="destructive" className="text-base">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Breakdown failed</AlertTitle>
        {task.aiError ? (
          <AlertDescription className="text-base">{task.aiError}</AlertDescription>
        ) : null}
      </Alert>
      <Button variant="outline" onClick={onRetry} disabled={retrying}>
        {retrying ? (
          <Spinner data-icon="inline-start" aria-hidden="true" />
        ) : (
          <RefreshCw data-icon="inline-start" aria-hidden="true" />
        )}
        Retry
      </Button>
    </div>
  );
}
