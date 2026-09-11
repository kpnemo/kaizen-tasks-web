import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { db, T_SUGGESTED } from "../../../tests/msw/db";
import { API, err, ok } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";

const route = `/tasks/${T_SUGGESTED}`;

/** Each step row is labelled by its title cell, so the row's name is the step title. */
function stepTitles() {
  return within(screen.getByRole("list", { name: "Steps" }))
    .getAllByRole("listitem")
    .map((li) => document.getElementById(li.getAttribute("aria-labelledby")!)!.textContent);
}

describe("step reorder and add step", () => {
  it("moving a step sends PATCH with the target index and reorders optimistically", async () => {
    const patches: { id: string; body: unknown }[] = [];
    server.use(
      http.patch<{ id: string }>(`${API}/tasks/:id`, async ({ params, request }) => {
        const body = (await request.json()) as { position: number };
        patches.push({ id: params.id, body });
        await new Promise((r) => setTimeout(r, 30));
        db.move(db.find(params.id)!, body.position);
        return ok(db.detail(T_SUGGESTED));
      }),
    );
    const { user } = renderApp({ route });
    await screen.findByRole("list", { name: "Steps" });
    expect(stepTitles().slice(0, 3)).toEqual([
      "List the three decisions the deck must drive",
      "Pull last quarter's numbers from the dashboard",
      "Draft the outline",
    ]);
    await user.click(
      screen.getByRole("button", {
        name: "Move Pull last quarter's numbers from the dashboard down",
      }),
    );
    // Optimistic: the order changes before the server answers.
    expect(stepTitles().slice(0, 3)).toEqual([
      "List the three decisions the deck must drive",
      "Draft the outline",
      "Pull last quarter's numbers from the dashboard",
    ]);
    await waitFor(() => expect(patches).toEqual([{ id: "s-2", body: { position: 2 } }]));
    await waitFor(() =>
      expect(stepTitles()[2]).toBe("Pull last quarter's numbers from the dashboard"),
    );
    expect(
      screen.getByRole("button", { name: "Move List the three decisions the deck must drive up" }),
    ).toBeDisabled();
    // Let the mock's delayed db.move and the settle-refetch finish before the next test starts.
    await new Promise((resolve) => setTimeout(resolve, 40));
    await waitFor(() =>
      expect(stepTitles()[2]).toBe("Pull last quarter's numbers from the dashboard"),
    );
  });

  it("rolls back and shows a toast when the reorder fails", async () => {
    server.use(http.patch(`${API}/tasks/:id`, () => err("INTERNAL", "Could not move the step")));
    const { user } = renderApp({ route });
    await screen.findByRole("list", { name: "Steps" });
    await user.click(screen.getByRole("button", { name: "Move Draft the outline up" }));
    expect(await screen.findByText("Could not move the step")).toBeInTheDocument();
    await waitFor(() =>
      expect(stepTitles().slice(0, 3)).toEqual([
        "List the three decisions the deck must drive",
        "Pull last quarter's numbers from the dashboard",
        "Draft the outline",
      ]),
    );
  });

  it("every row has a drag handle", async () => {
    renderApp({ route });
    await screen.findByRole("list", { name: "Steps" });
    expect(screen.getAllByRole("button", { name: "Drag to reorder" })).toHaveLength(4);
  });

  it("adds a step under the task", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/tasks`, async ({ request }) => {
        const body = (await request.json()) as { title: string; parentId: string };
        bodies.push(body);
        db.rows.push({
          ...db.find("s-4")!,
          id: "s-new",
          title: body.title,
          position: 4,
          createdAt: "2026-09-09T00:00:00.000Z",
        });
        return ok(db.detail("s-new"), {}, 201);
      }),
    );
    const { user } = renderApp({ route });
    await screen.findByRole("list", { name: "Steps" });
    await user.type(
      screen.getByRole("textbox", { name: "New step" }),
      "Send the calendar invite{Enter}",
    );
    expect(
      await screen.findByRole("listitem", { name: "Send the calendar invite" }),
    ).toBeInTheDocument();
    expect(bodies).toEqual([{ title: "Send the calendar invite", parentId: T_SUGGESTED }]);
    expect(screen.getByRole("textbox", { name: "New step" })).toHaveValue("");
  });
});
