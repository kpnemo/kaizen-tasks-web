import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Conversation } from "@/api/models";
import { db } from "../../../../tests/msw/db";
import { DraftPanel } from "./DraftPanel";

function renderPanel(conversation: Conversation, onReview = vi.fn()) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <DraftPanel conversation={conversation} onReview={onReview} />
    </MemoryRouter>,
  );
  return { user, onReview };
}

describe("DraftPanel", () => {
  it("shows a placeholder for every empty field and no score yet", () => {
    renderPanel(db.openConversation());
    expect(screen.getByRole("region", { name: "Your request" })).toBeInTheDocument();
    for (const label of [
      "Title",
      "Problem",
      "Proposed behavior",
      "Acceptance criteria",
      "Out of scope",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Not filled in yet")).toHaveLength(5);
    expect(screen.getByText("Readiness not scored yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review and file" })).toBeDisabled();
  });

  it("shows the readiness chip with the sub-scores in its title and the filled fields", () => {
    renderPanel(
      db.openConversation({
        status: "ready",
        draft: {
          title: "Snooze a task until a date",
          problem: "Tasks I cannot act on yet clutter the list.",
          proposedBehavior: "A snooze button hides the task until a date.",
          acceptanceCriteria: "It reappears on the chosen date.",
          outOfScope: "",
        },
        score: {
          clarity: 4,
          complexity: 2,
          risk: 2,
          archChange: false,
          readiness: 16,
          reasons: { clarity: "Named", complexity: "Small", risk: "Low" },
        },
      }),
    );
    expect(screen.getByText("Readiness 16 of 20")).toHaveAttribute(
      "title",
      "Clarity 4 · Complexity 2 · Risk 2",
    );
    expect(screen.getByText("Snooze a task until a date")).toBeInTheDocument();
    expect(screen.getAllByText("Not filled in yet")).toHaveLength(1);
  });

  it("enables Review and file when the conversation is ready", async () => {
    const { user, onReview } = renderPanel(db.openConversation({ status: "ready" }));
    const button = screen.getByRole("button", { name: "Review and file" });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it("enables Review and file after the eighth question even while open", () => {
    renderPanel(db.openConversation({ questionCount: 8 }));
    expect(screen.getByRole("button", { name: "Review and file" })).toBeEnabled();
  });

  it("offers the plain form as a link that carries mode=form and wraps when narrow", () => {
    renderPanel(db.openConversation());
    const link = screen.getByRole("link", { name: "Skip the interview, fill the form" });
    expect(link).toHaveAttribute("href", "/request-feature?mode=form");
    expect(link).toHaveClass("whitespace-normal");
    expect(link).not.toHaveClass("whitespace-nowrap");
    expect(link).toHaveClass("min-h-11");
  });
});
