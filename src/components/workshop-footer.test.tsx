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
    expect(await screen.findByText("api test-sh")).toBeInTheDocument();
    expect(screen.queryByTitle("API and web versions differ")).toBeNull();
  });

  it("turns the API segment amber with the API's version when the versions differ", async () => {
    server.use(http.get(`${API}/health`, () => ok({ ...healthBody(true), version: "0.9.0" })));
    renderApp({ route: "/login", session: "anonymous" });
    expect(await screen.findByTitle("API and web versions differ")).toHaveTextContent(
      "api v0.9.0 test-sh",
    );
  });
});
