import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeTag } from "../../tests/msw/db";
import { TagChip, TagSwatch } from "./tag-chip";

const work = makeTag({ id: "tag-1", name: "work", color: "#3B3FBF" });

describe("TagChip", () => {
  it("is an outline Badge carrying the tag's colour as a swatch beside its name", () => {
    render(<TagChip tag={work} />);
    const chip = screen.getByText("work").closest("[data-slot='badge']");
    expect(chip).toHaveAttribute("data-variant", "outline");
    const swatch = chip?.querySelector("[data-slot='tag-swatch']");
    expect(swatch).toHaveAttribute("aria-hidden", "true");
    expect(swatch).toHaveStyle({ backgroundColor: "#3B3FBF" });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("removes through a Button named after the tag", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<TagChip tag={work} onRemove={onRemove} />);
    const remove = screen.getByRole("button", { name: "Remove tag work" });
    expect(remove).toHaveAttribute("data-slot", "button");
    await user.click(remove);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("TagSwatch", () => {
  it("is the one place a tag's colour is painted", () => {
    render(<TagSwatch color="#2F7D4F" data-testid="swatch" />);
    const swatch = screen.getByTestId("swatch");
    expect(swatch).toHaveAttribute("aria-hidden", "true");
    expect(swatch).toHaveStyle({ backgroundColor: "#2F7D4F" });
  });
});
