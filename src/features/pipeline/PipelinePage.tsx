import { CircleAlert, Inbox } from "lucide-react";
import { toApiError } from "@/api/errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { EnvironmentCard } from "./components/EnvironmentCard";
import { IssuesTable } from "./components/IssuesTable";
import { usePipeline, usePipelineAvailable } from "./hooks";

/** The control room: how the flow works, what each environment serves, where every issue stands,
 *  and the two facilitator clicks (spec "The page: /pipeline"). Rendered only once health has
 *  confirmed the feature; until then the data area shows its skeletons. */
export function PipelinePage() {
  const { available } = usePipelineAvailable();
  const snapshot = usePipeline(available === true);

  if (available === false) {
    return (
      <div className="flex flex-col gap-4">
        <h1>Pipeline</h1>
        <p className="text-muted-foreground">The pipeline is not available in this environment.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1>Pipeline</h1>
        <p className="max-w-prose text-muted-foreground">
          Every request on its way from the idea to production, and the two clicks that move it.
        </p>
      </div>

      <section aria-labelledby="pipeline-flow" className="flex flex-col gap-4">
        <h2 id="pipeline-flow">How it flows</h2>
      </section>

      {snapshot.isPending ? (
        <div role="status" className="flex flex-col gap-10">
          <section aria-labelledby="pipeline-environments" className="flex flex-col gap-4">
            <h2 id="pipeline-environments">Environments</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-52 rounded-xl" />
              <Skeleton className="h-52 rounded-xl" />
            </div>
          </section>
          <section aria-labelledby="pipeline-issues" className="flex flex-col gap-4">
            <h2 id="pipeline-issues">Issues</h2>
            <Skeleton className="h-64 rounded-xl" />
          </section>
          <span className="sr-only">Loading pipeline</span>
        </div>
      ) : snapshot.isError ? (
        <Alert variant="destructive" className="text-base">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Could not load the pipeline</AlertTitle>
          <AlertDescription className="text-base">
            <p>{toApiError(snapshot.error).message}</p>
            <p>The page tries again every ten seconds.</p>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <section aria-labelledby="pipeline-environments" className="flex flex-col gap-4">
            <h2 id="pipeline-environments">Environments</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <EnvironmentCard name="staging" environment={snapshot.data.environments.staging} />
              <EnvironmentCard
                name="production"
                environment={snapshot.data.environments.production}
              />
            </div>
          </section>

          <section aria-labelledby="pipeline-issues" className="flex flex-col gap-4">
            <h2 id="pipeline-issues">Issues</h2>
            {snapshot.data.issues.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox />
                  </EmptyMedia>
                  <EmptyTitle>No requests yet</EmptyTitle>
                  <EmptyDescription className="text-base">
                    File one from "Request a feature" and it appears here as it moves.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <IssuesTable issues={snapshot.data.issues} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
