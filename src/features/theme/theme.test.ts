import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("resolves an explicit choice regardless of the OS setting", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("resolves system to the OS setting", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
