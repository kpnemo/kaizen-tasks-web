import { ArrowLeft, CircleAlert } from "lucide-react";
import { Link, useParams } from "react-router";
import { toApiError } from "@/api/errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AiBanner } from "./components/AiBanner";
import { BulkBar } from "./components/BulkBar";
import { StepList } from "./components/StepList";
import { TaskHeader } from "./components/TaskHeader";
import { useTask } from "./hooks";

export function TaskDetailPage() {
  const { id = "" } = useParams();
  const task = useTask(id);

  if (task.isPending) {
    // Shaped like what is about to land: the title, a banner, three step rows.
    return (
      <div role="status" aria-label="Loading task" className="flex flex-col gap-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-16 rounded-xl" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      </div>
    );
  }
  if (task.isError) {
    const error = toApiError(task.error);
    const missing = error.code === "NOT_FOUND";
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive" className="text-base">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>
            {missing ? "This task does not exist." : "Could not load this task"}
          </AlertTitle>
          {missing ? null : (
            <AlertDescription className="text-base">{error.message}</AlertDescription>
          )}
        </Alert>
        <Button asChild variant="outline" className="self-start">
          <Link to="/tasks" data-nav>
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Back to tasks
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <article className="flex flex-col gap-6">
      <Button asChild variant="ghost" className="-ml-3 self-start">
        <Link to="/tasks" data-nav>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          All tasks
        </Link>
      </Button>
      <TaskHeader task={task.data} />
      {task.data.parentId === null ? <AiBanner task={task.data} /> : null}
      <BulkBar task={task.data} />
      <StepList task={task.data} />
    </article>
  );
}
