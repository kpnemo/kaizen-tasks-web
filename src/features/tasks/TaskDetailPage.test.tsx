import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { db, T_SUGGESTED } from "../../../tests/msw/db";
import { API, err, ok } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";

type Patch = { id: string; body: Record<string, unknown> };

/** Records every PATCH /tasks/:id body and applies it through the default handler logic. */
function recordPatches() {
  const patches: Patch[] = [];
  server.use(
    http.patch<{ id: string }>(`${API}/tasks/:id`, async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      patches.push({ id: params.id, body });
      const row = db.find(params.id)!;
      Object.assign(row, body);
      return ok(db.detail(params.id));
    }),
  );
  return patches;
}

const route = `/tasks/${T_SUGGESTED}`;
const step = (name: string) => screen.getByRole("listitem", { name });

describe("task detail", () => {
  it("renders the title as the heading and the suggested steps with rationale on tap and hover", async () => {
    const { user } = renderApp({ route });
    expect(screen.getByRole("status", { name: "Loading task" })).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Prepare the quarterly business review deck" }),
    ).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Steps" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((li) => li.getAttribute("aria-labelledby")),
    ).toHaveLength(4);
    const first = step("List the three decisions the deck must drive");
    expect(within(first).getByRole("button", { name: "Suggested by AI" })).toBeInTheDocument();
    expect(within(first).getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(
      within(first).getByRole("button", {
        name: "More actions for List the three decisions the deck must drive",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Everything else follows from what the room must decide."),
    ).toBeNull();
    await user.click(within(first).getByRole("button", { name: "Suggested by AI" }));
    expect(
      await screen.findByText("Everything else follows from what the room must decide."),
    ).toBeInTheDocument();
    await user.click(within(first).getByRole("button", { name: "Suggested by AI" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Everything else follows from what the room must decide."),
      ).toBeNull(),
    );
    await user.hover(
      within(step("Draft the outline")).getByRole("button", { name: "Suggested by AI" }),
    );
    expect(await screen.findByText("An outline makes the review cheap.")).toBeInTheDocument();
    // The user-created step has no badge and no suggestion actions.
    const userStep = step("Book the rehearsal slot");
    expect(within(userStep).queryByRole("button", { name: "Suggested by AI" })).toBeNull();
    expect(within(userStep).queryByRole("button", { name: "Accept" })).toBeNull();
    expect(within(userStep).queryByRole("button", { name: /More actions/ })).toBeNull();
    expect(screen.getByText("0/1")).toBeInTheDocument();
  });

  it("accept sets the suggestion state and updates progress", async () => {
    const patches = recordPatches();
    const { user } = renderApp({ route });
    await user.click(
      within(
        await screen.findByRole("listitem", {
          name: "List the three decisions the deck must drive",
        }),
      ).getByRole("button", { name: "Accept" }),
    );
    await waitFor(() =>
      expect(patches).toEqual([{ id: "s-1", body: { suggestionState: "accepted" } }]),
    );
    expect(await screen.findByText("0/2")).toBeInTheDocument();
    expect(
      within(step("List the three decisions the deck must drive")).queryByRole("button", {
        name: "Accept",
      }),
    ).toBeNull();
    // The accepted marker is a visible chip, not a lone icon.
    expect(
      within(step("List the three decisions the deck must drive")).getByLabelText(
        "Suggested by AI, accepted",
      ),
    ).toHaveTextContent("AI");
  });

  it("dismiss collapses the step into the dismissed disclosure and undo brings it back as accepted", async () => {
    const patches = recordPatches();
    const { user } = renderApp({ route });
    const row = await screen.findByRole("listitem", { name: "Draft the outline" });
    await user.click(
      within(row).getByRole("button", { name: "More actions for Draft the outline" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Dismiss" }));
    await waitFor(() =>
      expect(patches.at(-1)).toEqual({ id: "s-3", body: { suggestionState: "dismissed" } }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("listitem", { name: "Draft the outline" })).toBeNull(),
    );
    const disclosure = screen.getByRole("button", { name: "1 dismissed", expanded: false });
    await user.click(disclosure);
    const dismissed = screen.getByRole("list", { name: "Dismissed steps" });
    expect(within(dismissed).getByText("Dismissed")).toBeInTheDocument();
    await user.click(within(dismissed).getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(patches.at(-1)).toEqual({ id: "s-3", body: { suggestionState: "accepted" } }),
    );
    expect(await screen.findByRole("listitem", { name: "Draft the outline" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismissed/ })).toBeNull();
  });

  it("edit then accept saves the new title and accepts in one request", async () => {
    const patches = recordPatches();
    const { user } = renderApp({ route });
    const row = await screen.findByRole("listitem", { name: "Draft the outline" });
    await user.click(
      within(row).getByRole("button", { name: "More actions for Draft the outline" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Edit wording, then accept" }));
    const input = await screen.findByRole("textbox", { name: "Step title" });
    expect(input).toHaveValue("Draft the outline");
    await user.clear(input);
    await user.type(input, "Draft a one-page outline{Enter}");
    await waitFor(() =>
      expect(patches).toEqual([
        { id: "s-3", body: { title: "Draft a one-page outline", suggestionState: "accepted" } },
      ]),
    );
    expect(
      await screen.findByRole("listitem", { name: "Draft a one-page outline" }),
    ).toBeInTheDocument();
  });

  it("edits the title, description, and status in the header", async () => {
    const patches = recordPatches();
    const { user } = renderApp({ route });
    await user.click(
      await screen.findByRole("button", { name: "Prepare the quarterly business review deck" }),
    );
    await user.clear(screen.getByRole("textbox", { name: "Title" }));
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Prepare the QBR deck{Enter}");
    await waitFor(() =>
      expect(patches.at(-1)).toEqual({ id: T_SUGGESTED, body: { title: "Prepare the QBR deck" } }),
    );
    expect(
      await screen.findByRole("heading", { name: "Prepare the QBR deck" }),
    ).toBeInTheDocument();

    const status = screen.getByRole("group", { name: "Status" });
    expect(
      within(status).getByRole("button", { name: "To do", pressed: true }),
    ).toBeInTheDocument();
    await user.click(within(status).getByRole("button", { name: "Done", pressed: false }));
    await waitFor(() =>
      expect(patches.at(-1)).toEqual({ id: T_SUGGESTED, body: { status: "done" } }),
    );
    expect(
      await within(status).findByRole("button", { name: "Done", pressed: true }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "For the leadership team on the 30th." }));
    await user.clear(screen.getByRole("textbox", { name: "Description" }));
    await user.type(
      screen.getByRole("textbox", { name: "Description" }),
      "Thirty minutes, five slides.",
    );
    await user.click(screen.getByRole("heading", { name: "Steps" }));
    await waitFor(() =>
      expect(patches.at(-1)).toEqual({
        id: T_SUGGESTED,
        body: { description: "Thirty minutes, five slides." },
      }),
    );
  });

  it("checks a user step done", async () => {
    const patches = recordPatches();
    const { user } = renderApp({ route });
    await user.click(
      await screen.findByRole("checkbox", { name: "Mark Book the rehearsal slot done" }),
    );
    await waitFor(() => expect(patches).toEqual([{ id: "s-4", body: { status: "done" } }]));
    expect(await screen.findByText("1/1")).toBeInTheDocument();
  });

  it("removes a tag through PUT /tasks/:id/tags", async () => {
    const puts: unknown[] = [];
    server.use(
      http.put<{ id: string }>(`${API}/tasks/:id/tags`, async ({ params, request }) => {
        puts.push(await request.json());
        db.find(params.id)!.tags = [];
        return ok(db.detail(params.id));
      }),
    );
    const { user } = renderApp({ route });
    await user.click(await screen.findByRole("button", { name: "Remove tag work" }));
    await waitFor(() => expect(puts).toEqual([{ tagIds: [] }]));
    expect(screen.queryByText("work")).toBeNull();
  });

  it("shows a not-found state for an unknown id", async () => {
    server.use(http.get(`${API}/tasks/nope`, () => err("NOT_FOUND", "Task not found")));
    renderApp({ route: "/tasks/nope" });
    expect(await screen.findByRole("alert")).toHaveTextContent("This task does not exist.");
    const back = screen.getByRole("link", { name: "Back to tasks" });
    expect(back).toHaveAttribute("href", "/tasks");
    expect(back).toHaveAttribute("data-slot", "button");
    // A Button-styled anchor gets the 44px hit area only through the globals.css `a[data-nav]` rule.
    expect(back).toHaveAttribute("data-nav");
  });
});
