import { act, screen, waitFor, within } from "@testing-library/react";
import { delay, http } from "msw";
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
    // The one chip that is a link is the demo's click target: it gets the 2.75rem hit area every
    // button has (globals.css covers `button` and `a[data-nav]`, not a Badge rendered as a link).
    expect(suggestions).toHaveClass("min-h-11");
    expect(
      within(row("Fully done task")).queryByText(/thinking|suggestion|failed|skipped/i),
    ).toBeNull();
    expect(within(row("Buy milk")).getByText("Too short to break down")).toBeInTheDocument();
    expect(within(row("Rate limited task")).getByText("Hourly limit reached")).toBeInTheDocument();
    expect(within(row("Paused task")).getByText("Assistant paused")).toBeInTheDocument();
    // A failed breakdown keeps its status chip in the row's rail and carries the API message in an
    // Alert on the row's second line, where nothing clips it, with Retry beside it.
    const failed = row("Plan the team offsite agenda");
    expect(
      within(failed).getByText("Breakdown failed", { selector: "[data-slot=badge]" }),
    ).toHaveAttribute("data-variant", "destructive");
    const failure = within(failed).getByRole("alert");
    expect(failure).toHaveTextContent("Breakdown failed");
    expect(failure).toHaveTextContent("The assistant is unavailable, try again");
    expect(within(failed).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    // One Badge variant per meaning: in-flight and skipped are secondary, never ghost or muted.
    expect(
      within(row("Pending task")).getByText("Thinking").closest("[data-slot=badge]"),
    ).toHaveAttribute("data-variant", "secondary");
    expect(
      within(row("Rate limited task"))
        .getByText("Hourly limit reached")
        .closest("[data-slot=badge]"),
    ).toHaveAttribute("data-variant", "secondary");
    // Every row is a listitem whose title is a link to the detail (smoke selector contract), and
    // the row holds a Card.
    expect(within(row("Buy milk")).getByRole("link", { name: "Buy milk" })).toHaveAttribute(
      "href",
      "/tasks/t-2",
    );
    expect(row("Buy milk").firstElementChild).toHaveAttribute("data-slot", "card");
    // Progress from `progress`: the visible done/total text next to a Progress that says it in
    // words, and nothing at all for a task with no counted steps yet (no empty bar, no 0/0).
    const suggested = row("Prepare the quarterly business review deck");
    expect(within(suggested).getByText("0/1")).toBeInTheDocument();
    expect(within(suggested).getByRole("progressbar", { name: "Steps done" })).toHaveAttribute(
      "aria-valuetext",
      "0 of 1 steps done",
    );
    expect(within(row("Pending task")).queryByRole("progressbar")).toBeNull();
    expect(within(row("Pending task")).queryByText("0/0")).toBeNull();
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
    // The create bar is a Card with a visible label and hint on the title field; the names the
    // smoke test uses ("Task title", "Description", "Add description", "Add task") do not change.
    const titleBox = screen.getByRole("textbox", { name: "Task title" });
    expect(screen.getByText("Task title", { selector: "label" })).toBeInTheDocument();
    expect(titleBox).toHaveAccessibleDescription(
      "A sentence or two of context helps the assistant",
    );
    expect(titleBox.closest("form")?.firstElementChild).toHaveAttribute("data-slot", "card");
    expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Add description" }));
    expect(screen.getByText("Description", { selector: "label" })).toBeInTheDocument();
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
    await screen.findByText("No tasks");
    // Both filter groups are fieldsets whose visible legends name them.
    const status = screen.getByRole("group", { name: "Status" });
    expect(within(status).getByRole("button", { name: "All", pressed: true })).toBeInTheDocument();
    await user.click(within(status).getByRole("button", { name: "Done", pressed: false }));
    await waitFor(() => expect(queries.at(-1)).toContain("status=done"));
    const tagGroup = await screen.findByRole("group", { name: "Tag" });
    await user.click(await within(tagGroup).findByRole("button", { name: "work", pressed: false }));
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

  // The pending pattern swaps the icon for a Spinner and disables the button. `ui/spinner.tsx`
  // ships `role="status" aria-label="Loading"`, which the button's name-from-content would fold in
  // as "Loading Add task" / "Loading Retry" unless the Spinner is aria-hidden; the smoke test finds
  // both buttons by their exact names, so the two tests below pin the name while the request runs.
  it("keeps the button named Add task while it saves", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${API}/tasks`, async ({ request }) => {
        const body = (await request.json()) as { title: string };
        await gate;
        db.rows.push(makeTask({ id: "t-slow", title: body.title, aiStatus: "pending" }));
        return ok(db.detail("t-slow"), {}, 201);
      }),
    );
    const { user } = renderApp({ route: "/tasks" });
    await screen.findByText("Buy milk");
    await user.type(
      screen.getByRole("textbox", { name: "Task title" }),
      "Write the workshop runbook{Enter}",
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled());
    // Still saving: the title is not cleared yet, and no button picked up the Spinner's label.
    expect(screen.getByRole("textbox", { name: "Task title" })).toHaveValue(
      "Write the workshop runbook",
    );
    expect(screen.queryByRole("button", { name: /loading/i })).toBeNull();
    release();
    expect(
      await screen.findByRole("listitem", { name: "Write the workshop runbook" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Task title" })).toHaveValue("");
  });

  it("keeps the button named Retry while the breakdown is requested again", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${API}/tasks/${T_FAILED}/breakdown`, async () => {
        await gate;
        db.find(T_FAILED)!.aiStatus = "pending";
        return ok(db.detail(T_FAILED), {}, 202);
      }),
    );
    const { user } = renderApp({ route: "/tasks" });
    await user.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled());
    expect(screen.queryByRole("button", { name: /loading/i })).toBeNull();
    // The failure stays on screen, unclipped, until the API answers.
    expect(within(row("Plan the team offsite agenda")).getByRole("alert")).toHaveTextContent(
      "The assistant is unavailable, try again",
    );
    release();
    expect(
      await within(row("Plan the team offsite agenda")).findByText("Thinking"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("shows the error state with a retry when the list fails", async () => {
    server.use(http.get(`${API}/tasks`, () => err("INTERNAL", "Database unavailable")));
    const { user } = renderApp({ route: "/tasks" });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load tasks");
    expect(alert).toHaveTextContent("Database unavailable");
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Buy milk")).toBeInTheDocument();
  });

  it("shows skeletons while loading and an Empty when there is nothing to list", async () => {
    server.use(
      http.get(`${API}/tasks`, async () => {
        await delay(150);
        return ok([], { nextCursor: null });
      }),
    );
    renderApp({ route: "/tasks" });
    // The sentence stays for the screen reader, inside the role="status" region the skeletons fill.
    const status = (await screen.findByText("Loading tasks")).closest("[role=status]");
    expect(status).not.toBeNull();
    expect(status!.querySelectorAll("[data-slot=skeleton]").length).toBe(3);
    expect(await screen.findByText("No tasks")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No tasks yet. Add one above and the assistant will break it into small steps.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading tasks")).toBeNull();
    expect(screen.queryByRole("list", { name: "Tasks" })).toBeNull();
  });

  it("keeps the tag group's place while tags load", async () => {
    server.use(
      http.get(`${API}/tags`, async () => {
        await delay(150);
        return ok(db.tags);
      }),
    );
    renderApp({ route: "/tasks" });
    const group = await screen.findByRole("group", { name: "Tag" });
    expect(group.querySelectorAll("[data-slot=skeleton]").length).toBe(2);
    expect(
      await within(group).findByRole("button", { name: "work", pressed: false }),
    ).toBeInTheDocument();
    expect(group.querySelectorAll("[data-slot=skeleton]").length).toBe(0);
  });

  it("toasts once when the tags cannot load and shows no tag group", async () => {
    server.use(http.get(`${API}/tags`, () => err("INTERNAL", "Tags are unavailable")));
    renderApp({ route: "/tasks" });
    expect(await screen.findByText("Tags are unavailable")).toBeInTheDocument();
    await screen.findByText("Buy milk");
    expect(screen.queryByRole("group", { name: "Tag" })).toBeNull();
    expect(screen.getAllByText("Tags are unavailable")).toHaveLength(1);
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
