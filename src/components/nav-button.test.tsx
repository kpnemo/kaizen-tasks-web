import { render, screen } from "@testing-library/react";
import { ListTodo } from "lucide-react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { NavButton } from "./nav-button";

describe("NavButton", () => {
  it("is a link in Button clothes, current on its own route, with the icon in the inline-start slot", () => {
    render(
      <MemoryRouter initialEntries={["/tasks"]}>
        <NavButton to="/tasks" icon={ListTodo}>
          Tasks
        </NavButton>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Tasks" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveAttribute("data-nav");
    const icon = link.querySelector("svg");
    expect(icon).toHaveAttribute("data-icon", "inline-start");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
