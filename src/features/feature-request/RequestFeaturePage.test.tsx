import { screen, waitFor, within } from "@testing-library/react";
import { delay, http } from "msw";
import { describe, expect, it } from "vitest";
import { API, err, featureRequestSummary, healthBody, ok } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";

function fill(user: ReturnType<typeof renderApp>["user"]) {
  return (async () => {
    await user.type(screen.getByLabelText("Title"), "Snooze a task until Monday");
    await user.type(
      screen.getByLabelText("Problem"),
      "Tasks I cannot act on yet clutter the list.",
    );
    await user.type(
      screen.getByLabelText("Proposed behavior"),
      "A snooze button hides the task until a date.",
    );
    await user.type(
      screen.getByLabelText("Acceptance criteria"),
      "Snoozed tasks reappear on the chosen date.",
    );
    await user.type(screen.getByLabelText("Out of scope"), "Recurring snoozes.");
  })();
}

describe("request a feature", () => {
  it("hides the nav link and the form when health reports featureRequests false", async () => {
    server.use(http.get(`${API}/health`, () => ok(healthBody(false))));
    renderApp({ route: "/request-feature" });
    const sentence = await screen.findByText(
      "Feature requests are not available in this environment.",
    );
    // A deliberate state with a frame and an icon, not a page that failed to render.
    const alert = sentence.closest("[data-slot=alert]");
    expect(alert).not.toBeNull();
    expect(alert).toHaveAttribute("role", "status");
    expect(alert?.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Request a feature" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Request a feature" })).toBeNull();
    expect(screen.queryByRole("form", { name: "Request a feature" })).toBeNull();
  });

  it("treats a failing health check as unavailable", async () => {
    server.use(http.get(`${API}/health`, () => err("UNAVAILABLE", "redis check failed")));
    renderApp({ route: "/request-feature" });
    expect(
      await screen.findByText("Feature requests are not available in this environment."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Request a feature" })).toBeNull();
  });

  it("shows the link when health reports featureRequests true and files the request", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/feature-requests`, async ({ request }) => {
        bodies.push(await request.json());
        return ok(
          {
            issueNumber: 42,
            issueUrl: "https://github.com/kpnemo/kaizen-tasks-assembly-line/issues/42",
          },
          {},
          201,
        );
      }),
    );
    const { user } = renderApp({ route: "/tasks" });
    await user.click(await screen.findByRole("button", { name: "Demo" }));
    await user.click(await screen.findByRole("menuitem", { name: "Request a feature" }));
    expect(await screen.findByRole("heading", { name: "Request a feature" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Skip the interview, fill the form" }));
    await screen.findByRole("form", { name: "Request a feature" });
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));
    const filed = await screen.findByRole("heading", { name: "Request #42 filed" });
    const card = filed.closest("[data-slot=card]");
    expect(card).not.toBeNull();
    const openIssue = within(card as HTMLElement).getByRole("link", { name: "Open the issue" });
    expect(openIssue).toHaveAttribute(
      "href",
      "https://github.com/kpnemo/kaizen-tasks-assembly-line/issues/42",
    );
    expect(openIssue).toHaveAttribute("target", "_blank");
    expect(openIssue).toHaveAttribute("data-slot", "button");
    expect(openIssue.querySelector("svg")).not.toBeNull();
    const another = within(card as HTMLElement).getByRole("button", { name: "File another" });
    expect(another).toHaveAttribute("data-variant", "outline");
    expect(another.querySelector("svg")).not.toBeNull();
    expect(bodies).toEqual([
      {
        title: "Snooze a task until Monday",
        problem: "Tasks I cannot act on yet clutter the list.",
        proposedBehavior: "A snooze button hides the task until a date.",
        acceptanceCriteria: "Snoozed tasks reappear on the chosen date.",
        outOfScope: "Recurring snoozes.",
      },
    ]);
  });

  it("refreshes the requests list after filing", async () => {
    let listCalls = 0;
    server.use(
      http.get(`${API}/feature-requests`, () => {
        listCalls += 1;
        return ok(
          listCalls === 1
            ? []
            : [
                featureRequestSummary({
                  number: 42,
                  title: "Snooze a task until Monday",
                  stage: "new",
                  readiness: null,
                  labels: ["feature-request"],
                }),
              ],
        );
      }),
    );
    const { user } = renderApp({ route: "/request-feature?mode=form" });
    expect(await screen.findByText("No requests yet. Yours can be the first.")).toBeInTheDocument();
    await screen.findByRole("form", { name: "Request a feature" });
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Request #42 filed" })).toBeInTheDocument();
    expect(await screen.findByText("#42")).toBeInTheDocument();
    expect(screen.getByText("Snooze a task until Monday")).toBeInTheDocument();
    expect(listCalls).toBeGreaterThanOrEqual(2);
  });

  it("maps VALIDATION_ERROR onto the field", async () => {
    server.use(
      http.post(`${API}/feature-requests`, () =>
        err("VALIDATION_ERROR", "Invalid request", [
          { path: "body.title", message: "Title is too long" },
        ]),
      ),
    );
    const { user } = renderApp({ route: "/request-feature?mode=form" });
    await screen.findByRole("form", { name: "Request a feature" });
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Title is too long");
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows an upstream failure as a toast with the request id", async () => {
    server.use(
      http.post(`${API}/feature-requests`, () =>
        err("UPSTREAM_ERROR", "GitHub rejected the issue"),
      ),
    );
    const { user } = renderApp({ route: "/request-feature?mode=form" });
    await screen.findByRole("form", { name: "Request a feature" });
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));
    // The toast fades; the Alert above the submit button stays until the next attempt.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Nothing was filed");
    expect(alert).toHaveTextContent("GitHub rejected the issue");
    expect(alert).toHaveAttribute("data-slot", "alert");
    expect(screen.getByText("Request req-test")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled());
  });

  it("shows a spinner on Send request while GitHub answers, keeping the button's name", async () => {
    server.use(
      http.post(`${API}/feature-requests`, async () => {
        await delay(200);
        return ok(
          {
            issueNumber: 43,
            issueUrl: "https://github.com/kpnemo/kaizen-tasks-assembly-line/issues/43",
          },
          {},
          201,
        );
      }),
    );
    const { user } = renderApp({ route: "/request-feature?mode=form" });
    await screen.findByRole("form", { name: "Request a feature" });
    await fill(user);
    const send = screen.getByRole("button", { name: "Send request" });
    expect(send.querySelector("svg")).not.toBeNull();
    await user.click(send);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled(),
    );
    expect(
      screen.getByRole("button", { name: "Send request" }).querySelector("svg.animate-spin"),
    ).not.toBeNull();
    expect(await screen.findByRole("heading", { name: "Request #43 filed" })).toBeInTheDocument();
  });

  it("reads health once per session", async () => {
    let probes = 0;
    server.use(
      http.get(`${API}/health`, () => {
        probes += 1;
        return ok(healthBody(true));
      }),
    );
    const { user } = renderApp({ route: "/tasks" });
    await user.click(await screen.findByRole("button", { name: "Demo" }));
    await screen.findByRole("menuitem", { name: "Request a feature" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await user.click(screen.getByRole("link", { name: "Tags" }));
    await screen.findByRole("heading", { name: "Tags" });
    await user.click(screen.getByRole("link", { name: "Tasks" }));
    await screen.findByRole("heading", { name: "Tasks" });
    expect(probes).toBe(1);
  });
});
