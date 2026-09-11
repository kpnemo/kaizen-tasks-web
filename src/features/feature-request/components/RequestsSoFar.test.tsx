import { screen, within } from "@testing-library/react";
import { delay, http } from "msw";
import { describe, expect, it } from "vitest";
import {
  API,
  err,
  featureRequestSummary,
  ok,
  setFeatureRequestList,
} from "../../../../tests/msw/handlers";
import { server } from "../../../../tests/msw/server";
import { renderApp } from "../../../../tests/render";

const ROUTE = "/request-feature?mode=form";

describe("Requests so far", () => {
  it("shows requests open first with stage chips, readiness and GitHub links", async () => {
    setFeatureRequestList([
      featureRequestSummary({
        number: 22,
        title: "Show existing requests",
        stage: "implementing",
        readiness: null,
        labels: ["feature-request", "implementing"],
      }),
      featureRequestSummary({ number: 5, title: "Regenerate suggestions with a hint" }),
      featureRequestSummary({
        number: 19,
        title: "Change app accent color",
        state: "closed",
        stage: "shipped",
        readiness: 17,
        labels: ["feature-request", "clarity:4", "complexity:2", "risk:1", "shipped"],
        closedAt: "2026-09-11T07:24:21Z",
      }),
    ]);
    renderApp({ route: ROUTE });
    const section = await screen.findByRole("region", { name: "Requests so far" });
    const rows = await within(section).findAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("#22"),
      expect.stringContaining("#5"),
      expect.stringContaining("#19"),
    ]);
    expect(within(rows[0]).getByText("Implementing")).toBeInTheDocument();
    expect(within(rows[0]).queryByText(/Readiness/)).not.toBeInTheDocument();
    expect(within(rows[1]).getByText("Readiness 16")).toBeInTheDocument();
    expect(within(rows[1]).getByText("clarity 5")).toBeInTheDocument();
    expect(within(rows[1]).getByText("complexity 3")).toBeInTheDocument();
    expect(within(rows[1]).getByText("risk 3")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Shipped")).toBeInTheDocument();
    expect(within(section).getByText("Closed")).toBeInTheDocument();
    const link = within(rows[0]).getByRole("link", { name: "Open #22 on GitHub" });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/kpnemo/kaizen-tasks-assembly-line/issues/22",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("shows the loading, empty and error states without breaking the page", async () => {
    // Hold the first answer so the loading state is observable rather than raced (review note).
    server.use(
      http.get(`${API}/feature-requests`, async () => {
        await delay(150);
        return ok([]);
      }),
    );
    renderApp({ route: ROUTE });
    expect(await screen.findByText("Loading requests")).toHaveAttribute("role", "status");
    expect(await screen.findByText("No requests yet. Yours can be the first.")).toBeInTheDocument();
  });

  it("shows a GitHub failure as an alert while the form still works", async () => {
    server.use(
      http.get(`${API}/feature-requests`, () =>
        err("UPSTREAM_ERROR", "Could not list the GitHub issues"),
      ),
    );
    renderApp({ route: ROUTE });
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not list the GitHub issues");
    expect(screen.getByRole("heading", { name: "Request a feature" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Request a feature" })).toBeInTheDocument();
  });
});
