import { act, screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  db,
  makeStep,
  makeTask,
  T_FAILED,
  T_SUGGESTED,
  TAG_HOME,
  TAG_WORK,
} from "../../../tests/msw/db";
import { API, err, ok } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";

function row(title: string) {
  return screen.getByRole("listitem", { name: title });
}

describe("task list", () => {
  afterEach(() => vi.useRealTimers());

  it("renders a chip for every aiStatus and every aiSkipReason", async () => {
    db.rows.push(
      makeTask({ id: "t-pending", title: "Pending task", aiStatus: "pending" }),
      makeTask({ id: "t-running", title: "Running task", aiStatus: "running" }),
      // Title deliberately avoids the words in the regex below ("suggestions" would otherwise
      // self-match: getNodeText only reads an element's own direct text, so the title link's own
      // text node, not a phantom chip, would trip a title containing "suggestion").
      makeTask({ id: "t-none", title: "Fully done task", aiStatus: "done" }),
      makeTask({
        id: "t-rate",
        title: "Rate limited task",
        aiStatus: "skipped",
        aiSkipReason: "rate_limited",
      }),
      makeTask({
        id: "t-off",
        title: "Paused task",
        aiStatus: "skipped",
        aiSkipReason: "ai_disabled",
      }),
    );
    renderApp({ route: "/tasks" });
    expect(await screen.findByText("Pending task")).toBeInTheDocument();

    expect(within(row("Pending task")).getByText("Thinking")).toBeInTheDocument();
    expect(within(row("Running task")).getByText("Thinking")).toBeInTheDocument();
    const suggestions = await within(row("Prepare the quarterly business review deck")).findByRole(
      "link",
      {
        name: "3 suggestions",
      },
    );
    expect(suggestions).toHaveAttribute("href", `/tasks/${T_SUGGESTED}`);
    expect(
      within(row("Fully done task")).queryByText(/thinking|suggestion|failed|skipped/i),
    ).toBeNull();
    expect(within(row("Buy milk")).getByText("Too short to break down")).toBeInTheDocument();
    expect(within(row("Rate limited task")).getByText("Hourly limit reached")).toBeInTheDocument();
    expect(within(row("Paused task")).getByText("Assistant paused")).toBeInTheDocument();
    expect(
      within(row("Plan the team offsite agenda")).getByText(
        "Breakdown failed: The assistant is unavailable, try again",
      ),
    ).toBeInTheDocument();
    expect(
      within(row("Plan the team offsite agenda")).getByRole("button", { name: "Retry" }),
    ).toBeInTheDocument();
    // Every row is a listitem whose title is a link to the detail (smoke selector contract).
    expect(within(row("Buy milk")).getByRole("link", { name: "Buy milk" })).toHaveAttribute(
      "href",
      "/tasks/t-2",
    );
    // Progress label from `progress`.
    expect(
      within(row("Prepare the quarterly business review deck")).getByText("0/1"),
    ).toBeInTheDocument();
  });

  it("creates a task from the create bar and shows it first in thinking state", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/tasks`, async ({ request }) => {
        const body = (await request.json()) as { title: string; description?: string };
        bodies.push(body);
        const created = makeTask({
          id: "t-new",
          title: body.title,
          description: body.description ?? null,
          aiStatus: "pending",
          createdAt: "2026-09-09T00:00:00.000Z",
        });
        db.rows.push(created);
        return ok(db.detail("t-new"), {}, 201);
      }),
    );
    const { user } = renderApp({ route: "/tasks" });
    await screen.findByText("Buy milk");
    await user.click(screen.getByRole("button", { name: "Add description" }));
    await user.type(
      screen.getByRole("textbox", { name: "Description" }),
      "Two sentences of context.",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Task title" }),
      "Write the workshop runbook{Enter}",
    );
    const created = await screen.findByRole("listitem", { name: "Write the workshop runbook" });
    expect(within(created).getByText("Thinking")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[0]).toBe(created);
    expect(bodies).toEqual([
      { title: "Write the workshop runbook", description: "Two sentences of context." },
    ]);
    expect(screen.getByRole("textbox", { name: "Task title" })).toHaveValue("");
  });

  it("polls every three seconds while a row is pending and stops when it settles", async () => {
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    const pending = makeTask({ id: "t-poll", title: "Plan the launch", aiStatus: "pending" });
    db.rows = [pending];
    let calls = 0;
    server.use(
      http.get(`${API}/tasks`, () => {
        calls += 1;
        if (calls >= 3) pending.aiStatus = "done";
        return ok([db.summary(pending)], { nextCursor: null });
      }),
    );
    renderApp({ route: "/tasks" });
    expect(await screen.findByText("Plan the launch")).toBeInTheDocument();
    expect(calls).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(3100));
    await waitFor(() => expect(calls).toBe(2));
    await act(() => vi.advanceTimersByTimeAsync(3100));
    await waitFor(() => expect(calls).toBe(3));
    await waitFor(() => expect(within(row("Plan the launch")).queryByText("Thinking")).toBeNull());
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(calls).toBe(3);
  });

  it("routes to login when the replay after a refresh is rejected again", async () => {
    server.use(
      http.get(`${API}/tasks`, () => err("UNAUTHORIZED", "Token expired")),
      http.post(`${API}/auth/refresh`, () => ok({ accessToken: "fresh" })),
    );
    renderApp({ route: "/tasks" });
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/login?returnTo=%2Ftasks");
  });

  it("loads the next page from meta.nextCursor", async () => {
    server.use(
      http.get(`${API}/tasks`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        if (cursor === "page-2") {
          return ok([db.summary(makeTask({ id: "t-b", title: "Second page task" }))], {
            nextCursor: null,
          });
        }
        return ok([db.summary(makeTask({ id: "t-a", title: "First page task" }))], {
          nextCursor: "page-2",
        });
      }),
    );
    const { user } = renderApp({ route: "/tasks" });
    expect(await screen.findByText("First page task")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Second page task")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("sends the status and tag filters as query parameters", async () => {
    const queries: string[] = [];
    server.use(
      http.get(`${API}/tasks`, ({ request }) => {
        queries.push(new URL(request.url).search);
        return ok([], { nextCursor: null });
      }),
    );
    const { user } = renderApp({ route: "/tasks" });
    await screen.findByText(/no tasks/i);
    await user.click(screen.getByRole("button", { name: "Done", pressed: false }));
    await waitFor(() => expect(queries.at(-1)).toContain("status=done"));
    await user.click(await screen.findByRole("button", { name: "work", pressed: false }));
    await waitFor(() => expect(queries.at(-1)).toContain(`tagId=${TAG_WORK}`));
    expect(queries.at(-1)).toContain("status=done");
    // Single-select (R3): choosing a second tag replaces the first.
    await user.click(screen.getByRole("button", { name: "home", pressed: false }));
    await waitFor(() => expect(queries.at(-1)).toContain(`tagId=${TAG_HOME}`));
    expect(queries.at(-1)).not.toContain(TAG_WORK);
  });

  it("retries a failed breakdown from the row", async () => {
    let retries = 0;
    server.use(
      http.post(`${API}/tasks/${T_FAILED}/breakdown`, () => {
        retries += 1;
        const task = db.find(T_FAILED)!;
        task.aiStatus = "pending";
        return ok(db.detail(T_FAILED), {}, 202);
      }),
    );
    const { user } = renderApp({ route: "/tasks" });
    await user.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(retries).toBe(1));
    expect(
      await within(row("Plan the team offsite agenda")).findByText("Thinking"),
    ).toBeInTheDocument();
  });

  it("shows the error state with a retry when the list fails", async () => {
    server.use(http.get(`${API}/tasks`, () => err("INTERNAL", "Database unavailable")));
    const { user } = renderApp({ route: "/tasks" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable");
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Buy milk")).toBeInTheDocument();
  });

  it("reads the suggestion count from the summary and never requests a detail per row", async () => {
    let detailCalls = 0;
    server.use(
      http.get(`${API}/tasks/:id`, () => {
        detailCalls += 1;
        return err("INTERNAL", "the list must not fetch details");
      }),
    );
    db.rows.push(
      makeTask({ id: "t-two", title: "Two suggestions task", aiStatus: "done" }),
      makeStep({ id: "s-x", parentId: "t-two", title: "First" }),
      makeStep({ id: "s-y", parentId: "t-two", title: "Second" }),
    );
    renderApp({ route: "/tasks" });
    const twoRow = await screen.findByRole("listitem", { name: "Two suggestions task" });
    expect(within(twoRow).getByRole("link", { name: "2 suggestions" })).toHaveAttribute(
      "href",
      "/tasks/t-two",
    );
    await screen.findByText("Buy milk");
    expect(detailCalls).toBe(0);
  });
});
