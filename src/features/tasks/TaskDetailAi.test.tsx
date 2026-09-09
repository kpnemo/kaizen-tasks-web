import { act, screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db, makeStep, makeTask, T_FAILED, T_SKIPPED, T_SUGGESTED } from "../../../tests/msw/db";
import { API, err, ok } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";

const route = `/tasks/${T_SUGGESTED}`;

describe("detail AI state", () => {
  afterEach(() => vi.useRealTimers());

  it("accept all and dismiss all call their endpoints", async () => {
    let accepts = 0;
    let dismisses = 0;
    server.use(
      http.post(`${API}/tasks/${T_SUGGESTED}/suggestions/accept-all`, () => {
        accepts += 1;
        for (const c of db.children(T_SUGGESTED))
          if (c.suggestionState === "suggested") c.suggestionState = "accepted";
        return ok(db.detail(T_SUGGESTED));
      }),
      http.post(`${API}/tasks/${T_SUGGESTED}/suggestions/dismiss-all`, () => {
        dismisses += 1;
        for (const c of db.children(T_SUGGESTED))
          if (c.suggestionState === "suggested") c.suggestionState = "dismissed";
        return ok(db.detail(T_SUGGESTED));
      }),
    );
    const { user, unmount } = renderApp({ route });
    const bar = await screen.findByRole("group", { name: "Suggestions" });
    expect(within(bar).getByText("3 suggestions to review")).toBeInTheDocument();
    await user.click(within(bar).getByRole("button", { name: "Accept all" }));
    await waitFor(() => expect(accepts).toBe(1));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Accept" })).toBeNull());
    expect(screen.getByText("0/4")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Suggestions" })).toBeNull();
    unmount();

    db.reset();
    const second = renderApp({ route });
    await second.user.click(
      within(await screen.findByRole("group", { name: "Suggestions" })).getByRole("button", {
        name: "Dismiss all",
      }),
    );
    await waitFor(() => expect(dismisses).toBe(1));
    expect(await screen.findByRole("button", { name: "3 dismissed" })).toBeInTheDocument();
    expect(screen.getByText("0/1")).toBeInTheDocument();
  });

  it("regenerate calls the breakdown action and is disabled while the assistant works", async () => {
    let breakdowns = 0;
    server.use(
      http.post(`${API}/tasks/${T_SUGGESTED}/breakdown`, () => {
        breakdowns += 1;
        db.find(T_SUGGESTED)!.aiStatus = "pending";
        return ok(db.detail(T_SUGGESTED), {}, 202);
      }),
    );
    const { user } = renderApp({ route });
    const button = await screen.findByRole("button", { name: "Regenerate" });
    expect(button).toBeEnabled();
    expect(screen.queryByRole("status", { name: "Assistant" })).toBeNull();
    await user.click(button);
    await waitFor(() => expect(breakdowns).toBe(1));
    expect(await screen.findByRole("status", { name: "Assistant" })).toHaveTextContent("Thinking");
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeDisabled();
  });

  it("shows the conflict message when a generation is already active", async () => {
    server.use(
      http.post(`${API}/tasks/${T_SUGGESTED}/breakdown`, () =>
        err("CONFLICT", "A generation is pending"),
      ),
    );
    const { user } = renderApp({ route });
    await user.click(await screen.findByRole("button", { name: "Regenerate" }));
    expect(await screen.findByText("Already working on it")).toBeInTheDocument();
  });

  it("failed banner shows the message and retries", async () => {
    let retries = 0;
    server.use(
      http.post(`${API}/tasks/${T_FAILED}/breakdown`, () => {
        retries += 1;
        db.find(T_FAILED)!.aiStatus = "pending";
        return ok(db.detail(T_FAILED), {}, 202);
      }),
    );
    const { user } = renderApp({ route: `/tasks/${T_FAILED}` });
    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Breakdown failed: The assistant is unavailable, try again");
    await user.click(within(banner).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(retries).toBe(1));
    expect(await screen.findByRole("status", { name: "Assistant" })).toHaveTextContent("Thinking");
  });

  it("skipped banner shows the reason in words", async () => {
    renderApp({ route: `/tasks/${T_SKIPPED}` });
    expect(await screen.findByRole("status", { name: "Assistant" })).toHaveTextContent(
      "Too short to break down",
    );
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeEnabled();
  });

  it("polls every two seconds while active, stops when settled, and invalidates the list", async () => {
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    const task = makeTask({ id: "t-live", title: "Live task", aiStatus: "running" });
    db.rows.push(task);
    let calls = 0;
    server.use(
      http.get(`${API}/tasks/t-live`, () => {
        calls += 1;
        if (calls >= 3) {
          task.aiStatus = "done";
          db.rows.push(makeStep({ id: "s-live", parentId: "t-live", title: "First step" }));
        }
        return ok(db.detail("t-live"));
      }),
    );
    const { queryClient } = renderApp({ route: "/tasks/t-live" });
    queryClient.setQueryData(["tasks", {}], { pages: [], pageParams: [] });
    expect(await screen.findByRole("status", { name: "Assistant" })).toHaveTextContent("Thinking");
    expect(calls).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(2100));
    await waitFor(() => expect(calls).toBe(2));
    await act(() => vi.advanceTimersByTimeAsync(2100));
    await waitFor(() => expect(calls).toBe(3));
    expect(await screen.findByRole("listitem", { name: "First step" })).toBeInTheDocument();
    await waitFor(() => expect(queryClient.getQueryState(["tasks", {}])?.isInvalidated).toBe(true));
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(calls).toBe(3);
  });
});
