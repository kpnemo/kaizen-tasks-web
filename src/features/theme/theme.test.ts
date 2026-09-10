import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, readStoredTheme, resolveTheme, THEME_STORAGE_KEY } from "./theme";

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

// The per-device cache (ADR 0006): what `applyTheme` writes to `localStorage` and what
// `readStoredTheme` reads back. `tests/setup.ts` stubs `window.matchMedia` to `matches: false`
// globally, so `system` resolves to light here.
describe("theme cache", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
  });

  it("has nothing cached before any theme has been applied", () => {
    expect(readStoredTheme()).toBeNull();
  });

  it("applying a theme caches the preference under kaizen.theme", () => {
    applyTheme("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("caches system as system, not the OS's current answer", () => {
    applyTheme("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(readStoredTheme()).toBe("system");
  });

  it("a later applyTheme call overwrites the earlier cached value", () => {
    applyTheme("light");
    applyTheme("dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("ignores a stored value that is not one of the three choices", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "blue");
    expect(readStoredTheme()).toBeNull();
  });
});
