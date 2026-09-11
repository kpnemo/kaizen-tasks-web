import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlowDiagram } from "./FlowDiagram";

describe("FlowDiagram", () => {
  it("is one labelled image with the eight stations, who runs each, and the two clicks", () => {
    render(<FlowDiagram />);
    expect(screen.getByRole("img", { name: "How it flows" })).toBeInTheDocument();
    for (const station of [
      "Request",
      "Triage",
      "Implement",
      "Pull requests",
      "Develop",
      "Staging",
      "Production",
      "Shipped",
    ]) {
      expect(screen.getByText(station)).toBeInTheDocument();
    }
    for (const actor of [
      "a person",
      "/triage-requests",
      "/implement-issue",
      "reviewers",
      "Railway",
      "staging-label",
      "ship",
      "lifecycle workflow",
    ]) {
      expect(screen.getByText(actor)).toBeInTheDocument();
    }
    expect(screen.getByText("Deploy to staging")).toBeInTheDocument();
    expect(screen.getByText("Deploy to production")).toBeInTheDocument();
  });
});
