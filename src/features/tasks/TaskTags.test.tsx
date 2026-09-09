import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { db, makeTag, T_SUGGESTED, TAG_HOME, TAG_WORK } from "../../../tests/msw/db";
import { API, err, ok } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";

const route = `/tasks/${T_SUGGESTED}`;

function recordTagPuts() {
  const puts: unknown[] = [];
  server.use(
    http.put<{ id: string }>(`${API}/tasks/:id/tags`, async ({ params, request }) => {
      const body = (await request.json()) as { tagIds: string[] };
      puts.push(body);
      db.find(params.id)!.tags = db.tags.filter((t) => body.tagIds.includes(t.id));
      return ok(db.detail(params.id));
    }),
  );
  return puts;
}

describe("tags on the task", () => {
  it("adds an existing tag from the popover", async () => {
    const puts = recordTagPuts();
    const { user } = renderApp({ route });
    await user.click(await screen.findByRole("button", { name: "Add tag" }));
    const list = await screen.findByRole("list", { name: "Available tags" });
    expect(within(list).queryByText("work")).toBeNull();
    await user.click(within(list).getByRole("button", { name: "home" }));
    await waitFor(() => expect(puts).toEqual([{ tagIds: [TAG_WORK, TAG_HOME] }]));
    const tags = await screen.findByLabelText("Tags");
    expect(within(tags).getByText("home")).toBeInTheDocument();
  });

  it("adopting an AI tag suggestion creates the tag and replaces the set", async () => {
    const puts = recordTagPuts();
    const posts: unknown[] = [];
    server.use(
      http.post(`${API}/tags`, async ({ request }) => {
        const body = (await request.json()) as { name: string; color: string };
        posts.push(body);
        const tag = makeTag({ id: "tag-9", name: body.name, color: body.color });
        db.tags.push(tag);
        return ok(tag, {}, 201);
      }),
    );
    const { user } = renderApp({ route });
    await user.click(await screen.findByRole("button", { name: "Add tag planning" }));
    await waitFor(() => expect(posts).toEqual([{ name: "planning", color: "#C77D1A" }]));
    await waitFor(() => expect(puts).toEqual([{ tagIds: [TAG_WORK, "tag-9"] }]));
    expect(within(await screen.findByLabelText("Tags")).getByText("planning")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add tag planning" })).toBeNull();
  });

  it("adopting a suggestion that conflicts on create falls back to the newly-existing tag", async () => {
    const puts = recordTagPuts();
    server.use(
      // Simulates a concurrent create landing first: the tag now exists server-side.
      http.post(`${API}/tags`, () => {
        db.tags.push(makeTag({ id: "tag-race", name: "planning", color: "#C77D1A" }));
        return err("CONFLICT", "A tag with this name already exists");
      }),
    );
    const { user } = renderApp({ route });
    await user.click(await screen.findByRole("button", { name: "Add tag planning" }));
    await waitFor(() => expect(puts).toEqual([{ tagIds: [TAG_WORK, "tag-race"] }]));
  });

  it("adopting a suggestion that already exists as a tag skips creation", async () => {
    const puts = recordTagPuts();
    db.tags.push(makeTag({ id: "tag-plan", name: "Planning", color: "#7A3E9D" }));
    let posts = 0;
    server.use(
      http.post(`${API}/tags`, () => {
        posts += 1;
        return err("INTERNAL", "should not be called");
      }),
    );
    const { user } = renderApp({ route });
    await user.click(await screen.findByRole("button", { name: "Add tag planning" }));
    await waitFor(() => expect(puts).toEqual([{ tagIds: [TAG_WORK, "tag-plan"] }]));
    expect(posts).toBe(0);
  });

  it("shows the API error when replacing tags fails", async () => {
    server.use(
      http.put(`${API}/tasks/:id/tags`, () =>
        err("VALIDATION_ERROR", "Invalid request", [
          { path: "body.tagIds", message: "Unknown tag" },
        ]),
      ),
    );
    const { user } = renderApp({ route });
    await user.click(await screen.findByRole("button", { name: "Add tag" }));
    await user.click(
      within(await screen.findByRole("list", { name: "Available tags" })).getByRole("button", {
        name: "home",
      }),
    );
    expect(await screen.findByText("Check the highlighted fields")).toBeInTheDocument();
    expect(screen.getByText("tagIds: Unknown tag")).toBeInTheDocument();
  });
});
