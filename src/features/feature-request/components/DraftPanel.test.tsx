import { render, screen, within } from "@testing-library/react";
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

const SCORED = {
  status: "ready" as const,
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
};

describe("DraftPanel", () => {
  it("is a titled card with a chip for every empty field, no score yet, and a hint under the dead button", () => {
    renderPanel(db.openConversation());
    const region = screen.getByRole("region", { name: "Your request" });
    expect(region).toHaveAttribute("data-slot", "card");
    expect(within(region).getByRole("heading", { name: "Your request" })).toBeInTheDocument();
    for (const label of [
      "Title",
      "Problem",
      "Proposed behavior",
      "Acceptance criteria",
      "Out of scope",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    const placeholders = screen.getAllByText("Not filled in yet");
    expect(placeholders).toHaveLength(5);
    for (const chip of placeholders) expect(chip).toHaveAttribute("data-slot", "badge");
    expect(screen.getByText("Readiness not scored yet")).toHaveAttribute("data-slot", "badge");
    const review = screen.getByRole("button", { name: "Review and file" });
    expect(review).toBeDisabled();
    expect(review.querySelector("svg")).not.toBeNull();
    // The dead button says why it is dead.
    expect(screen.getByText("Answer a couple more questions to file.")).toBeInTheDocument();
  });

  it("reveals the sub-scores and their reasons from the readiness chip, and shows the filled fields", async () => {
    const { user } = renderPanel(db.openConversation(SCORED));
    const readiness = screen.getByRole("button", { name: "Readiness 16 of 20" });
    expect(readiness).toHaveAttribute("data-variant", "outline");
    expect(readiness.querySelector("svg")).not.toBeNull();
    // Nothing hides in a hover title: the sub-scores open on click, as chips with their reasons.
    expect(readiness).not.toHaveAttribute("title");
    await user.click(readiness);
    for (const [chip, reason] of [
      ["Clarity 4", "Named"],
      ["Complexity 2", "Small"],
      ["Risk 2", "Low"],
    ]) {
      expect(await screen.findByText(chip)).toHaveAttribute("data-slot", "badge");
      expect(screen.getByText(reason)).toBeInTheDocument();
    }
    expect(screen.getByText("Snooze a task until a date")).toBeInTheDocument();
    expect(screen.getAllByText("Not filled in yet")).toHaveLength(1);
    expect(screen.getByText("Ready to file.")).toBeInTheDocument();
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
    expect(link).toHaveAttribute("data-slot", "button");
    expect(link).toHaveAttribute("data-variant", "link");
    expect(link.querySelector("svg")).not.toBeNull();
    expect(link).toHaveClass("whitespace-normal");
    expect(link).not.toHaveClass("whitespace-nowrap");
  });
});
