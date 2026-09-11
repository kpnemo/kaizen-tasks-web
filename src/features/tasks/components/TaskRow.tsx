import { Link } from "react-router";
import type { TaskSummary } from "@/api/models";
import { TagChip } from "@/components/tag-chip";
import { Card } from "@/components/ui/card";
import { useBreakdown } from "../hooks";
import { AiChip, AiFailureAlert } from "./AiChip";
import { ProgressBar } from "./ProgressBar";

/** One task in the list: the `li` the smoke test locates by the title's name, holding a Card (the
 *  installed Card is a div with no `asChild`, so it sits inside the `li`). The card is a grid of two
 *  tracks: the title cell yields (min-w-0, the title truncates) to a rail of progress and AI state
 *  that never wraps, so every row keeps one height and the rail stays put. Two tracks rather than
 *  one per rail item because both items are optional and an empty grid track would keep its gap.
 *  A failed breakdown adds its Alert on a second line across both tracks. */
export function TaskRow({ task }: { task: TaskSummary }) {
  const breakdown = useBreakdown();
  const titleId = `task-${task.id}-title`;
  return (
    <li aria-labelledby={titleId}>
      <Card className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 px-5 py-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            id={titleId}
            to={`/tasks/${task.id}`}
            className="truncate text-lg font-semibold text-foreground hover:underline"
          >
            {task.title}
          </Link>
          {task.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {task.tags.map((tag) => (
                <TagChip key={tag.id} tag={tag} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-6 whitespace-nowrap">
          <ProgressBar done={task.progress.done} total={task.progress.total} />
          <AiChip task={task} />
        </div>
        {task.aiStatus === "failed" ? (
          <AiFailureAlert
            className="col-span-full"
            task={task}
            onRetry={() => breakdown.mutate(task.id)}
            retrying={breakdown.isPending}
          />
        ) : null}
      </Card>
    </li>
  );
}
