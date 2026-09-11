import { act, screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { nextPaletteColor, TAG_PALETTE } from "@/lib/tag-palette";
import { db, TAG_WORK } from "../../../tests/msw/db";
import { API, err, ok } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";

const tagRow = (name: string) => screen.getByRole("row", { name });

describe("tags page", () => {
  it("lists the tags in a table: swatch, palette name, tag name and the row actions", async () => {
    renderApp({ route: "/tags" });
    expect(await screen.findByRole("heading", { name: "Tags" })).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "Your tags" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByRole("columnheader", { name: "Color" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    const work = tagRow("work");
    expect(within(work).getByRole("button", { name: "Change color of work" })).toBeInTheDocument();
    expect(within(work).getByText("Indigo")).toBeInTheDocument();
    expect(within(work).getByRole("button", { name: "work" })).toBeInTheDocument();
    expect(within(work).getByRole("button", { name: "Delete work" })).toBeInTheDocument();
    expect(within(tagRow("home")).getByText("Forest")).toBeInTheDocument();
  });

  it("announces loading, then shows the table", async () => {
    renderApp({ route: "/tags" });
    const loading = await screen.findByText("Loading tags");
    expect(loading.closest('[role="status"]')).not.toBeNull();
    expect(await screen.findByRole("table", { name: "Your tags" })).toBeInTheDocument();
    expect(screen.queryByText("Loading tags")).toBeNull();
  });

  it("shows the empty state when there are no tags", async () => {
    db.tags = [];
    renderApp({ route: "/tags" });
    expect(await screen.findByText("No tags yet. Tags connect related tasks.")).toBeInTheDocument();
    expect(screen.getByText("No tags")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Your tags" })).toBeNull();
  });

  it("creates a tag with a palette color", async () => {
    const posts: unknown[] = [];
    server.use(
      http.post(`${API}/tags`, async ({ request }) => {
        const body = (await request.json()) as { name: string; color: string };
        posts.push(body);
        const tag = { id: "tag-new", createdAt: "2026-09-09T00:00:00.000Z", ...body };
        db.tags.push(tag);
        return ok(tag, {}, 201);
      }),
    );
    const { user } = renderApp({ route: "/tags" });
    await screen.findByRole("table", { name: "Your tags" });
    const form = screen.getByRole("form", { name: "Create tag" });
    expect(within(form).getByText("New tag")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "reading");
    await user.click(screen.getByRole("radio", { name: "Forest" }));
    await user.click(screen.getByRole("button", { name: "Create tag" }));
    await waitFor(() => expect(posts).toEqual([{ name: "reading", color: "#2F7D4F" }]));
    expect(await screen.findByRole("row", { name: "reading" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("shows a duplicate name as a field error", async () => {
    const { user } = renderApp({ route: "/tags" });
    await screen.findByRole("table", { name: "Your tags" });
    await user.type(screen.getByLabelText("Name"), "Work");
    await user.click(screen.getByRole("button", { name: "Create tag" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A tag with this name already exists",
    );
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  });

  it("renames and recolors inline", async () => {
    const patches: { id: string; body: unknown }[] = [];
    server.use(
      http.patch<{ id: string }>(`${API}/tags/:id`, async ({ params, request }) => {
        const body = (await request.json()) as Record<string, string>;
        patches.push({ id: params.id, body });
        const tag = db.tags.find((t) => t.id === params.id)!;
        Object.assign(tag, body);
        return ok(tag);
      }),
    );
    const { user } = renderApp({ route: "/tags" });
    await screen.findByRole("table", { name: "Your tags" });
    await user.click(within(tagRow("work")).getByRole("button", { name: "work" }));
    await user.clear(screen.getByRole("textbox", { name: "Tag name" }));
    await user.type(screen.getByRole("textbox", { name: "Tag name" }), "office{Enter}");
    await waitFor(() => expect(patches).toEqual([{ id: TAG_WORK, body: { name: "office" } }]));
    expect(await screen.findByRole("row", { name: "office" })).toBeInTheDocument();

    await user.click(
      within(tagRow("office")).getByRole("button", { name: "Change color of office" }),
    );
    const colorPopover = await screen.findByRole("radiogroup", { name: "Color of office" });
    await user.click(within(colorPopover).getByRole("radio", { name: "Amber" }));
    await waitFor(() =>
      expect(patches.at(-1)).toEqual({ id: TAG_WORK, body: { color: "#C77D1A" } }),
    );
    expect(await within(tagRow("office")).findByText("Amber")).toBeInTheDocument();
  });

  it("deletes after a confirmation that explains links are removed", async () => {
    let deletes = 0;
    server.use(
      http.delete<{ id: string }>(`${API}/tags/:id`, ({ params }) => {
        deletes += 1;
        db.tags = db.tags.filter((t) => t.id !== params.id);
        return new Response(null, { status: 204 });
      }),
    );
    const { user } = renderApp({ route: "/tags" });
    await screen.findByRole("table", { name: "Your tags" });
    await user.click(within(tagRow("home")).getByRole("button", { name: "Delete home" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("removed from every task");
    await user.click(within(dialog).getByRole("button", { name: "Delete tag" }));
    await waitFor(() => expect(deletes).toBe(1));
    await waitFor(() => expect(screen.queryByRole("row", { name: "home" })).toBeNull());
  });

  it("shows the error state with a way to try again when tags fail to load", async () => {
    server.use(http.get(`${API}/tags`, () => err("INTERNAL", "Tag store unavailable")));
    const { user } = renderApp({ route: "/tags" });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load tags");
    expect(alert).toHaveTextContent("Tag store unavailable");

    server.use(http.get(`${API}/tags`, () => ok(db.tags)));
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table", { name: "Your tags" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("defaults the create form's color to the first palette color not already used", async () => {
    renderApp({ route: "/tags" });
    await screen.findByRole("table", { name: "Your tags" });
    const expectedColor = nextPaletteColor(db.tags);
    const expectedName = TAG_PALETTE.find(
      (c) => c.value.toUpperCase() === expectedColor.toUpperCase(),
    )!.name;
    const group = screen.getByRole("radiogroup", { name: "Color" });
    expect(within(group).getByRole("radio", { name: expectedName })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("navigates the create form's color picker with arrow keys, End and Space", async () => {
    const { user } = renderApp({ route: "/tags" });
    await screen.findByRole("table", { name: "Your tags" });
    const group = screen.getByRole("radiogroup", { name: "Color" });
    const radios = within(group).getAllByRole("radio");
    const startIndex = radios.findIndex((r) => r.getAttribute("aria-checked") === "true");

    act(() => radios[startIndex].focus());
    // An arrow key moves focus and checks the radio it lands on, as a native radio group does.
    // The key stays held across the move because the focus lands on the next tick.
    await user.keyboard("{ArrowRight>}");
    const nextIndex = (startIndex + 1) % TAG_PALETTE.length;
    await waitFor(() => expect(radios[nextIndex]).toHaveAttribute("aria-checked", "true"));
    expect(radios[nextIndex]).toHaveFocus();
    expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);
    expect(radios[nextIndex].tabIndex).toBe(0);
    await user.keyboard("{/ArrowRight}");

    // End moves focus to the last swatch without checking it; Space checks the focused one.
    await user.keyboard("{End}");
    const lastIndex = TAG_PALETTE.length - 1;
    await waitFor(() => expect(radios[lastIndex]).toHaveFocus());
    expect(radios[nextIndex]).toHaveAttribute("aria-checked", "true");
    await user.keyboard(" ");
    await waitFor(() => expect(radios[lastIndex]).toHaveAttribute("aria-checked", "true"));
  });
});
