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
    // A long display name truncates rather than pushing "Log out" out of the header.
    expect(screen.getByText("Demo")).toHaveClass("truncate");
    const tasks = screen.getByRole("link", { name: "Tasks" });
    const tags = screen.getByRole("link", { name: "Tags" });
    expect(tasks).toHaveAttribute("href", "/tasks");
    expect(tags).toHaveAttribute("href", "/tags");
    // The current screen is marked by aria-current and a variant, and every nav link has an icon.
    expect(tags).toHaveAttribute("aria-current", "page");
    expect(tasks).not.toHaveAttribute("aria-current");
    expect(tasks.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(tags.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("link", { name: "Request a feature" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("renders a not-found page inside the shell for a signed-in user", async () => {
    renderApp({ route: "/nowhere" });
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to your tasks" })).toHaveAttribute(
      "href",
      "/tasks",
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("renders the not-found page without the shell for an anonymous visitor", async () => {
    renderApp({ route: "/nowhere", session: "anonymous" });
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log out" })).toBeNull();
    expect(screen.getByRole("link", { name: "Go to your tasks" })).toHaveAttribute(
      "href",
      "/tasks",
    );
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});

describe("workshop footer", () => {
  it("shows the workshop credit when signed out at /login", async () => {
    renderApp({ route: "/login", session: "anonymous" });
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      /Created for the NICE product workshop/,
    );
  });

  it("shows the workshop credit when signed in at /tasks", async () => {
    renderApp({ route: "/tasks" });
    expect(await screen.findByRole("heading", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      /Created for the NICE product workshop/,
    );
  });
});
