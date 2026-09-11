import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { authStore } from "@/api/auth-store";
import type { Conversation } from "@/api/models";
import { Toaster } from "@/components/ui/sonner";
import { db } from "../../../../tests/msw/db";
import { demoUser, GREETING } from "../../../../tests/msw/fixtures";
import { API, err } from "../../../../tests/msw/handlers";
import { server } from "../../../../tests/msw/server";
import { makeQueryClient } from "../../../../tests/render";
import { conversationKey, useConversation } from "../hooks";
import { ConversationPanel } from "./ConversationPanel";

/** The panel takes its conversation as a prop, but a turn replaces the cached conversation. The
 *  harness subscribes to the same query the hook writes to, so the panel re-renders with the new
 *  assistant message exactly as the page does. */
function Harness() {
  const conversation = useConversation(true);
  if (!conversation.data) {
    return <p role="status">Loading the conversation</p>;
  }
  return <ConversationPanel conversation={conversation.data} />;
}

function renderPanel(): { user: ReturnType<typeof userEvent.setup>; queryClient: QueryClient } {
  const queryClient = makeQueryClient();
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <Harness />
      <Toaster />
    </QueryClientProvider>,
  );
  return { user, queryClient };
}

describe("ConversationPanel", () => {
  beforeEach(() => {
    authStore.setSession({ token: "test-token", user: demoUser });
  });

  it("shows the greeting, sends an answer, and shows the assistant's chips", async () => {
    db.openConversation();
    const { user } = renderPanel();
    expect(await screen.findByText(GREETING)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kaizen assistant" })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "I want to snooze tasks");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByRole("button", { name: "A team supervisor before a coaching session" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Got it. Who has this problem, and when does it come up?"),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
    expect(screen.getByRole("list", { name: "Conversation" })).toBeInTheDocument();
  });

  it("frames the transcript in a Card with a scroll area, and labels the answer box on screen", async () => {
    db.openConversation();
    renderPanel();
    await screen.findByText(GREETING);
    const heading = screen.getByRole("heading", { name: "Kaizen assistant" });
    expect(heading.closest("[data-slot=card]")).not.toBeNull();
    // The transcript scrolls inside the card, so the chips and the answer box never leave the fold.
    const list = screen.getByRole("list", { name: "Conversation" });
    const area = list.closest("[data-slot=scroll-area]");
    expect(area).not.toBeNull();
    // The room can see that the transcript scrolls: the scrollbar is rendered whether or not the
    // pointer is over it (Radix `type="hover"` would keep it out of the DOM until then). Keyboard
    // reach is the browser's: Chrome and Firefox make a scroller with no focusable children a Tab
    // stop on their own, and the primitive's viewport already carries the focus ring for it.
    const scrollbar = area?.querySelector("[data-slot=scroll-area-scrollbar]");
    expect(scrollbar).not.toBeNull();
    expect(scrollbar).toHaveAttribute("data-state", "visible");
    // A visible label and the keyboard contract as a hint, not a placeholder that disappears.
    const box = screen.getByLabelText("Your answer");
    expect(box).toHaveAttribute("data-slot", "textarea");
    expect(box).not.toHaveAttribute("placeholder");
    expect(screen.getByText("Enter sends, Shift+Enter starts a new line.")).toBeInTheDocument();
    expect(box).toHaveAccessibleDescription("Enter sends, Shift+Enter starts a new line.");
    for (const name of ["Start over", "Send"]) {
      expect(screen.getByRole("button", { name }).querySelector("svg")).not.toBeNull();
    }
  });

  it("sends an option chip's own text", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, async ({ request }) => {
        bodies.push(await request.json());
        return err("UPSTREAM_ERROR", "stop here");
      }),
    );
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
    const { user } = renderPanel();
    await user.click(await screen.findByRole("button", { name: "An agent during a call" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ content: "An agent during a call" });
  });

  it("sends skip: true from the skip chip", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, async ({ request }) => {
        bodies.push(await request.json());
        return err("UPSTREAM_ERROR", "stop here");
      }),
    );
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
    const { user } = renderPanel();
    await user.click(await screen.findByRole("button", { name: "Skip this question" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ content: "(skipped)", skip: true });
  });

  it("hides the skip chip while the greeting is the last message, and shows it once a question is pending", async () => {
    db.openConversation();
    const { user } = renderPanel();
    await screen.findByText(GREETING);
    expect(screen.queryByRole("button", { name: "Skip this question" })).toBeNull();

    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "I want to snooze tasks");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByRole("button", { name: "A team supervisor before a coaching session" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip this question" })).toBeInTheDocument();
  });

  it("sends on Enter and inserts a newline on Shift+Enter", async () => {
    db.openConversation();
    const { user } = renderPanel();
    await screen.findByText(GREETING);
    const box = screen.getByRole("textbox", { name: "Your answer" });
    await user.type(box, "first{Shift>}{Enter}{/Shift}second");
    expect(box).toHaveValue("first\nsecond");
    await user.type(box, "{Enter}");
    expect(
      await screen.findByText("Got it. Who has this problem, and when does it come up?"),
    ).toBeInTheDocument();
  });

  it("keeps the PM's message and the text after a failed turn, and re-enables the input", async () => {
    server.use(
      http.post(`${API}/feature-requests/conversation/:id/messages`, () =>
        err("UPSTREAM_ERROR", "The assistant is unavailable"),
      ),
    );
    db.openConversation();
    const { user } = renderPanel();
    await screen.findByText(GREETING);
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "I want to snooze tasks");
    await user.click(screen.getByRole("button", { name: "Send" }));

    // The toast is the positive evidence that the failure path ran.
    expect(await screen.findByText("The assistant is unavailable")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue(
      "I want to snooze tasks",
    );
    expect(screen.getAllByText("I want to snooze tasks").length).toBeGreaterThan(0);
  });

  it("disables the answer box once the conversation is ready and keeps Start over", async () => {
    db.openConversation({ status: "ready" });
    renderPanel();
    await screen.findByText(GREETING);
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Skip this question" })).toBeNull();
    expect(screen.getByRole("button", { name: "Start over" })).toBeEnabled();
  });

  it("starts a new conversation from Start over", async () => {
    const before = db.openConversation();
    const { user, queryClient } = renderPanel();
    await screen.findByText(GREETING);
    await user.click(screen.getByRole("button", { name: "Start over" }));
    await waitFor(() => {
      const started = queryClient.getQueryData<Conversation>(conversationKey);
      expect(typeof started?.id).toBe("string");
      expect(started?.id).not.toBe(before.id);
    });
  });

  it("lets a long chip wrap instead of forcing a horizontal scrollbar, and shows the skip as a real button", async () => {
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
    renderPanel();
    const skip = await screen.findByRole("button", { name: "Skip this question" });
    const option = screen.getByRole("button", { name: "An agent during a call" });
    for (const chip of [skip, option]) {
      expect(chip).toHaveClass("whitespace-normal");
      expect(chip).not.toHaveClass("whitespace-nowrap");
      expect(chip).toHaveClass("max-w-full");
      expect(chip).toHaveAttribute("data-variant", "outline");
    }
    // The escape hatch is bordered and iconed like its neighbours, not ghost text.
    expect(skip.querySelector("svg")).not.toBeNull();
  });
});
