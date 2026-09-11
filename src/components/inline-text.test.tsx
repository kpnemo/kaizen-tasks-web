import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InlineText } from "./inline-text";

describe("InlineText", () => {
  it("renders the value as a heading and edits inline, saving on Enter", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<InlineText as="h1" label="Title" value="Plan the launch" onSave={onSave} />);
    expect(screen.getByRole("heading", { name: "Plan the launch" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Plan the launch" }));
    const input = screen.getByRole("textbox", { name: "Title" });
    expect(input).toHaveValue("Plan the launch");
    await user.clear(input);
    await user.type(input, "Plan the product launch{Enter}");
    expect(onSave).toHaveBeenCalledWith("Plan the product launch");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("saves on blur, cancels on Escape, and ignores unchanged or empty values", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <InlineText label="Title" value="Keep me" onSave={onSave} />
        <button type="button">elsewhere</button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Keep me" }));
    await user.type(screen.getByRole("textbox", { name: "Title" }), " please");
    await user.click(screen.getByRole("button", { name: "elsewhere" }));
    expect(onSave).toHaveBeenCalledWith("Keep me please");

    await user.click(screen.getByRole("button", { name: "Keep me" }));
    await user.type(screen.getByRole("textbox", { name: "Title" }), " again{Escape}");
    expect(onSave).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Keep me" }));
    await user.clear(screen.getByRole("textbox", { name: "Title" }));
    await user.keyboard("{Enter}");
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows a permanent edit mark instead of a hover title, and edits in the shared Input", async () => {
    const user = userEvent.setup();
    render(<InlineText label="Title" value="Plan the launch" onSave={() => {}} />);
    const button = screen.getByRole("button", { name: "Plan the launch" });
    expect(button).not.toHaveAttribute("title");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    await user.click(button);
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveAttribute("data-slot", "input");
  });

  it("edits multiline text in the shared Textarea", async () => {
    const user = userEvent.setup();
    render(<InlineText label="Description" value="Some notes" multiline onSave={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Some notes" }));
    const editor = screen.getByRole("textbox", { name: "Description" });
    expect(editor).toHaveAttribute("data-slot", "textarea");
    expect(editor).toHaveAttribute("rows", "3");
  });

  it("opens in edit mode when controlled", async () => {
    const onSave = vi.fn();
    render(
      <InlineText
        label="Step title"
        value="Draft"
        onSave={onSave}
        editing
        onEditingChange={() => {}}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Step title" })).toHaveValue("Draft");
  });
});
