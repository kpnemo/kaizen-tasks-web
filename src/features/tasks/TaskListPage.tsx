import { ChevronDown, CircleAlert, ListTodo, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toApiError } from "@/api/errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { CreateTaskBar } from "./components/CreateTaskBar";
import { FilterBar } from "./components/FilterBar";
import { TaskRow } from "./components/TaskRow";
import { useTasks, type TaskFilters } from "./hooks";

/** The task list, and the screen other screens copy their four states from: loading is Skeleton
 *  rows inside `role="status"` with the sentence for the screen reader, empty is an Empty with the
 *  one sentence that says what to do next, error is a destructive Alert with the API message and a
 *  Try again, and the content is the list. The strings are the ones the tests and the other
 *  screens already use. */
export function TaskListPage() {
  const [filters, setFilters] = useState<TaskFilters>({});
  const tasks = useTasks(filters);
  const rows = tasks.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <h1>Tasks</h1>
      <CreateTaskBar />
      <FilterBar filters={filters} onChange={setFilters} />

      {tasks.isPending ? (
        <div role="status" className="flex flex-col gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <span className="sr-only">Loading tasks</span>
        </div>
      ) : null}

      {tasks.isError ? (
        <div className="flex flex-col items-start gap-4">
          <Alert variant="destructive" className="text-base">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Could not load tasks</AlertTitle>
            <AlertDescription className="text-base">
              {toApiError(tasks.error).message}
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => void tasks.refetch()}>
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : null}

      {tasks.data && rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListTodo />
            </EmptyMedia>
            <EmptyTitle>No tasks</EmptyTitle>
            <EmptyDescription className="text-base">
              No tasks yet. Add one above and the assistant will break it into small steps.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {rows.length > 0 ? (
        <ul aria-label="Tasks" className="flex flex-col gap-3">
          {rows.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      ) : null}

      {tasks.hasNextPage ? (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => void tasks.fetchNextPage()}
          disabled={tasks.isFetchingNextPage}
        >
          {tasks.isFetchingNextPage ? (
            <Spinner data-icon="inline-start" aria-hidden="true" />
          ) : (
            <ChevronDown data-icon="inline-start" aria-hidden="true" />
          )}
          Load more
        </Button>
      ) : null}
    </div>
  );
}
