import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "@/components/ui/input";
import { Field } from "./field";

describe("Field", () => {
  it("keeps the hint visible beside the error and describes the control with both", () => {
    render(
      <Field id="password" label="Password" hint="At least 8 characters" error="Too short">
        <Input id="password" aria-invalid />
      </Field>,
    );
    const input = screen.getByLabelText("Password");
    expect(screen.getByText("At least 8 characters")).toHaveAttribute("id", "password-hint");
    const error = screen.getByRole("alert");
    expect(error).toHaveAttribute("id", "password-error");
    expect(error).toHaveTextContent("Too short");
    // The error carries an icon, so red is not the only signal.
    expect(error.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(input).toHaveAccessibleDescription("At least 8 characters Too short");
    expect(screen.getByRole("group")).toHaveAttribute("data-invalid", "true");
  });

  it("merges a caller's own aria-describedby instead of replacing it", () => {
    render(
      <Field id="email" label="Email" hint="Work address">
        <Input id="email" aria-describedby="email-note" />
      </Field>,
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-describedby",
      "email-note email-hint",
    );
  });

  it("renders no alert and no description when there is nothing to say", () => {
    render(
      <Field id="name" label="Name">
        <Input id="name" />
      </Field>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-describedby");
    expect(screen.getByRole("group")).not.toHaveAttribute("data-invalid", "true");
  });
});
