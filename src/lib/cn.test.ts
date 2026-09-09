import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("merges conditional classes and resolves Tailwind conflicts", () => {
    // eslint-disable-next-line no-constant-binary-expression -- brief's literal example of a falsy conditional class
    expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
  });
});
