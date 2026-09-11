import { screen } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { API, healthBody, ok } from "../../tests/msw/handlers";
import { server } from "../../tests/msw/server";
import { renderApp } from "../../tests/render";

describe("workshop footer version line", () => {
  it("prints the web version and 'web ' immediately, before health resolves", () => {
    renderApp({ route: "/login", session: "anonymous" });
    expect(screen.getByText(`v${pkg.version}`)).toBeInTheDocument();
    expect(screen.getByText(/^web /)).toBeInTheDocument();
    expect(screen.queryByText(/^api /)).toBeNull();
  });

  it("shows the API commit, with no mismatch warning, when the versions match", async () => {
    server.use(http.get(`${API}/health`, () => ok(healthBody(true))));
    renderApp({ route: "/login", session: "anonymous" });
    const badge = await screen.findByText("api test-sh");
    expect(badge).toHaveAttribute("data-slot", "badge");
    expect(badge).toHaveAttribute("data-variant", "outline");
    expect(screen.queryByText(/versions differ/)).toBeNull();
  });

  it("marks the API segment as a destructive badge, with the API's version and a visible note, when the versions differ", async () => {
    server.use(http.get(`${API}/health`, () => ok({ ...healthBody(true), version: "0.9.0" })));
    renderApp({ route: "/login", session: "anonymous" });
    const badge = await screen.findByText("api v0.9.0 test-sh");
    expect(badge).toHaveAttribute("data-variant", "destructive");
    // Shape and words carry the warning, not colour alone and not a hover title.
    expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(badge).not.toHaveAttribute("title");
    expect(screen.getByText("web and API versions differ")).toBeInTheDocument();
  });
});
