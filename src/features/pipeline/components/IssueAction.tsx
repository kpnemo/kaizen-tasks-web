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

/** What a press in the Action column asks the page to do; the page opens the passphrase dialog. */
export type PipelineAction =
  | { kind: "staging"; issue: PipelineIssue }
  | { kind: "production"; version: string; issues: PipelineIssue[] }
  | { kind: "retry"; issue: PipelineIssue; version: string };

type Verdict =
  | { type: "deploy-staging" }
  | { type: "deploy-production"; version: string }
  | { type: "shipping"; step: string; url: string | null }
  | { type: "failed"; step: string; url: string | null; version: string }
  | { type: "hint"; text: string };

type Context = Pick<
  PipelineSnapshot,
  "canDeploy" | "ship" | "nextVersion" | "nextVersionError" | "stale"
>;

/** The one thing the Action cell shows for an issue (spec "The page", block 3), decided from what
 *  the API already worked out: `ship` on the issue, `productionReady`, the stage and the pull
 *  requests' states. The web derives nothing GitHub-side itself; it only orders the rules. */
function verdictFor(issue: PipelineIssue, context: Context): Verdict {
  const ship = issue.ship;
  if (ship && !ship.done) {
    if (ship.status === "queued" || ship.status === "in_progress") {
      return { type: "shipping", step: ship.step ?? "queued", url: ship.runUrl };
    }
    if (ship.status === "unknown") {
      return { type: "shipping", step: "waiting for GitHub to confirm the run", url: ship.runUrl };
    }
    if (ship.conclusion !== "success") {
      return {
        type: "failed",
        step: ship.step ?? "an unknown step",
        url: ship.runUrl,
        version: ship.version,
      };
    }
  }

  if (issue.productionReady) {
    if (context.ship.active) return { type: "hint", text: "a ship is running" };
    if (!context.nextVersion) {
      return { type: "hint", text: context.nextVersionError ?? "no version to release" };
    }
    if (!context.canDeploy) return { type: "hint", text: "ready for production" };
    return { type: "deploy-production", version: context.nextVersion };
  }

  const open = issue.pullRequests.filter((pr) => pr.state === "open");
  if (issue.stage === "implementing") {
    if (open.length === 0) {
      const merged = issue.pullRequests.some((pr) => pr.state === "merged");
      return { type: "hint", text: merged ? "deploying to staging" : "nothing to deploy" };
    }
    if (open.some((pr) => pr.checks === "red")) return { type: "hint", text: "a check is red" };
    if (open.some((pr) => pr.draft)) return { type: "hint", text: "a pull request is a draft" };
    if (open.some((pr) => pr.checks !== "green")) return { type: "hint", text: "checks running" };
    if (context.ship.active) return { type: "hint", text: "a ship is running" };
    if (!context.canDeploy) return { type: "hint", text: "ready for staging" };
    return { type: "deploy-staging" };
  }

  if (issue.stage === "staging") {
    if (open.length > 0) return { type: "hint", text: "waiting for the other half" };
    if (!issue.onStaging) return { type: "hint", text: "deploying to staging" };
  }

  return { type: "hint", text: "nothing to deploy" };
}

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
 *  or a muted hint. Buttons render only for a caller the API marked `canDeploy`, and are disabled
 *  while the API serves a stale snapshot, because a press then would act on numbers nobody can
 *  vouch for. `ready` is every production-ready row: one press ships them all (spec, block 3). */
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
              onClick={() => onAction({ kind: "retry", issue, version: verdict.version })}
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
