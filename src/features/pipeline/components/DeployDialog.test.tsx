import { screen, waitFor, within } from "@testing-library/react";
import { delay, http } from "msw";
import { describe, expect, it } from "vitest";
import {
  API,
  err,
  ok,
  pipelineIssue,
  pipelinePullRequest,
  pipelineSnapshot,
  SHIP_RUN_URL,
} from "../../../../tests/msw/handlers";
import { server } from "../../../../tests/msw/server";
import { renderApp } from "../../../../tests/render";

type Captured = { path: string; body: unknown };

/** Records every pipeline POST and answers it with `respond`. */
function capturePosts(respond: () => Response = () => ok({ merged: [], remaining: [] })) {
  const posts: Captured[] = [];
  const record = async ({ request }: { request: Request }) => {
    posts.push({ path: new URL(request.url).pathname, body: await request.json() });
    return respond();
  };
  server.use(
    http.post(`${API}/pipeline/issues/:number/deploy-staging`, record),
    http.post(`${API}/pipeline/ship`, record),
    http.post(`${API}/pipeline/ship/retry`, record),
  );
  return posts;
}

async function openDialog(name: string | RegExp) {
  const { user, queryClient } = renderApp({ route: "/pipeline" });
  // Every ready row carries the same production button; any of them opens the one dialog.
  await user.click((await screen.findAllByRole("button", { name }))[0]);
  const dialog = await screen.findByRole("alertdialog");
  return { user, queryClient, dialog };
}

