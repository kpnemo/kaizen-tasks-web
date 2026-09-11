import { CheckCheck, Sparkles, X } from "lucide-react";
import type { TaskDetail } from "@/api/models";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { pluralize } from "@/lib/format";
import { useAcceptAll, useDismissAll } from "../hooks";
import { BANNER_ACTIONS, BANNER_ROW } from "./banner";

/** "N suggestions to review" with Accept all and Dismiss all: a group, not an alert, since it
 *  states what is on the page rather than interrupting. The count stays one text node. */
export function BulkBar({ task }: { task: TaskDetail }) {
  const acceptAll = useAcceptAll();
  const dismissAll = useDismissAll();
  const count = task.children.filter((c) => c.suggestionState === "suggested").length;
  if (count === 0) return null;
  return (
    <Alert role="group" aria-label="Suggestions" className={BANNER_ROW}>
      <Sparkles aria-hidden="true" />
      <AlertTitle>{`${pluralize(count, "suggestion")} to review`}</AlertTitle>
      <div className={BANNER_ACTIONS}>
        <Button onClick={() => acceptAll.mutate(task.id)} disabled={acceptAll.isPending}>
          {acceptAll.isPending ? (
            <Spinner data-icon="inline-start" aria-hidden="true" />
          ) : (
            <CheckCheck data-icon="inline-start" aria-hidden="true" />
          )}
          Accept all
        </Button>
        <Button
          variant="outline"
          onClick={() => dismissAll.mutate(task.id)}
          disabled={dismissAll.isPending}
        >
          {dismissAll.isPending ? (
            <Spinner data-icon="inline-start" aria-hidden="true" />
          ) : (
            <X data-icon="inline-start" aria-hidden="true" />
          )}
          Dismiss all
        </Button>
      </div>
    </Alert>
  );
}
