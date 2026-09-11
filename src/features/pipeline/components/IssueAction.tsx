import {
  CircleX,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  Rocket,
  Ship,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { PipelineIssue, PipelineSnapshot } from "@/api/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shipIssueSet, verdictFor, type PipelineAction } from "../actions";

/** A badge about a ship run, linking to the run on GitHub when the API knows its URL. */
function RunBadge({
  variant,
  icon: Icon,
  url,
  children,
  spin = false,
}: {
  variant: "secondary" | "destructive";
  icon: LucideIcon;
  url: string | null;
  children: ReactNode;
  spin?: boolean;
}) {
  const icon = (
    <Icon aria-hidden="true" className={spin ? "animate-spin motion-reduce:animate-none" : ""} />
  );
  if (!url) {
    return (
      <Badge variant={variant}>
        {icon}
        {children}
      </Badge>
    );
  }
  return (
    <Badge asChild variant={variant}>
      <a href={url} target="_blank" rel="noreferrer">
        {icon}
        {children}
        <ExternalLink aria-hidden="true" />
      </a>
    </Badge>
  );
}

/** The Action cell: exactly one of the two buttons, a ship badge, a failed badge with its retry,
 *  or a muted hint, decided by `verdictFor` in `../actions`. Buttons render only for a caller the
 *  API marked `canDeploy`, and are disabled while the API serves a stale snapshot, because a press
 *  then would act on numbers nobody can vouch for. `ready` is every production-ready row: one press
 *  ships them all (spec, block 3). */
export function IssueAction({
  issue,
  snapshot,
  ready,
  onAction,
}: {
  issue: PipelineIssue;
  snapshot: PipelineSnapshot;
  ready: PipelineIssue[];
  onAction: (action: PipelineAction) => void;
}) {
  const verdict = verdictFor(issue, snapshot);
  switch (verdict.type) {
    case "deploy-staging":
      return (
        <Button disabled={snapshot.stale} onClick={() => onAction({ kind: "staging", issue })}>
          <Rocket data-icon="inline-start" aria-hidden="true" />
          Deploy to staging
        </Button>
      );
    case "deploy-production":
      return (
        <Button
          disabled={snapshot.stale}
          onClick={() => onAction({ kind: "production", version: verdict.version, issues: ready })}
        >
          <Ship data-icon="inline-start" aria-hidden="true" />
          Deploy {verdict.version} to production
        </Button>
      );
    case "shipping":
      return (
        <RunBadge variant="secondary" icon={LoaderCircle} url={verdict.url} spin>
          Shipping: {verdict.step}
        </RunBadge>
      );
    case "failed":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <RunBadge variant="destructive" icon={CircleX} url={verdict.url}>
            Ship failed at {verdict.step}
          </RunBadge>
          {snapshot.canDeploy && !snapshot.ship.active && (
            <Button
              variant="outline"
              disabled={snapshot.stale}
              onClick={() =>
                onAction({
                  kind: "retry",
                  issue,
                  version: verdict.version,
                  covers: shipIssueSet(issue, snapshot),
                })
              }
            >
              <RotateCcw data-icon="inline-start" aria-hidden="true" />
              Retry ship {verdict.version}
            </Button>
          )}
        </div>
      );
    case "hint":
      return <span className="text-muted-foreground">{verdict.text}</span>;
  }
}
