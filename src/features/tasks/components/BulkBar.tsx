import { Sparkles } from "lucide-react";
import type { TaskDetail } from "@/api/models";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { useAcceptAll, useDismissAll } from "../hooks";

export function BulkBar({ task }: { task: TaskDetail }) {
  const acceptAll = useAcceptAll();
  const dismissAll = useDismissAll();
  const count = task.children.filter((c) => c.suggestionState === "suggested").length;
  if (count === 0) return null;
  return (
    <div
      role="group"
      aria-label="Suggestions"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-accent/40 px-4 py-3"
    >
      <Sparkles className="size-5 text-primary" aria-hidden="true" />
      <span className="flex-1 font-semibold">{pluralize(count, "suggestion")} to review</span>
      <Button onClick={() => acceptAll.mutate(task.id)} disabled={acceptAll.isPending}>
        Accept all
      </Button>
      <Button
        variant="outline"
        onClick={() => dismissAll.mutate(task.id)}
        disabled={dismissAll.isPending}
      >
        Dismiss all
      </Button>
    </div>
  );
}
