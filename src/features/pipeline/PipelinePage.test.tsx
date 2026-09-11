import { screen } from "@testing-library/react";
import { delay, http } from "msw";
import { describe, expect, it } from "vitest";
import { API, err, healthBody, ok, pipelineSnapshot } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";

describe("pipeline page", () => {
  it("hides the Pipeline link and the page when health reports pipeline false", async () => {
    server.use(http.get(`${API}/health`, () => ok(healthBody({ pipeline: false }))));
    renderApp({ route: "/pipeline" });
    expect(
      await screen.findByText("The pipeline is not available in this environment."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pipeline" })).toBeNull();
    expect(screen.queryByRole("table", { name: "Issues" })).toBeNull();
  });

  it("shows the link when health reports pipeline true and renders the page", async () => {
    const { user } = renderApp({ route: "/tasks" });
    const link = await screen.findByRole("link", { name: "Pipeline" });
    expect(link).toHaveAttribute("href", "/pipeline");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    await user.click(link);
    expect(await screen.findByRole("heading", { name: "Pipeline", level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole("table", { name: "Issues" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How it flows", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Environments", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Issues", level: 2 })).toBeInTheDocument();
  });

  it("shows a loading state with skeletons until the snapshot arrives", async () => {
    server.use(
      http.get(`${API}/pipeline`, async () => {
        await delay(150);
        return ok(pipelineSnapshot());
      }),
    );
    renderApp({ route: "/pipeline" });
    const text = await screen.findByText("Loading pipeline");
    const status = text.closest('[role="status"]');
    expect(status).not.toBeNull();
    expect(status!.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(await screen.findByRole("table", { name: "Issues" })).toBeInTheDocument();
    expect(screen.queryByText("Loading pipeline")).toBeNull();
  });

  it("shows the API error as an alert with the envelope message", async () => {
    server.use(http.get(`${API}/pipeline`, () => err("UPSTREAM_ERROR", "GitHub did not answer")));
    renderApp({ route: "/pipeline" });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("GitHub did not answer");
    expect(screen.queryByRole("table", { name: "Issues" })).toBeNull();
  });

  it("prints the snapshot's age and warns when the API serves its last-good copy", async () => {
    server.use(
      http.get(`${API}/pipeline`, () =>
        ok(pipelineSnapshot({ stale: true, staleReason: "GitHub rate limit, retrying at 11:00" })),
      ),
    );
    renderApp({ route: "/pipeline" });
    expect(await screen.findByText(/^as of \d\d:\d\d:\d\d$/)).toBeInTheDocument();
    expect(screen.getByText("GitHub unreachable")).toHaveAttribute("data-variant", "destructive");
    expect(screen.getByText("GitHub rate limit, retrying at 11:00")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "How it flows" })).toBeInTheDocument();
  });

  it("keeps the snapshot on screen and warns when a refresh fails", async () => {
    const { queryClient } = renderApp({ route: "/pipeline" });
    expect(await screen.findByRole("table", { name: "Issues" })).toBeInTheDocument();
    server.use(http.get(`${API}/pipeline`, () => err("UPSTREAM_ERROR", "GitHub did not answer")));
    await queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not refresh the pipeline");
    expect(alert).toHaveTextContent("GitHub did not answer");
    expect(screen.getByRole("table", { name: "Issues" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Environments", level: 2 })).toBeInTheDocument();
  });

  it("shows the empty state when the snapshot has no issues", async () => {
    server.use(http.get(`${API}/pipeline`, () => ok(pipelineSnapshot({ issues: [] }))));
    renderApp({ route: "/pipeline" });
    expect(await screen.findByText("No requests yet")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Issues" })).toBeNull();
    // The environments still render: the empty state is about the issues, not the page.
    expect(screen.getByRole("heading", { name: "Environments", level: 2 })).toBeInTheDocument();
  });
});
