import { Link } from "react-router";
import type { TaskSummary } from "@/api/models";
import { TagChip } from "@/components/tag-chip";
import { useBreakdown } from "../hooks";
import { AiChip } from "./AiChip";
import { ProgressBar } from "./ProgressBar";

export function TaskRow({ task }: { task: TaskSummary }) {
  const breakdown = useBreakdown();
  const titleId = `task-${task.id}-title`;
  return (
    <li
      aria-labelledby={titleId}
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border bg-card px-5 py-4"
    >
      <div className="min-w-0 flex-1">
        <Link
          id={titleId}
          to={`/tasks/${task.id}`}
          className="text-lg font-semibold text-foreground hover:underline"
        >
          {task.title}
        </Link>
        {task.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {task.tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
          </div>
        ) : null}
      </div>
      <ProgressBar done={task.progress.done} total={task.progress.total} />
      <AiChip
        task={task}
        onRetry={() => breakdown.mutate(task.id)}
        retrying={breakdown.isPending}
      />
    </li>
  );
}
