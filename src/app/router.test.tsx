import { screen } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { API, healthBody, ok } from "../../tests/msw/handlers";
import { server } from "../../tests/msw/server";
import { renderApp } from "../../tests/render";

describe("routing shell", () => {
  it("redirects / to /tasks for a logged-in user", async () => {
    renderApp({ route: "/" });
    expect(await screen.findByRole("heading", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/tasks");
  });

  it("sends an anonymous visitor to /login with returnTo", async () => {
    renderApp({ route: "/tasks/abc?x=1", session: "anonymous" });
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/login?returnTo=%2Ftasks%2Fabc%3Fx%3D1",
    );
  });

  it("sends a logged-in user away from /login to /tasks", async () => {
    renderApp({ route: "/login" });
    expect(await screen.findByRole("heading", { name: "Tasks" })).toBeInTheDocument();
  });

  it("shows the shell with the display name, nav links, and log out", async () => {
    server.use(http.get(`${API}/health`, () => ok(healthBody(false))));
    const { user } = renderApp({ route: "/tags" });
    expect(await screen.findByRole("heading", { name: "Tags" })).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tasks" })).toHaveAttribute("href", "/tasks");
    expect(screen.getByRole("link", { name: "Tags" })).toHaveAttribute("href", "/tags");
    expect(screen.queryByRole("link", { name: "Request a feature" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("renders a not-found page for unknown paths", async () => {
    renderApp({ route: "/nowhere" });
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
