import type { TaskDetail, TaskStatus } from "@/api/models";
import { InlineText } from "@/components/inline-text";
import { NativeSelect } from "@/components/native-select";
import { TagChip } from "@/components/tag-chip";
import { useReplaceTags, useUpdateTask } from "../hooks";
import { ProgressBar } from "./ProgressBar";

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export function TaskHeader({ task }: { task: TaskDetail }) {
  const update = useUpdateTask();
  const replaceTags = useReplaceTags();
  return (
    <header className="space-y-5">
      <InlineText
        as="h1"
        label="Title"
        value={task.title}
        onSave={(title) => update.mutate({ id: task.id, title })}
      />
      <div className="flex flex-wrap items-center gap-6">
        <NativeSelect
          aria-label="Status"
          value={task.status}
          onChange={(e) => update.mutate({ id: task.id, status: e.target.value as TaskStatus })}
        >
          {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </NativeSelect>
        <ProgressBar done={task.progress.done} total={task.progress.total} />
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
      </div>
    </header>
  );
}
