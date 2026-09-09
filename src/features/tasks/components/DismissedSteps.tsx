import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { TaskSummary } from "@/api/models";
import { Button } from "@/components/ui/button";
import { useUpdateTask } from "../hooks";

/** "N dismissed" disclosure with an undo per step (undo sets the step to accepted). */
export function DismissedSteps({ steps }: { steps: TaskSummary[] }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateTask();
  return (
    <div>
      <Button
        variant="ghost"
        aria-expanded={open}
        aria-controls="dismissed-steps"
        onClick={() => setOpen((o) => !o)}
        className="text-muted-foreground"
      >
        {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        {steps.length} dismissed
      </Button>
      {open ? (
        <ul id="dismissed-steps" aria-label="Dismissed steps" className="mt-2 space-y-2">
          {steps.map((step) => (
            <li
              key={step.id}
              className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-2 text-muted-foreground"
            >
              <span className="flex-1 line-through">{step.title}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => update.mutate({ id: step.id, suggestionState: "accepted" })}
              >
                Undo
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
