import { ExternalLink } from "lucide-react";
import { toApiError } from "@/api/errors";
import type { FeatureRequestSummary } from "@/api/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useFeatureRequests } from "../hooks";

const STAGE: Record<
  FeatureRequestSummary["stage"],
  { label: string; variant: "default" | "secondary" | "outline" | "ghost" }
> = {
  shipped: { label: "Shipped", variant: "default" },
  staging: { label: "Staging", variant: "secondary" },
  implementing: { label: "Implementing", variant: "outline" },
  triaged: { label: "Triaged", variant: "ghost" },
  new: { label: "New", variant: "ghost" },
  closed: { label: "Closed", variant: "ghost" },
};

const SCORE_LABELS = ["clarity", "complexity", "risk"] as const;

function Row({ item }: { item: FeatureRequestSummary }) {
  const stage = STAGE[item.stage];
  // The triage labels as the room sees them on GitHub: "clarity 5", "complexity 3", "risk 2".
  const scores = SCORE_LABELS.flatMap((name) => {
    const label = item.labels.find((l) => l.startsWith(`${name}:`));
    return label ? [`${name} ${label.slice(name.length + 1)}`] : [];
  });
  return (
    <li className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-1 text-base">
      <span className="text-muted-foreground">#{item.number}</span>
      <span className="font-medium">{item.title}</span>
      <Badge variant={stage.variant}>{stage.label}</Badge>
      {item.readiness !== null && (
        <span className="text-muted-foreground">Readiness {item.readiness}</span>
      )}
      {scores.map((score) => (
        <Badge key={score} variant="ghost" className="text-muted-foreground">
          {score}
        </Badge>
      ))}
      <Button asChild variant="link" className="ml-auto h-auto min-h-11">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open #${item.number} on GitHub`}
        >
          GitHub
          <ExternalLink aria-hidden="true" />
        </a>
      </Button>
    </li>
  );
}

/** Every feature request filed so far: open first, then closed, newest first (issue #22). */
export function RequestsSoFar() {
  const requests = useFeatureRequests();
  const open = requests.data?.filter((item) => item.state === "open") ?? [];
  const closed = requests.data?.filter((item) => item.state === "closed") ?? [];
  return (
    <section aria-labelledby="requests-so-far" className="space-y-4">
      <Separator />
      <h2 id="requests-so-far">Requests so far</h2>
      {requests.isPending ? (
        <p role="status" className="text-muted-foreground">
          Loading requests
        </p>
      ) : requests.isError ? (
        <div role="alert" className="text-destructive">
          {toApiError(requests.error).message}
        </div>
      ) : requests.data.length === 0 ? (
        <p className="text-muted-foreground">No requests yet. Yours can be the first.</p>
      ) : (
        <div className="space-y-2">
          {open.length > 0 && (
            <ul className="divide-y">
              {open.map((item) => (
                <Row key={item.number} item={item} />
              ))}
            </ul>
          )}
          {open.length > 0 && closed.length > 0 && (
            <p className="pt-2 text-sm tracking-wide text-muted-foreground uppercase">Closed</p>
          )}
          {closed.length > 0 && (
            <ul className="divide-y">
              {closed.map((item) => (
                <Row key={item.number} item={item} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