describe("DeployDialog", () => {
  it("opens for an issue with the pull requests that will merge and a password field", async () => {
    const { dialog } = await openDialog("Deploy to staging");
    expect(within(dialog).getByRole("heading", { name: "Deploy #24 to staging" })).toBeVisible();
    expect(dialog).toHaveTextContent("api #25");
    expect(dialog).toHaveTextContent("web #27");
    const field = within(dialog).getByLabelText("Deploy passphrase");
    expect(field).toHaveAttribute("type", "password");
    expect(field).toHaveAttribute("autocomplete", "off");
    expect(field).toHaveFocus();
    expect(within(dialog).getByRole("button", { name: "Deploy to staging" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("posts the passphrase, closes on success, refetches the snapshot and confirms in a toast", async () => {
    let gets = 0;
    server.use(
      http.get(`${API}/pipeline`, () => {
        gets += 1;
        return ok(pipelineSnapshot());
      }),
    );
    const posts = capturePosts(() =>
      ok({
        merged: [
          { repo: "api", number: 25, sha: "a".repeat(40) },
          { repo: "web", number: 27, sha: "b".repeat(40) },
        ],
        remaining: [],
      }),
    );
    const { user, dialog } = await openDialog("Deploy to staging");
    const before = gets;
    await user.type(within(dialog).getByLabelText("Deploy passphrase"), "workshop-demo-passphrase");
    await user.click(within(dialog).getByRole("button", { name: "Deploy to staging" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(posts).toEqual([
      {
        path: "/api/v1/pipeline/issues/24/deploy-staging",
        body: { passphrase: "workshop-demo-passphrase" },
      },
    ]);
    await waitFor(() => expect(gets).toBeGreaterThan(before));
    expect(await screen.findByText(/merged api #25 and web #27/)).toBeInTheDocument();
  });

  it("submits on Enter and shows a spinner while the request is in flight", async () => {
    capturePosts(() => {
      return ok({ merged: [], remaining: [] });
    });
    server.use(
      http.post(`${API}/pipeline/issues/:number/deploy-staging`, async () => {
        await delay(200);
        return ok({ merged: [], remaining: [] });
      }),
    );
    const { user, dialog } = await openDialog("Deploy to staging");
    await user.type(
      within(dialog).getByLabelText("Deploy passphrase"),
      "workshop-demo-passphrase{Enter}",
    );
    const verb = within(dialog).getByRole("button", { name: "Deploy to staging" });
    expect(verb).toBeDisabled();
    expect(verb.querySelector("svg.animate-spin")).not.toBeNull();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("shows a wrong passphrase as the field's error and stays open", async () => {
    const posts = capturePosts(() => err("FORBIDDEN", "Forbidden", { reason: "passphrase" }));
    const { user, dialog } = await openDialog("Deploy to staging");
    await user.type(within(dialog).getByLabelText("Deploy passphrase"), "nope-nope-nope");
    await user.click(within(dialog).getByRole("button", { name: "Deploy to staging" }));
    expect(await within(dialog).findByText("Wrong passphrase")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Deploy passphrase")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(posts).toHaveLength(1);
  });

  it("shows the lockout with the time it lifts", async () => {
    capturePosts(() =>
      err("RATE_LIMITED", "Too many attempts", {
        scope: "user",
        limit: 5,
        resetAt: "2026-09-11T11:00:00.000Z",
      }),
    );
    const { user, dialog } = await openDialog("Deploy to staging");
    await user.type(within(dialog).getByLabelText("Deploy passphrase"), "nope-nope-nope");
    await user.click(within(dialog).getByRole("button", { name: "Deploy to staging" }));
    expect(
      await within(dialog).findByText(/^Too many attempts, try again at \d\d:\d\d$/),
    ).toBeInTheDocument();
  });

  it("shows a conflict's sentence inline and keeps the dialog open", async () => {
    capturePosts(() => err("CONFLICT", "web #27 moved since you looked, reload"));
    const { user, dialog } = await openDialog("Deploy to staging");
    await user.type(within(dialog).getByLabelText("Deploy passphrase"), "workshop-demo-passphrase");
    await user.click(within(dialog).getByRole("button", { name: "Deploy to staging" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("web #27 moved since you looked, reload");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Deploy passphrase")).not.toHaveAttribute("aria-invalid");
  });

  it("names every staged issue in the production variant and ships them together", async () => {
    server.use(
      http.get(`${API}/pipeline`, () =>
        ok(
          pipelineSnapshot({
            issues: [
              pipelineIssue({ number: 22, stage: "staging" }),
              pipelineIssue({ number: 23, stage: "staging" }),
            ],
          }),
        ),
      ),
    );
    const posts = capturePosts(() =>
      ok({
        requestId: "11111111-2222-4333-8444-555555555555",
        version: "1.5.0",
        issues: [22, 23],
        run: { id: 1, url: SHIP_RUN_URL },
      }),
    );
    const { user, dialog } = await openDialog("Deploy 1.5.0 to production");
    expect(
      within(dialog).getByRole("heading", { name: "Deploy 1.5.0 to production" }),
    ).toBeVisible();
    expect(dialog).toHaveTextContent("Ships #22 and #23 to production as 1.5.0");
    await user.type(within(dialog).getByLabelText("Deploy passphrase"), "workshop-demo-passphrase");
    await user.click(within(dialog).getByRole("button", { name: "Deploy 1.5.0 to production" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(posts).toEqual([
      {
        path: "/api/v1/pipeline/ship",
        body: { passphrase: "workshop-demo-passphrase", version: "1.5.0", issues: [22, 23] },
      },
    ]);
    expect(await screen.findByText(/Ship 1\.5\.0 started for #22 and #23/)).toBeInTheDocument();
  });

  it("retries a failed ship with the version recorded on the issue", async () => {
    server.use(
      http.get(`${API}/pipeline`, () =>
        ok(
          pipelineSnapshot({
            issues: [
              pipelineIssue({
                number: 22,
                stage: "staging",
                pullRequests: [pipelinePullRequest({ repo: "web", number: 19, state: "merged" })],
                ship: {
                  requestId: "11111111-2222-4333-8444-555555555555",
                  version: "1.4.1",
                  runUrl: SHIP_RUN_URL,
                  done: false,
                  status: "completed",
                  conclusion: "failure",
                  step: "Merge release PRs",
                },
              }),
            ],
          }),
        ),
      ),
    );
    const posts = capturePosts(() =>
      ok({
        requestId: "11111111-2222-4333-8444-555555555555-r1",
        version: "1.4.1",
        issues: [22],
        run: { id: 2, url: SHIP_RUN_URL },
      }),
    );
    const { user, dialog } = await openDialog("Retry ship 1.4.1");
    expect(within(dialog).getByRole("heading", { name: "Retry ship 1.4.1" })).toBeVisible();
    expect(dialog).toHaveTextContent("#22");
    await user.type(within(dialog).getByLabelText("Deploy passphrase"), "workshop-demo-passphrase");
    await user.click(within(dialog).getByRole("button", { name: "Retry ship 1.4.1" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(posts).toEqual([
      {
        path: "/api/v1/pipeline/ship/retry",
        body: { passphrase: "workshop-demo-passphrase", issue: 22 },
      },
    ]);
  });

  it("closes on Cancel without posting", async () => {
    const posts = capturePosts();
    const { user, dialog } = await openDialog("Deploy to staging");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(posts).toHaveLength(0);
  });
});
