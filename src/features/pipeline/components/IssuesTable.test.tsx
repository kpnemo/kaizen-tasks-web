import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PipelineIssueShip, PipelineSnapshot } from "@/api/models";
import {
  pipelineIssue,
  pipelinePullRequest,
  pipelineSnapshot,
  SHIP_RUN_URL,
} from "../../../../tests/msw/handlers";
import { IssuesTable } from "./IssuesTable";

function renderTable(over: Partial<PipelineSnapshot> = {}) {
  const onAction = vi.fn();
  const snapshot = pipelineSnapshot(over);
  render(<IssuesTable snapshot={snapshot} onAction={onAction} />);
  return { snapshot, onAction, user: userEvent.setup() };
}

/** The body rows, in document order. */
const rows = () => screen.getAllByRole("row").slice(1);
const actionCell = (row: HTMLElement) => within(row).getAllByRole("cell").at(-1)!;

const running: PipelineIssueShip = {
  requestId: "11111111-2222-4333-8444-555555555555",
  version: "1.5.0",
  runUrl: SHIP_RUN_URL,
  done: false,
  status: "in_progress",
  conclusion: null,
  step: "Promote api",
};

describe("IssuesTable", () => {
  it("lists the issues in snapshot order under the five columns", () => {
    renderTable();
    const table = screen.getByRole("table", { name: "Issues" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Issue", "Stage", "Readiness", "Pull requests", "Action"]);
    const [first, second, third] = rows();
    expect(rows()).toHaveLength(3);
    const link = within(first).getByRole("link", { name: /#24 Snooze a task until Monday/ });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/kpnemo/kaizen-tasks-assembly-line/issues/24",
    );
    expect(within(second).getByRole("link", { name: /#22/ })).toBeInTheDocument();
    expect(within(third).getByRole("link", { name: /#19/ })).toBeInTheDocument();
    expect(within(second).getByText("17")).toBeInTheDocument();
  });

  it("shows one stage chip per row, a visible variant per stage", () => {
    renderTable({
      issues: [
        ...pipelineSnapshot().issues,
        pipelineIssue({ number: 30, stage: "triaged" }),
        pipelineIssue({ number: 31, stage: "new", readiness: null }),
      ],
    });
    const [a, b, c, d, e] = rows();
    expect(within(a).getByText("Implementing")).toHaveAttribute("data-variant", "outline");
    expect(within(b).getByText("Staging")).toHaveAttribute("data-variant", "secondary");
    expect(within(c).getByText("Shipped")).toHaveAttribute("data-variant", "default");
    expect(within(d).getByText("Triaged")).toHaveAttribute("data-variant", "outline");
    expect(within(e).getByText("New")).toHaveAttribute("data-variant", "outline");
    // Readiness is blank, not "null", for an unlabelled issue.
    expect(within(e).getAllByRole("cell")[2]).toHaveTextContent("");
  });

  it("shows one badge per pull request, named by repo, number and state, linking to GitHub", () => {
    renderTable({
      issues: [
        pipelineIssue({
          number: 40,
          stage: "implementing",
          pullRequests: [
            pipelinePullRequest({ repo: "api", number: 25 }),
            pipelinePullRequest({ repo: "web", number: 27, checks: "pending" }),
            pipelinePullRequest({ repo: "harness", number: 30, checks: "red" }),
          ],
        }),
        pipelineIssue({
          number: 41,
          stage: "staging",
          pullRequests: [
            pipelinePullRequest({ repo: "web", number: 19, state: "merged" }),
            pipelinePullRequest({ repo: "api", number: 20, state: "closed" }),
          ],
        }),
      ],
    });
    const [first, second] = rows();
    const green = within(first).getByRole("link", { name: "api #25, checks green" });
    expect(green).toHaveAttribute("href", "https://github.com/kpnemo/kaizen-tasks-api/pull/25");
    expect(green).toHaveAttribute("data-slot", "badge");
    expect(green.querySelector("svg")).not.toBeNull();
    expect(
      within(first).getByRole("link", { name: "web #27, checks running" }),
    ).toBeInTheDocument();
    const red = within(first).getByRole("link", { name: "harness #30, a check is red" });
    expect(red).toHaveAttribute("data-variant", "destructive");
    expect(within(second).getByRole("link", { name: "web #19, merged" })).toBeInTheDocument();
    expect(
      within(second).getByRole("link", { name: "api #20, closed without merging" }),
    ).toBeInTheDocument();
  });

  it("offers a facilitator exactly one action per row and reports the press", async () => {
    const { onAction, user } = renderTable();
    const [implementing, staging, shipped] = rows();

    const deploy = within(implementing).getByRole("button", { name: "Deploy to staging" });
    expect(deploy.querySelectorAll("svg")).toHaveLength(1);
    await user.click(deploy);
    expect(onAction).toHaveBeenLastCalledWith({
      kind: "staging",
      issue: expect.objectContaining({ number: 24 }),
    });

    const ship = within(staging).getByRole("button", { name: "Deploy 1.5.0 to production" });
    await user.click(ship);
    expect(onAction).toHaveBeenLastCalledWith({
      kind: "production",
      version: "1.5.0",
      issues: [expect.objectContaining({ number: 22 })],
    });

    expect(actionCell(shipped)).toHaveTextContent("nothing to deploy");
    expect(within(shipped).queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("puts the same production button on every ready row and ships them together", async () => {
    const { onAction, user } = renderTable({
      issues: [
        pipelineIssue({ number: 22, stage: "staging" }),
        pipelineIssue({ number: 23, stage: "staging" }),
      ],
    });
    const buttons = screen.getAllByRole("button", { name: "Deploy 1.5.0 to production" });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[1]);
    expect(onAction).toHaveBeenCalledWith({
      kind: "production",
      version: "1.5.0",
      issues: [expect.objectContaining({ number: 22 }), expect.objectContaining({ number: 23 })],
    });
  });

  it("shows a running ship as a badge linking to the run, with no button", () => {
    renderTable({
      ship: {
        active: true,
        run: {
          id: 1,
          url: SHIP_RUN_URL,
          requestId: running.requestId,
          version: "1.5.0",
          status: "in_progress",
          conclusion: null,
          step: "Promote api",
          issues: [22],
          createdAt: "2026-09-11T10:40:00Z",
        },
      },
      issues: [
        pipelineIssue({ number: 22, stage: "staging", ship: running }),
        pipelineIssue({ number: 23, stage: "staging" }),
      ],
    });
    const [shipping, other] = rows();
    const badge = within(shipping).getByRole("link", { name: "Shipping: Promote api" });
    expect(badge).toHaveAttribute("href", SHIP_RUN_URL);
    expect(badge).toHaveAttribute("data-slot", "badge");
    // The other ready row waits: no second ship while one runs.
    expect(actionCell(other)).toHaveTextContent("a ship is running");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows a failed ship with its step, the run link and a retry with the recorded version", async () => {
    const { onAction, user } = renderTable({
      issues: [
        pipelineIssue({
          number: 22,
          stage: "staging",
          ship: {
            ...running,
            version: "1.4.1",
            status: "completed",
            conclusion: "failure",
            step: "Merge release PRs",
          },
        }),
      ],
    });
    const failed = screen.getByRole("link", { name: "Ship failed at Merge release PRs" });
    expect(failed).toHaveAttribute("href", SHIP_RUN_URL);
    expect(failed).toHaveAttribute("data-variant", "destructive");
    const retry = screen.getByRole("button", { name: "Retry ship 1.4.1" });
    await user.click(retry);
    expect(onAction).toHaveBeenCalledWith({
      kind: "retry",
      issue: expect.objectContaining({ number: 22 }),
      version: "1.4.1",
    });
    expect(screen.queryByRole("button", { name: /to production/ })).toBeNull();
  });

  it("explains every row that has no action with a muted hint", () => {
    renderTable({
      issues: [
        pipelineIssue({
          number: 30,
          stage: "implementing",
          pullRequests: [pipelinePullRequest({ repo: "api", number: 1, checks: "pending" })],
        }),
        pipelineIssue({
          number: 31,
          stage: "implementing",
          pullRequests: [
            pipelinePullRequest({ repo: "api", number: 2 }),
            pipelinePullRequest({ repo: "web", number: 3, checks: "red" }),
          ],
        }),
        pipelineIssue({
          number: 32,
          stage: "implementing",
          pullRequests: [pipelinePullRequest({ repo: "api", number: 4, state: "merged" })],
        }),
        pipelineIssue({
          number: 33,
          stage: "staging",
          onStaging: false,
          productionReady: false,
          pullRequests: [
            pipelinePullRequest({ repo: "api", number: 5, state: "merged" }),
            pipelinePullRequest({ repo: "web", number: 6 }),
          ],
        }),
        pipelineIssue({
          number: 34,
          stage: "staging",
          onStaging: false,
          productionReady: false,
          pullRequests: [pipelinePullRequest({ repo: "web", number: 7, state: "merged" })],
        }),
        pipelineIssue({ number: 35, stage: "triaged" }),
        pipelineIssue({ number: 36, stage: "implementing" }),
      ],
    });
    const hints = rows().map((row) => actionCell(row).textContent);
    expect(hints).toEqual([
      "checks running",
      "a check is red",
      "deploying to staging",
      "waiting for the other half",
      "deploying to staging",
      "nothing to deploy",
      "nothing to deploy",
    ]);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders no button for a viewer, only the chips, badges and hints", () => {
    renderTable({ canDeploy: false });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    const [implementing, staging] = rows();
    expect(actionCell(implementing)).toHaveTextContent("ready for staging");
    expect(actionCell(staging)).toHaveTextContent("ready for production");
    expect(within(implementing).getByRole("link", { name: "api #25, checks green" })).toBeVisible();
  });

  it("disables the buttons while the API serves a stale snapshot", () => {
    renderTable({ stale: true });
    expect(screen.getByRole("button", { name: "Deploy to staging" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deploy 1.5.0 to production" })).toBeDisabled();
  });

  it("says why there is no version to release instead of a production button", () => {
    renderTable({ nextVersion: null, nextVersionError: "versions differ, fix by hand" });
    expect(screen.queryByRole("button", { name: /to production/ })).toBeNull();
    expect(actionCell(rows()[1])).toHaveTextContent("versions differ, fix by hand");
  });
});
