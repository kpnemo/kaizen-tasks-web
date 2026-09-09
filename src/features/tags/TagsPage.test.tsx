import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { db, TAG_WORK } from "../../../tests/msw/db";
import { API, err, ok } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";

const tagRow = (name: string) => screen.getByRole("row", { name });

describe("tags page", () => {
  it("lists the tags with a swatch and a name", async () => {
    renderApp({ route: "/tags" });
    expect(await screen.findByRole("heading", { name: "Tags" })).toBeInTheDocument();
    const table = await screen.findByRole("table", { name: "Your tags" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(
      within(tagRow("work")).getByRole("button", { name: "Change color of work" }),
    ).toBeInTheDocument();
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

  it("shows the error state when tags fail to load", async () => {
    server.use(http.get(`${API}/tags`, () => err("INTERNAL", "Tag store unavailable")));
    renderApp({ route: "/tags" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Tag store unavailable");
  });
});
