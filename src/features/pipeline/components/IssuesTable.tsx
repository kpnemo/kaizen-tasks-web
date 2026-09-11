import { Bug, CircleCheck, CircleDashed, CircleX, GitMerge, type LucideIcon } from "lucide-react";
import type { PipelineIssue, PipelinePullRequest, PipelineSnapshot } from "@/api/models";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { IssueAction, type PipelineAction } from "./IssueAction";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

/** One visible variant per stage, an intensity ramp the room can read from the back: the two
 *  stages nothing has moved yet are a dashed outline, work in progress a solid outline, on staging
 *  a filled secondary, shipped the brand fill. */
const STAGES: Record<
  PipelineIssue["stage"],
  { label: string; variant: BadgeVariant; waiting?: boolean }
> = {
  new: { label: "New", variant: "outline", waiting: true },
  triaged: { label: "Triaged", variant: "outline", waiting: true },
  implementing: { label: "Implementing", variant: "outline" },
  staging: { label: "Staging", variant: "secondary" },
  shipped: { label: "Shipped", variant: "default" },
  closed: { label: "Closed", variant: "outline", waiting: true },
};

function StageBadge({ stage }: { stage: PipelineIssue["stage"] }) {
  const { label, variant, waiting } = STAGES[stage];
  return (
    <Badge variant={variant} className={cn(waiting && "border-dashed")}>
      {label}
    </Badge>
  );
}

/** A pull request's state as an icon, a variant and the words a screen reader gets. */
const PR_STATES: Record<string, { variant: BadgeVariant; icon: LucideIcon; state: string }> = {
  merged: { variant: "secondary", icon: GitMerge, state: "merged" },
  closed: { variant: "outline", icon: CircleX, state: "closed without merging" },
  draft: { variant: "outline", icon: CircleDashed, state: "draft" },
  green: { variant: "outline", icon: CircleCheck, state: "checks green" },
  pending: { variant: "outline", icon: CircleDashed, state: "checks running" },
  red: { variant: "destructive", icon: CircleX, state: "a check is red" },
};

function pullRequestState(pr: PipelinePullRequest) {
  if (pr.state !== "open") return PR_STATES[pr.state];
  if (pr.draft) return PR_STATES.draft;
  return PR_STATES[pr.checks ?? "pending"];
}

function PullRequestBadge({ pr }: { pr: PipelinePullRequest }) {
  const { variant, icon: Icon, state } = pullRequestState(pr);
  return (
    <Badge asChild variant={variant}>
      <a href={pr.url} target="_blank" rel="noreferrer">
        <Icon aria-hidden="true" />
        {pr.repo} #{pr.number}
        <span className="sr-only">, {state}</span>
      </a>
    </Badge>
  );
}

/** The issues in snapshot order (open first, then those shipped in the last 14 days), one row
 *  each: number and title linking to GitHub, the stage chip, the readiness score, one badge per
 *  pull request across the three repositories, and exactly one action (spec "The page", block 3).
 *  The action column is last and never wraps. */
export function IssuesTable({
  snapshot,
  onAction,
}: {
  snapshot: PipelineSnapshot;
  onAction: (action: PipelineAction) => void;
}) {
  const ready = snapshot.issues.filter((issue) => issue.productionReady);
  return (
    <Table aria-label="Issues" className="text-base">
      <TableHeader>
        <TableRow>
          <TableHead>Issue</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead className="text-right">Readiness</TableHead>
          <TableHead>Pull requests</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {snapshot.issues.map((issue) => (
          <TableRow key={issue.number}>
            <TableCell className="whitespace-normal">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  #{issue.number} {issue.title}
                </a>
                {issue.kind === "bug" && (
                  <Badge variant="outline">
                    <Bug aria-hidden="true" />
                    bug
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <StageBadge stage={issue.stage} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{issue.readiness ?? ""}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1.5">
                {issue.pullRequests.map((pr) => (
                  <PullRequestBadge key={`${pr.repo}-${pr.number}`} pr={pr} />
                ))}
              </div>
            </TableCell>
            <TableCell>
              <IssueAction issue={issue} snapshot={snapshot} ready={ready} onAction={onAction} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
