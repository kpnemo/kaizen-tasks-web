import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Ellipsis,
  GripVertical,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import type { TaskSummary } from "@/api/models";
import { InlineText } from "@/components/inline-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { useUpdateTask } from "../hooks";
import { RationalePopover } from "./RationalePopover";

/** One step: a grid row (handle, done, title, actions) so the action column never wraps under
 *  the title at the projector's width; the title cell is the one that gives way. A suggested step
 *  carries the tint, the "Suggested by AI" pill, Accept, and a row menu with the two rarer choices. */
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
  // "Edit wording, then accept" hands focus to the editor. The menu must not pull it back to its
  // trigger on close: the editor saves on blur and would close before a key was pressed.
  const editorTakesFocus = useRef(false);
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
  const accepting = update.isPending && update.variables?.suggestionState === "accepted";
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
        "grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-card px-3 py-3",
        suggested && "border-primary/40 bg-accent/30",
        isDragging && "opacity-70 shadow-lg",
      )}
    >
      <Button
        ref={setActivatorNodeRef}
        variant="ghost"
        size="icon-lg"
        className="size-11 cursor-grab"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" />
      </Button>
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
      <div id={titleId} className="min-w-0">
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
      <div className="flex items-center gap-2 whitespace-nowrap">
        {suggested ? <RationalePopover rationale={step.rationale} /> : null}
        {accepted ? (
          <Badge variant="secondary" role="img" aria-label="Suggested by AI, accepted">
            <Sparkles aria-hidden="true" />
            AI
          </Badge>
        ) : null}
        {suggested ? (
          <>
            <Button
              onClick={() => update.mutate({ id: step.id, suggestionState: "accepted" })}
              disabled={accepting}
            >
              {accepting ? (
                <Spinner data-icon="inline-start" aria-hidden="true" />
              ) : (
                <Check data-icon="inline-start" aria-hidden="true" />
              )}
              Accept
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="size-11"
                  aria-label={`More actions for ${step.title}`}
                >
                  <Ellipsis aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(event) => {
                  if (editorTakesFocus.current) {
                    editorTakesFocus.current = false;
                    event.preventDefault();
                  }
                }}
              >
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="min-h-11 text-base"
                    onSelect={() => {
                      editorTakesFocus.current = true;
                      acceptAfterEdit.current = true;
                      setEditing(true);
                    }}
                  >
                    <Pencil aria-hidden="true" />
                    Edit wording, then accept
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="min-h-11 text-base"
                    onSelect={() => update.mutate({ id: step.id, suggestionState: "dismissed" })}
                  >
                    <X aria-hidden="true" />
                    Dismiss
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
        <Button
          size="icon-lg"
          variant="ghost"
          aria-label={`Move ${step.title} up`}
          onClick={onMoveUp}
          disabled={!onMoveUp}
          className={cn("size-11", !onMoveUp && "invisible")}
        >
          <ChevronUp aria-hidden="true" />
        </Button>
        <Button
          size="icon-lg"
          variant="ghost"
          aria-label={`Move ${step.title} down`}
          onClick={onMoveDown}
          disabled={!onMoveDown}
          className={cn("size-11", !onMoveDown && "invisible")}
        >
          <ChevronDown aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
