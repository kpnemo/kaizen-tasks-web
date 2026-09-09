import { RefreshCw, Sparkles } from "lucide-react";
import { Link } from "react-router";
import type { TaskSummary } from "@/api/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pluralize, skipReasonLabel } from "@/lib/format";

/** The AI state of a list row, in words (spec 4.3 and the smoke selector contract). The count and
 *  the failure message come from the summary's `suggestionCount` and `aiError` (ruling R1); the
 *  smoke test only needs the word "failed" and the "N suggestions" pattern. */
export function AiChip({
  task,
  onRetry,
  retrying = false,
}: {
  task: TaskSummary;
  onRetry: () => void;
  retrying?: boolean;
}) {
  switch (task.aiStatus) {
    case "pending":
    case "running":
      return (
        <Badge
          className="animate-thinking gap-1 bg-accent text-accent-foreground"
          aria-live="polite"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Thinking
        </Badge>
      );
    case "done":
      if (task.suggestionCount === 0) return null;
      return (
        <Badge asChild className="gap-1 bg-primary text-primary-foreground">
          <Link to={`/tasks/${task.id}`}>
            <Sparkles className="size-4" aria-hidden="true" />
            {pluralize(task.suggestionCount, "suggestion")}
          </Link>
        </Badge>
      );
    case "skipped":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {skipReasonLabel(task.aiSkipReason)}
        </Badge>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-2">
          <Badge variant="destructive">
            Breakdown failed{task.aiError ? `: ${task.aiError}` : ""}
          </Badge>
          <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </span>
      );
  }
}
