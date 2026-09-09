import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";
import { toApiError } from "@/api/errors";
import { AiBanner } from "./components/AiBanner";
import { BulkBar } from "./components/BulkBar";
import { StepList } from "./components/StepList";
import { TaskHeader } from "./components/TaskHeader";
import { useTask } from "./hooks";

export function TaskDetailPage() {
  const { id = "" } = useParams();
  const task = useTask(id);

  if (task.isPending) {
    return (
      <p role="status" className="text-muted-foreground">
        Loading task
      </p>
    );
  }
  if (task.isError) {
    const error = toApiError(task.error);
    return (
      <div role="alert" className="space-y-4">
        <p>{error.code === "NOT_FOUND" ? "This task does not exist." : error.message}</p>
        <Link to="/tasks" className="font-semibold text-primary underline">
          Back to tasks
        </Link>
      </div>
    );
  }

  return (
    <article className="space-y-10">
      <Link
        to="/tasks"
        className="inline-flex items-center gap-1 font-semibold text-primary"
        data-nav
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All tasks
      </Link>
      <TaskHeader task={task.data} />
      {task.data.parentId === null ? <AiBanner task={task.data} /> : null}
      <BulkBar task={task.data} />
      <StepList task={task.data} />
    </article>
  );
}
