import { Circle, CircleCheck, CircleDashed, RefreshCw, type LucideIcon } from "lucide-react";
import type { TaskDetail, TaskStatus } from "@/api/models";
import { InlineText } from "@/components/inline-text";
import { TagChip } from "@/components/tag-chip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useBreakdown, useReplaceTags, useUpdateTask } from "../hooks";
import { AddTagPopover } from "./AddTagPopover";
import { AiTagSuggestions } from "./AiTagSuggestions";
import { ProgressBar } from "./ProgressBar";

const STATUSES: { value: TaskStatus; label: string; icon: LucideIcon }[] = [
  { value: "todo", label: "To do", icon: Circle },
  { value: "in_progress", label: "In progress", icon: CircleDashed },
  { value: "done", label: "Done", icon: CircleCheck },
];

export function TaskHeader({ task }: { task: TaskDetail }) {
  const update = useUpdateTask();
  const replaceTags = useReplaceTags();
  const breakdown = useBreakdown();
  // Once a root task's breakdown has settled (AiBanner then renders nothing), Regenerate moves
  // here so it stays reachable without a lone row pushing the suggestions further down the page.
  const showRegenerate = task.parentId === null && task.aiStatus === "done";
  return (
    <header className="flex flex-col gap-4">
      <InlineText
        as="h1"
        label="Title"
        value={task.title}
        onSave={(title) => update.mutate({ id: task.id, title })}
      />
      <div className="flex flex-wrap items-center gap-6">
        {/* Three choices: a pressed-button group, so the current status is readable from the back
            of the room and the other two are one click away. */}
        <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
          {STATUSES.map(({ value, label, icon: Icon }) => {
            const active = task.status === value;
            return (
              <Button
                key={value}
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() => {
                  if (!active) update.mutate({ id: task.id, status: value });
                }}
              >
                <Icon data-icon="inline-start" aria-hidden="true" />
                {label}
              </Button>
            );
          })}
        </div>
        <ProgressBar done={task.progress.done} total={task.progress.total} />
        {showRegenerate ? (
          <Button
            variant="outline"
            onClick={() => breakdown.mutate(task.id)}
            disabled={breakdown.isPending}
          >
            {breakdown.isPending ? (
              <Spinner data-icon="inline-start" aria-hidden="true" />
            ) : (
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
            )}
            Regenerate
          </Button>
        ) : null}
      </div>
      <InlineText
        as="p"
        label="Description"
        multiline
        allowEmpty
        placeholder="Add a description"
        value={task.description ?? ""}
        onSave={(description) => update.mutate({ id: task.id, description: description || null })}
        className="text-muted-foreground"
      />
      <div className="flex flex-wrap items-center gap-2" aria-label="Tags">
        {task.tags.map((tag) => (
          <TagChip
            key={tag.id}
            tag={tag}
            onRemove={() =>
              replaceTags.mutate({
                id: task.id,
                tagIds: task.tags.filter((t) => t.id !== tag.id).map((t) => t.id),
              })
            }
          />
        ))}
        <AddTagPopover task={task} />
      </div>
      <AiTagSuggestions task={task} />
    </header>
  );
}
