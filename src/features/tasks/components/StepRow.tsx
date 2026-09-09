import { Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import type { TaskSummary } from "@/api/models";
import { InlineText } from "@/components/inline-text";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";
import { useUpdateTask } from "../hooks";
import { RationalePopover } from "./RationalePopover";

export function StepRow({ step }: { step: TaskSummary }) {
  const update = useUpdateTask();
  const [editing, setEditing] = useState(false);
  const acceptAfterEdit = useRef(false);
  const suggested = step.origin === "ai" && step.suggestionState === "suggested";
  const accepted = step.origin === "ai" && step.suggestionState === "accepted";
  const titleId = `step-${step.id}-title`;

  function saveTitle(title: string) {
    update.mutate({
      id: step.id,
      title,
      ...(acceptAfterEdit.current ? { suggestionState: "accepted" as const } : {}),
    });
  }

  return (
    <li
      aria-labelledby={titleId}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3",
        suggested && "border-primary/40 bg-accent/30",
      )}
    >
      <span className="flex min-h-11 min-w-11 items-center justify-center">
        <Checkbox
          checked={step.status === "done"}
          aria-label={`Mark ${step.title} done`}
          disabled={suggested}
          onCheckedChange={(checked) =>
            update.mutate({ id: step.id, status: checked === true ? "done" : "todo" })
          }
        />
      </span>
      <div id={titleId} className="min-w-0 flex-1">
        <InlineText
          label="Step title"
          value={step.title}
          editing={editing}
          onEditingChange={(next) => {
            setEditing(next);
            if (!next) acceptAfterEdit.current = false;
          }}
          onSave={saveTitle}
          className={cn("text-lg", step.status === "done" && "text-muted-foreground line-through")}
        />
      </div>
      {suggested ? <RationalePopover rationale={step.rationale} /> : null}
      {accepted ? (
        <Sparkles
          className="size-4 text-primary"
          aria-label="Suggested by AI, accepted"
          role="img"
        />
      ) : null}
      {suggested ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => update.mutate({ id: step.id, suggestionState: "accepted" })}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            title="Edit the wording, then accept"
            onClick={() => {
              acceptAfterEdit.current = true;
              setEditing(true);
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => update.mutate({ id: step.id, suggestionState: "dismissed" })}
          >
            Dismiss
          </Button>
        </div>
      ) : null}
    </li>
  );
}
