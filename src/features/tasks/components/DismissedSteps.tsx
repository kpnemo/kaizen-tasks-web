import { ChevronRight, Undo2, X } from "lucide-react";
import { useState } from "react";
import type { TaskSummary } from "@/api/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { useUpdateTask } from "../hooks";

/** "N dismissed" disclosure with an undo per step (undo sets the step to accepted). */
export function DismissedSteps({ steps }: { steps: TaskSummary[] }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateTask();
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-3">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="group self-start">
          <ChevronRight
            aria-hidden="true"
            className="transition-transform group-data-[state=open]:rotate-90"
          />
          {`${steps.length} dismissed`}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul aria-label="Dismissed steps" className="flex flex-col gap-3">
          {steps.map((step) => {
            const undoing = update.isPending && update.variables?.id === step.id;
            return (
              <li
                key={step.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border bg-card px-4 py-2"
              >
                <span className="min-w-0 text-muted-foreground line-through">{step.title}</span>
                <Badge variant="outline">
                  <X aria-hidden="true" />
                  Dismissed
                </Badge>
                <Button
                  variant="outline"
                  onClick={() => update.mutate({ id: step.id, suggestionState: "accepted" })}
                  disabled={undoing}
                >
                  {undoing ? (
                    <Spinner data-icon="inline-start" aria-hidden="true" />
                  ) : (
                    <Undo2 data-icon="inline-start" aria-hidden="true" />
                  )}
                  Undo
                </Button>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
