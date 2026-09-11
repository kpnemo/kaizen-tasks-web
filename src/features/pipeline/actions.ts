import type { PipelineIssue, PipelineSnapshot } from "@/api/models";

/** What a press in the Action column asks the page to do; the page opens the passphrase dialog.
 *  A retry carries `covers`, the issue numbers the failed ship recorded (the pressed one included):
 *  that whole set is what the API re-dispatches, so the dialog names it. */
export type PipelineAction =
  | { kind: "staging"; issue: PipelineIssue }
  | { kind: "production"; version: string; issues: PipelineIssue[] }
  | { kind: "retry"; issue: PipelineIssue; version: string; covers: number[] };

/** The one thing the Action cell shows for an issue. */
export type Verdict =
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
export function verdictFor(issue: PipelineIssue, context: Context): Verdict {
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

/** The issue set a failed ship recorded, which is what a retry re-dispatches (contract: "the
 *  marker's version and the marker's issue set, unchanged"). The snapshot's newest run lists it
 *  when that run is the marker's; otherwise it is every row carrying the same marker; at the least
 *  it is the pressed issue itself. Ascending, so the sentence reads like the table. */
export function shipIssueSet(issue: PipelineIssue, snapshot: PipelineSnapshot): number[] {
  const marker = issue.ship;
  if (!marker) return [issue.number];
  const run = snapshot.ship.run;
  const recorded =
    run && run.requestId === marker.requestId && run.issues.length > 0
      ? run.issues
      : snapshot.issues
          .filter((row) => row.ship?.requestId === marker.requestId)
          .map((row) => row.number);
  const covers = recorded.length > 0 ? recorded : [issue.number];
  return [...new Set(covers)].sort((a, b) => a - b);
}

const ROW_MOVED = "The row moved on: the table behind this dialog shows what it needs now.";

/** Why `action` can no longer be taken on `snapshot`, as one sentence, or null while it still can.
 *  The dialog asks this on every poll, not once when it opens: a press that was fine a moment ago
 *  must not send once a ship started, the caller lost the right, GitHub stopped answering or the
 *  row itself moved, because the API would refuse it and the room would watch a click land on
 *  nothing. The rules are the same ones `verdictFor` shows in the Action column, in the same order. */
export function blockerFor(action: PipelineAction, snapshot: PipelineSnapshot): string | null {
  if (snapshot.stale) {
    return "The snapshot is stale: GitHub did not answer, so nothing on this row can be vouched for.";
  }
  if (!snapshot.canDeploy) return "You can no longer deploy.";
  if (snapshot.ship.active) return "A ship started.";
  switch (action.kind) {
    case "staging": {
      const row = snapshot.issues.find((issue) => issue.number === action.issue.number);
      return row && verdictFor(row, snapshot).type === "deploy-staging" ? null : ROW_MOVED;
    }
    case "retry": {
      const row = snapshot.issues.find((issue) => issue.number === action.issue.number);
      const verdict = row ? verdictFor(row, snapshot) : null;
      return verdict?.type === "failed" && verdict.version === action.version ? null : ROW_MOVED;
    }
    case "production": {
      if (!snapshot.nextVersion) return "There is no version to release now.";
      if (snapshot.nextVersion !== action.version) {
        return `The next version is now ${snapshot.nextVersion}, not ${action.version}.`;
      }
      const ready = snapshot.issues.filter((issue) => issue.productionReady).map((i) => i.number);
      const asked = action.issues.map((issue) => issue.number);
      const same = ready.length === asked.length && ready.every((n) => asked.includes(n));
      return same ? null : "The set of issues ready for production changed.";
    }
  }
}
