import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { pipelineSnapshot } from "../../../../tests/msw/handlers";
import { EnvironmentCard } from "./EnvironmentCard";
import { SnapshotAge } from "./SnapshotAge";

const { staging, production } = pipelineSnapshot().environments;

describe("EnvironmentCard", () => {
  it("names the environment and what its API and web serve, with the checks as badges", () => {
    render(<EnvironmentCard name="staging" environment={staging} />);
    expect(screen.getByRole("heading", { name: "Staging", level: 3 })).toBeInTheDocument();
    expect(screen.getAllByText("1.4.0")).toHaveLength(2);
    expect(screen.getByText("c4ec3f4")).toBeInTheDocument();
    expect(screen.getByText("e9b52c8")).toBeInTheDocument();
    expect(screen.getByText("db ok")).toHaveAttribute("data-slot", "badge");
    expect(screen.getByText("redis ok")).toHaveAttribute("data-slot", "badge");
    const state = screen.getByText("serving develop's head");
    expect(state).toHaveAttribute("data-slot", "badge");
    expect(state).not.toHaveAttribute("data-variant", "destructive");
  });

  it("says production serves main", () => {
    render(<EnvironmentCard name="production" environment={production} />);
    expect(screen.getByRole("heading", { name: "Production", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("serving main's head")).toHaveAttribute("data-slot", "badge");
  });

  it("shows deploying while the served commit is behind the branch head", () => {
    render(<EnvironmentCard name="staging" environment={{ ...staging, state: "deploying" }} />);
    const state = screen.getByText("deploying");
    expect(state).toHaveAttribute("data-slot", "badge");
    expect(state).not.toHaveAttribute("data-variant", "destructive");
  });

  it("shows unreachable as a destructive badge and names the half that did not answer", () => {
    render(
      <EnvironmentCard
        name="production"
        environment={{ api: null, web: production.web, state: "unreachable" }}
      />,
    );
    expect(screen.getByText("unreachable")).toHaveAttribute("data-variant", "destructive");
    expect(screen.getByText("did not answer")).toBeInTheDocument();
    expect(screen.getByText("33272c5")).toBeInTheDocument();
    expect(screen.queryByText("db ok")).toBeNull();
  });

  it("marks a failed check as destructive", () => {
    render(
      <EnvironmentCard
        name="staging"
        environment={{ ...staging, api: { ...staging.api!, redis: "failed" } }}
      />,
    );
    expect(screen.getByText("redis failed")).toHaveAttribute("data-variant", "destructive");
    expect(screen.getByText("db ok")).not.toHaveAttribute("data-variant", "destructive");
  });
});

describe("SnapshotAge", () => {
  it("prints when the snapshot was generated", () => {
    render(<SnapshotAge generatedAt="2026-09-11T10:42:07.000Z" stale={false} />);
    expect(screen.getByText(/^as of \d\d:\d\d:\d\d$/)).toBeInTheDocument();
    expect(screen.queryByText("GitHub unreachable")).toBeNull();
  });

  it("warns when the API is serving its last-good snapshot", () => {
    render(
      <SnapshotAge
        generatedAt="2026-09-11T10:42:07.000Z"
        stale
        staleReason="GitHub rate limit, retrying at 11:00"
      />,
    );
    expect(screen.getByText(/^as of \d\d:\d\d:\d\d$/)).toBeInTheDocument();
    expect(screen.getByText("GitHub unreachable")).toHaveAttribute("data-variant", "destructive");
    expect(screen.getByText("GitHub rate limit, retrying at 11:00")).toBeInTheDocument();
  });
});
