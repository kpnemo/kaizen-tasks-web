import { CircleAlert, Inbox } from "lucide-react";
import { useState } from "react";
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
import { DeployDialog } from "./components/DeployDialog";
import { EnvironmentCard } from "./components/EnvironmentCard";
import { FlowDiagram } from "./components/FlowDiagram";
import type { PipelineAction } from "./actions";
import { IssuesTable } from "./components/IssuesTable";
import { SnapshotAge } from "./components/SnapshotAge";
import { usePipeline, usePipelineAvailable } from "./hooks";

/** The control room: how the flow works, what each environment serves, where every issue stands,
 *  and the two facilitator clicks (spec "The page: /pipeline"). Rendered only once health has
 *  confirmed the feature; until then the data area shows its skeletons. A snapshot already on
 *  screen stays there when a later poll fails: the failure is announced above it, not in its place. */
export function PipelinePage() {
  const { available } = usePipelineAvailable();
  const snapshot = usePipeline(available === true);
  // The press the passphrase dialog is open for; null while it is closed.
  const [action, setAction] = useState<PipelineAction | null>(null);

  if (available === false) {
    return (
      <div className="flex flex-col gap-4">
        <h1>Pipeline</h1>
        <p className="text-muted-foreground">The pipeline is not available in this environment.</p>
      </div>
    );
  }

  const data = snapshot.data;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1>Pipeline</h1>
        <p className="max-w-prose text-muted-foreground">
          Every request on its way from an idea to production, and the two clicks that move it.
        </p>
      </div>

      <section aria-labelledby="pipeline-flow" className="flex flex-col gap-4">
        <h2 id="pipeline-flow">How it flows</h2>
        <FlowDiagram />
      </section>

      {data ? (
        <>
          {snapshot.isError && (
            <Alert variant="destructive" className="text-base">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Could not refresh the pipeline</AlertTitle>
              <AlertDescription className="text-base">
                <p>{toApiError(snapshot.error).message}</p>
                <p>Showing the last snapshot below; the page tries again every ten seconds.</p>
              </AlertDescription>
            </Alert>
          )}

          <section aria-labelledby="pipeline-environments" className="flex flex-col gap-4">
            <h2 id="pipeline-environments">Environments</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <EnvironmentCard name="staging" environment={data.environments.staging} />
              <EnvironmentCard name="production" environment={data.environments.production} />
            </div>
            <SnapshotAge
              generatedAt={data.generatedAt}
              stale={data.stale}
              staleReason={data.staleReason}
            />
          </section>

          <section aria-labelledby="pipeline-issues" className="flex flex-col gap-4">
            <h2 id="pipeline-issues">Issues</h2>
            {data.issues.length === 0 ? (
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
              <IssuesTable snapshot={data} onAction={setAction} />
            )}
          </section>
        </>
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
        <div role="status" className="flex flex-col gap-10">
          <section aria-labelledby="pipeline-environments" className="flex flex-col gap-4">
            <h2 id="pipeline-environments">Environments</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
            <Skeleton className="h-6 w-40" />
          </section>
          <section aria-labelledby="pipeline-issues" className="flex flex-col gap-4">
            <h2 id="pipeline-issues">Issues</h2>
            <Skeleton className="h-64 rounded-xl" />
          </section>
          <span className="sr-only">Loading pipeline</span>
        </div>
      )}

      {data && <DeployDialog action={action} snapshot={data} onClose={() => setAction(null)} />}
    </div>
  );
}
