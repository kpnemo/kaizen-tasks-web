import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { authStore } from "@/api/auth-store";
import { API, healthBody, ok } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";

/** The header's account menu: the display name button opens it. */
const trigger = () => screen.getByRole("button", { name: "Demo" });

describe("account menu", () => {
  it("opens from the display name and lists Request a feature, Pipeline, and Log out", async () => {
    const { user } = renderApp({ route: "/tasks" });
    await screen.findByRole("heading", { name: "Tasks" });
    await user.click(trigger());
    expect(await screen.findByRole("menuitem", { name: "Request a feature" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Pipeline" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
  });

  it("hides Request a feature and Pipeline when their flags are off, and always shows Log out", async () => {
    server.use(
      http.get(`${API}/health`, () => ok(healthBody({ featureRequests: false, pipeline: false }))),
    );
    const { user } = renderApp({ route: "/tasks" });
    await screen.findByRole("heading", { name: "Tasks" });
    await user.click(trigger());
    expect(await screen.findByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Request a feature" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Pipeline" })).not.toBeInTheDocument();
  });

  it("navigates to Request a feature from the menu", async () => {
    const { user } = renderApp({ route: "/tasks" });
    await screen.findByRole("heading", { name: "Tasks" });
    await user.click(trigger());
    await user.click(await screen.findByRole("menuitem", { name: "Request a feature" }));
    expect(await screen.findByRole("heading", { name: "Request a feature" })).toBeInTheDocument();
  });

  it("logs out from the menu", async () => {
    let logouts = 0;
    server.use(
      http.post(`${API}/auth/logout`, () => {
        logouts += 1;
        return new Response(null, { status: 204 });
      }),
    );
    const { user } = renderApp({ route: "/tasks" });
    await screen.findByRole("heading", { name: "Tasks" });
    await user.click(trigger());
    await user.click(await screen.findByRole("menuitem", { name: "Log out" }));
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    await waitFor(() => expect(logouts).toBe(1));
    expect(authStore.getState()).toEqual({ status: "anonymous", token: null, user: null });
  });
});
