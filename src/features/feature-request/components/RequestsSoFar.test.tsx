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

/** The record rows of the table: the header row and the two group rows carry no GitHub link. */
function recordRows(table: HTMLElement) {
  return within(table)
    .getAllByRole("row")
    .filter((row) => within(row).queryByRole("link") !== null);
}

describe("Requests so far", () => {
  it("shows requests as a table, open first, with stage chips, readiness, triage and GitHub links", async () => {
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
    const table = await within(section).findByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((head) => head.textContent),
    ).toEqual(["#", "Request", "Stage", "Readiness", "Triage", "Actions"]);

    const rows = recordRows(table);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("#22"),
      expect.stringContaining("#5"),
      expect.stringContaining("#19"),
    ]);
    // The two groups are named in the table itself, not by a caption between two lists.
    expect(within(table).getByText("Open")).toBeInTheDocument();
    expect(within(table).getByText("Closed")).toBeInTheDocument();

    // A stage is a visible Badge variant with an icon, never ghost text.
    const stage = within(rows[0]).getByText("Implementing");
    expect(stage).toHaveAttribute("data-slot", "badge");
    expect(stage).not.toHaveAttribute("data-variant", "ghost");
    expect(stage.querySelector("svg")).not.toBeNull();
    expect(within(rows[2]).getByText("Shipped")).toHaveAttribute("data-variant", "default");

    // The Readiness column: a dash when triage has not scored it, the score as a chip otherwise.
    const READINESS = 3;
    expect(within(rows[0]).getAllByRole("cell")[READINESS]).toHaveTextContent("—");
    expect(within(rows[0]).getAllByRole("cell")[READINESS]).not.toHaveTextContent(/Readiness/);
    expect(within(rows[1]).getAllByRole("cell")[READINESS]).toHaveTextContent("Readiness 16");
    expect(
      within(rows[1]).getAllByRole("cell")[READINESS].querySelector("[data-slot=badge] svg"),
    ).not.toBeNull();
    for (const score of ["clarity 5", "complexity 3", "risk 3"]) {
      expect(within(rows[1]).getByText(score)).toHaveAttribute("data-variant", "outline");
    }

    const link = within(rows[0]).getByRole("link", { name: "Open #22 on GitHub" });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/kpnemo/kaizen-tasks-assembly-line/issues/22",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(link).toHaveAttribute("data-slot", "button");
    expect(link).toHaveAttribute("data-variant", "outline");
  });

  it("shows the loading skeleton, then the empty state, without breaking the page", async () => {
    // Hold the first answer so the loading state is observable rather than raced (review note).
    server.use(
      http.get(`${API}/feature-requests`, async () => {
        await delay(150);
        return ok([]);
      }),
    );
    renderApp({ route: ROUTE });
    const loading = await screen.findByText("Loading requests");
    const status = loading.closest("[role=status]");
    expect(status).not.toBeNull();
    expect(status?.querySelector("[data-slot=skeleton]")).not.toBeNull();
    const empty = await screen.findByText("No requests yet. Yours can be the first.");
    expect(empty.closest("[data-slot=empty]")).not.toBeNull();
    expect(screen.getByText("No requests")).toBeInTheDocument();
  });

  it("shows a GitHub failure as an alert with a way back, while the form still works", async () => {
    server.use(
      http.get(
        `${API}/feature-requests`,
        () => err("UPSTREAM_ERROR", "Could not list the GitHub issues"),
        { once: true },
      ),
    );
    const { user } = renderApp({ route: ROUTE });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load the requests");
    expect(alert).toHaveTextContent("Could not list the GitHub issues");
    expect(screen.getByRole("heading", { name: "Request a feature" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Request a feature" })).toBeInTheDocument();

    setFeatureRequestList([featureRequestSummary({ number: 7, title: "Back after a retry" })]);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Back after a retry")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
