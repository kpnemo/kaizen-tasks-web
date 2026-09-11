import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleX,
  ExternalLink,
  Gauge,
  Hammer,
  Inbox,
  ListChecks,
  RefreshCw,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { toApiError } from "@/api/errors";
import type { FeatureRequestSummary } from "@/api/models";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFeatureRequests } from "../hooks";

/** One visible variant and one icon per stage, so two stages never differ by tint alone: the
 *  shipped request is the filled chip, the two in-flight stages are secondary, the rest outline. */
const STAGE: Record<
  FeatureRequestSummary["stage"],
  { label: string; variant: "default" | "secondary" | "outline"; icon: LucideIcon }
> = {
  shipped: { label: "Shipped", variant: "default", icon: CircleCheck },
  staging: { label: "Staging", variant: "secondary", icon: Rocket },
  implementing: { label: "Implementing", variant: "secondary", icon: Hammer },
  triaged: { label: "Triaged", variant: "outline", icon: ListChecks },
  new: { label: "New", variant: "outline", icon: CircleDot },
  closed: { label: "Closed", variant: "outline", icon: CircleX },
};

const SCORE_LABELS = ["clarity", "complexity", "risk"] as const;
const COLUMNS = 6;

function Row({ item }: { item: FeatureRequestSummary }) {
  const stage = STAGE[item.stage];
  const StageIcon = stage.icon;
  // The triage labels as the room sees them on GitHub: "clarity 5", "complexity 3", "risk 2".
  const scores = SCORE_LABELS.flatMap((name) => {
    const label = item.labels.find((l) => l.startsWith(`${name}:`));
    return label ? [`${name} ${label.slice(name.length + 1)}`] : [];
  });
  return (
    <TableRow>
      <TableCell className="text-muted-foreground tabular-nums">#{item.number}</TableCell>
      <TableCell className="font-medium whitespace-normal">{item.title}</TableCell>
      <TableCell>
        <Badge variant={stage.variant}>
          <StageIcon aria-hidden="true" />
          {stage.label}
        </Badge>
      </TableCell>
      <TableCell>
        {item.readiness !== null ? (
          <Badge variant="outline">
            <Gauge aria-hidden="true" />
            <span className="sr-only">Readiness </span>
            {item.readiness}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {scores.length > 0 ? (
          <div className="flex gap-2">
            {scores.map((score) => (
              <Badge key={score} variant="outline">
                {score}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="w-[1%] text-right">
        <Button asChild variant="outline">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open #${item.number} on GitHub`}
          >
            GitHub
            <ExternalLink data-icon="inline-end" aria-hidden="true" />
          </a>
        </Button>
      </TableCell>
    </TableRow>
  );
}

/** One body per group, opened by a full-width row that names it: the open requests, then the
 *  closed ones, each newest first as the API orders them. */
function Group({ label, items }: { label: string; items: FeatureRequestSummary[] }) {
  return (
    <TableBody>
      <TableRow className="bg-muted/50">
        <TableHead scope="rowgroup" colSpan={COLUMNS}>
          {label}
        </TableHead>
      </TableRow>
      {items.map((item) => (
        <Row key={item.number} item={item} />
      ))}
    </TableBody>
  );
}

/** Every feature request filed so far: open first, then closed, newest first (issue #22). */
export function RequestsSoFar() {
  const requests = useFeatureRequests();
  const open = requests.data?.filter((item) => item.state === "open") ?? [];
  const closed = requests.data?.filter((item) => item.state === "closed") ?? [];
  return (
    <section aria-labelledby="requests-so-far" className="flex flex-col gap-4">
      <Separator />
      <h2 id="requests-so-far">Requests so far</h2>
      {requests.isPending ? (
        <div role="status" className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
          <span className="sr-only">Loading requests</span>
        </div>
      ) : requests.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="destructive" className="text-base">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Could not load the requests</AlertTitle>
            <AlertDescription className="text-base">
              {toApiError(requests.error).message}
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => void requests.refetch()}>
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : requests.data.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>No requests</EmptyTitle>
            <EmptyDescription className="text-base">
              No requests yet. Yours can be the first.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table className="text-base">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Request</TableHead>
              <TableHead className="w-32">Stage</TableHead>
              <TableHead className="w-28">Readiness</TableHead>
              <TableHead>Triage</TableHead>
              <TableHead className="w-[1%]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          {open.length > 0 ? <Group label="Open" items={open} /> : null}
          {closed.length > 0 ? <Group label="Closed" items={closed} /> : null}
        </Table>
      )}
    </section>
  );
}
