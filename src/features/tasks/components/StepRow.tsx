import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import type { TaskSummary } from "@/api/models";
import { InlineText } from "@/components/inline-text";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";
import { useUpdateTask } from "../hooks";
import { RationalePopover } from "./RationalePopover";

export function StepRow({
  step,
  onMoveUp,
  onMoveDown,
}: {
  step: TaskSummary;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const update = useUpdateTask();
  const [editing, setEditing] = useState(false);
  const acceptAfterEdit = useRef(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });
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
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-labelledby={titleId}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border bg-card px-3 py-3",
        suggested && "border-primary/40 bg-accent/30",
        isDragging && "opacity-70 shadow-lg",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label="Drag to reorder"
        className="grid size-11 cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-accent"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" aria-hidden="true" />
      </button>
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
      <div className="flex">
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Move ${step.title} up`}
          onClick={onMoveUp}
          disabled={!onMoveUp}
          className={cn(!onMoveUp && "invisible")}
        >
          <ChevronUp aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Move ${step.title} down`}
          onClick={onMoveDown}
          disabled={!onMoveDown}
          className={cn(!onMoveDown && "invisible")}
        >
          <ChevronDown aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
