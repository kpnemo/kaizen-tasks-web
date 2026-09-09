import { useState } from "react";
import { toApiError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { CreateTaskBar } from "./components/CreateTaskBar";
import { FilterBar } from "./components/FilterBar";
import { TaskRow } from "./components/TaskRow";
import { useTasks, type TaskFilters } from "./hooks";

export function TaskListPage() {
  const [filters, setFilters] = useState<TaskFilters>({});
  const tasks = useTasks(filters);
  const rows = tasks.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="space-y-8">
      <h1>Tasks</h1>
      <CreateTaskBar />
      <FilterBar filters={filters} onChange={setFilters} />

      {tasks.isPending ? (
        <p role="status" className="text-muted-foreground">
          Loading tasks
        </p>
      ) : null}

      {tasks.isError ? (
        <div
          role="alert"
          className="flex items-center gap-4 rounded-xl border border-destructive/40 bg-card p-4"
        >
          <span>Could not load tasks: {toApiError(tasks.error).message}</span>
          <Button variant="outline" onClick={() => void tasks.refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {tasks.data && rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          No tasks yet. Add one above and the assistant will break it into small steps.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul aria-label="Tasks" className="space-y-3">
          {rows.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      ) : null}

      {tasks.hasNextPage ? (
        <Button
          variant="outline"
          onClick={() => void tasks.fetchNextPage()}
          disabled={tasks.isFetchingNextPage}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}
