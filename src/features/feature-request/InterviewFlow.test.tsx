import { screen, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { Conversation, FeatureRequestBody } from "@/api/models";
import { db } from "../../../tests/msw/db";
import { GREETING } from "../../../tests/msw/fixtures";
import { API, err, ok } from "../../../tests/msw/handlers";
import { server } from "../../../tests/msw/server";
import { renderApp } from "../../../tests/render";

const READY = {
  status: "ready" as const,
  draft: {
    title: "Snooze a task until a date",
    problem: "Tasks I cannot act on yet clutter the list.",
    proposedBehavior: "A snooze button hides the task until a date.",
    acceptanceCriteria: "It reappears on the chosen date.",
    outOfScope: "Recurring snoozes.",
  },
  score: {
    clarity: 4,
    complexity: 2,
    risk: 2,
    archChange: false,
    readiness: 15,
    reasons: { clarity: "Named", complexity: "Small", risk: "Low" },
  },
};

/** Records every filed body and answers 201 like the real route. */
function captureFiling(bodies: FeatureRequestBody[]) {
  server.use(
    http.post(`${API}/feature-requests`, async ({ request }) => {
      const body = (await request.json()) as FeatureRequestBody;
      bodies.push(body);
      const conversation = db.conversation;
      if (body.conversationId && conversation && conversation.id === body.conversationId) {
        db.conversation = { ...conversation, status: "filed", issueNumber: 42 };
      }
      return HttpResponse.json(
        {
          data: {
            issueNumber: 42,
            issueUrl: "https://github.com/kpnemo/kaizen-tasks-assembly-line/issues/42",
          },
          meta: { requestId: "req-test" },
        },
        { status: 201 },
      );
    }),
  );
}

/** Waits for the answer box to be usable, types, and sends. */
async function answer(user: UserEvent, text: string) {
  const box = await screen.findByRole("textbox", { name: "Your answer" });
  await waitFor(() => expect(box).toBeEnabled());
  await user.type(box, text);
  await user.click(screen.getByRole("button", { name: "Send" }));
}

describe("the feature-request interview", () => {
  it("starts a conversation on the first visit and shows the greeting", async () => {
    renderApp({ route: "/request-feature" });
    expect(await screen.findByText(GREETING)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kaizen assistant" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Your request" })).toBeInTheDocument();
    expect(screen.getAllByText("Not filled in yet")).toHaveLength(5);
    await waitFor(() => expect(db.conversation?.status).toBe("open"));
  });

  it("resumes the open conversation instead of starting a new one", async () => {
    const conversation = db.openConversation({ questionCount: 1 });
    renderApp({ route: "/request-feature" });
    expect(await screen.findByText(GREETING)).toBeInTheDocument();
    expect(db.conversation?.id).toBe(conversation.id);
  });

  it("toasts a failed start and reaches the greeting from Try again", async () => {
    server.use(
      http.post(
        `${API}/feature-requests/conversation`,
        () => err("UPSTREAM_ERROR", "Could not start the interview"),
        { once: true },
      ),
    );
    const { user } = renderApp({ route: "/request-feature" });
    expect(await screen.findByText("Could not start the interview")).toBeInTheDocument();
    // The way back is framed as an Alert with both exits side by side, not a grey paragraph.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The interview could not be started",
    );
    expect(screen.getByRole("link", { name: "Skip the interview, fill the form" })).toHaveAttribute(
      "href",
      "/request-feature?mode=form",
    );
    const retry = screen.getByRole("button", { name: "Try again" });
    expect(retry.querySelector("svg")).not.toBeNull();
    await user.click(retry);
    expect(await screen.findByText(GREETING)).toBeInTheDocument();
    expect(db.conversation?.status).toBe("open");
  });

  it("waits for the retried read before auto-starting, so a slow GET cannot create a second conversation (regression, review finding 1)", async () => {
    server.use(
      http.post(
        `${API}/feature-requests/conversation`,
        () => err("UPSTREAM_ERROR", "Could not start the interview"),
        { once: true },
      ),
    );
    const { user } = renderApp({ route: "/request-feature" });
    expect(await screen.findByText("Could not start the interview")).toBeInTheDocument();

    // Count only the POSTs made from here on: the legitimate retry, and any premature duplicate
    // the bug would cause.
    let posts = 0;
    server.use(
      http.post(`${API}/feature-requests/conversation`, () => {
        posts += 1;
        return ok(db.startConversation(), {}, 201);
      }),
    );

    // The retried GET answers only after release(), the way the file's other gated handlers delay
    // an in-flight response (see "abandons the turn..." below).
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    server.use(
      http.get(`${API}/feature-requests/conversation`, async () => {
        await gate;
        return err("NOT_FOUND", "No open conversation");
      }),
    );

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    // While the retried GET is still in flight, the guard must not let a new POST through.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(posts).toBe(0);

    release();
    expect(await screen.findByText(GREETING)).toBeInTheDocument();
    expect(posts).toBe(1);
  });

  it("toasts a failed read of the open conversation and recovers from Try again", async () => {
    server.use(
      http.get(
        `${API}/feature-requests/conversation`,
        () => err("INTERNAL", "The conversation could not be read"),
        { once: true },
      ),
    );
    const { user } = renderApp({ route: "/request-feature" });
    expect(await screen.findByText("The conversation could not be read")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText(GREETING)).toBeInTheDocument();
  });

  it("streams the reply, then shows the chips and the growing draft", async () => {
    db.openConversation();
    const { user } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);
    await answer(user, "I want to snooze tasks");

    expect(
      await screen.findByRole("button", { name: "A team supervisor before a coaching session" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Got it. Who has this problem, and when does it come up?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Snooze a task until a date")).toBeInTheDocument();
    expect(screen.getAllByText("Not filled in yet")).toHaveLength(4);
  });

  it("sends a skip and counts it as an answered question", async () => {
    db.openConversation({
      questionCount: 1,
      messages: [
        {
          id: "m-1",
          role: "assistant",
          content: "Who has this problem?",
          at: "2026-09-01T09:00:00.000Z",
          options: ["An agent during a call"],
        },
      ],
    });
    const { user } = renderApp({ route: "/request-feature" });
    await user.click(await screen.findByRole("button", { name: "Skip this question" }));
    await waitFor(() => expect(db.conversation?.questionCount).toBe(2));
    expect(db.conversation?.messages.some((m) => m.skipped === true)).toBe(true);
    expect(db.conversation?.messages.at(-2)?.content).toBe("(skipped)");
  });

  it("opens the prefilled form from Review and file and files with the conversation id", async () => {
    const conversation = db.openConversation(READY);
    const bodies: FeatureRequestBody[] = [];
    captureFiling(bodies);
    const { user } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);
    expect(screen.getByText("Readiness 15 of 20")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review and file" }));

    expect(await screen.findByRole("form", { name: "Request a feature" })).toBeInTheDocument();
    // Two chips: the provenance and the score, not one bold sentence.
    expect(screen.getByText("Refined with the assistant")).toHaveAttribute("data-slot", "badge");
    expect(screen.getByText("Readiness 15 of 20")).toHaveAttribute("data-slot", "badge");
    expect(screen.getByLabelText("Title")).toHaveValue("Snooze a task until a date");
    expect(screen.getByLabelText("Acceptance criteria")).toHaveValue(
      "It reappears on the chosen date.",
    );

    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("heading", { name: "Request #42 filed" })).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
    expect(bodies[0].conversationId).toBe(conversation.id);
    expect(bodies[0].title).toBe("Snooze a task until a date");
  });

  it("goes back to the interview from review mode without losing the conversation (review finding 3)", async () => {
    const conversation = db.openConversation(READY);
    const { user } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);
    await user.click(screen.getByRole("button", { name: "Review and file" }));
    expect(await screen.findByRole("form", { name: "Request a feature" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to the interview" }));

    expect(await screen.findByRole("heading", { name: "Kaizen assistant" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Your request" })).toBeInTheDocument();
    expect(screen.getByText(GREETING)).toBeInTheDocument();
    expect(screen.getByText("Readiness 15 of 20")).toBeInTheDocument();
    expect(db.conversation?.id).toBe(conversation.id);
    expect(db.conversation?.status).toBe("ready");
  });

  it("interviews to readiness, files, and starts fresh afterwards", async () => {
    db.openConversation();
    const bodies: FeatureRequestBody[] = [];
    captureFiling(bodies);
    const { user } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);

    await answer(user, "A supervisor before a coaching session");
    await screen.findByText("Got it. Who has this problem, and when does it come up?");
    await answer(user, "A snooze control on each task");
    await screen.findByText("Thanks. What would you see on screen that you cannot see today?");
    await answer(user, "It reappears on the chosen date");
    await screen.findByText("Good. Name one thing you could check to say this works.");
    await answer(user, "That is everything");
    expect(
      await screen.findByText("That is enough to file. The request reads as ready."),
    ).toBeInTheDocument();

    expect(await screen.findByText("Readiness 16 of 20")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeDisabled();
    const filedId = db.conversation?.id;

    await user.click(screen.getByRole("button", { name: "Review and file" }));
    expect(await screen.findByRole("form", { name: "Request a feature" })).toBeInTheDocument();
    expect(screen.getByText("Refined with the assistant")).toBeInTheDocument();
    expect(screen.getByText("Readiness 16 of 20")).toHaveAttribute("data-slot", "badge");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("heading", { name: "Request #42 filed" })).toBeInTheDocument();
    expect(bodies[0].conversationId).toBe(filedId);
    expect(db.conversation?.status).toBe("filed");

    // The next visit starts a new interview from the greeting (spec 2, "Review and file").
    await user.click(screen.getByRole("button", { name: "File another" }));
    expect(await screen.findByText(GREETING)).toBeInTheDocument();
    await waitFor(() => expect(db.conversation?.status).toBe("open"));
    expect(db.conversation?.id).not.toBe(filedId);
    expect(db.conversation?.messages).toHaveLength(1);
  });

  it("shows the plain form with no conversation id from the skip link", async () => {
    db.openConversation();
    const bodies: FeatureRequestBody[] = [];
    captureFiling(bodies);
    const { user } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);
    await user.click(screen.getByRole("link", { name: "Skip the interview, fill the form" }));

    expect(await screen.findByRole("form", { name: "Request a feature" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your request" })).toBeNull();
    expect(screen.getByLabelText("Title")).toHaveValue("");

    await user.type(screen.getByLabelText("Title"), "Snooze a task until Monday");
    await user.type(screen.getByLabelText("Problem"), "Tasks clutter the list.");
    await user.type(screen.getByLabelText("Proposed behavior"), "A snooze button.");
    await user.type(screen.getByLabelText("Acceptance criteria"), "It comes back on the date.");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0].conversationId).toBeUndefined();
  });

  it("shows a rate limit as a toast and leaves the input usable", async () => {
    db.openConversation();
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, () =>
        err("RATE_LIMITED", "Hourly limit reached", {
          scope: "user",
          limit: 60,
          resetAt: "2026-09-10T12:00:00.000Z",
        }),
      ),
    );
    const { user } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);
    await answer(user, "I want to snooze tasks");

    expect(await screen.findByText("Your hourly limit is reached")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue(
      "I want to snooze tasks",
    );
    expect(screen.getAllByText("I want to snooze tasks").length).toBeGreaterThan(1);
  });

  it("shows the stream's own error as a toast and keeps the transcript", async () => {
    db.openConversation();
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('event: delta\ndata: {"text":"Got"}\n\n'));
            controller.enqueue(
              encoder.encode(
                'event: error\ndata: {"code":"UPSTREAM_ERROR","message":"The assistant did not answer"}\n\n',
              ),
            );
            controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
            controller.close();
          },
        });
        return new HttpResponse(body, {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        });
      }),
    );
    const { user } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);
    await answer(user, "I want to snooze tasks");

    expect(await screen.findByText("The assistant did not answer")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeEnabled();
  });

  it("abandons the turn when the PM leaves mid-stream: no toast, no cache write", async () => {
    const conversation = db.openConversation();
    const answered: Conversation = { ...conversation, questionCount: 1 };
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            controller.enqueue(encoder.encode('event: delta\ndata: {"text":"Got it. "}\n\n'));
            await gate;
            controller.enqueue(
              encoder.encode(
                `event: state\ndata: ${JSON.stringify({ conversation: answered })}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
            controller.close();
          },
        });
        return new HttpResponse(body, {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        });
      }),
    );

    const { user, queryClient } = renderApp({ route: "/request-feature" });
    await screen.findByText(GREETING);
    await answer(user, "I want to snooze tasks");
    // Positive evidence that the stream was open before the PM walked away.
    expect(await screen.findByText("Got it.")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Tasks" }));
    await screen.findByRole("heading", { name: "Tasks" });
    release();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(
      queryClient.getQueryData<Conversation>(["feature-request", "conversation"])?.questionCount,
    ).toBe(0);
    // sonner marks each rendered toast with data-sonner-toast; the abort must not raise one.
    expect(document.querySelectorAll("[data-sonner-toast]")).toHaveLength(0);
  });

  it("keeps the two panels in one column and lets the grid shrink below 900px", async () => {
    db.openConversation();
    renderApp({ route: "/request-feature" });
    const grid = (await screen.findByRole("region", { name: "Your request" })).parentElement;
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-1");
    expect(grid?.className).toContain("min-[900px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]");
  });
});
