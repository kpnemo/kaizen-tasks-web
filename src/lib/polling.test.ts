import { describe, expect, it } from "vitest";
import { activeAiInterval, isAiActive, LIST_POLL_MS } from "./polling";

describe("polling", () => {
  it("treats pending and running as active", () => {
    expect(isAiActive({ aiStatus: "pending" })).toBe(true);
    expect(isAiActive({ aiStatus: "running" })).toBe(true);
    expect(isAiActive({ aiStatus: "done" })).toBe(false);
    expect(isAiActive(undefined)).toBe(false);
  });

  it("returns the interval while any task is active and false otherwise", () => {
    expect(activeAiInterval({ aiStatus: "running" }, 2000)).toBe(2000);
    expect(activeAiInterval({ aiStatus: "failed" }, 2000)).toBe(false);
    expect(activeAiInterval([{ aiStatus: "done" }, { aiStatus: "pending" }], LIST_POLL_MS)).toBe(
      3000,
    );
    expect(activeAiInterval([{ aiStatus: "done" }, { aiStatus: "skipped" }], LIST_POLL_MS)).toBe(
      false,
    );
    expect(activeAiInterval(undefined, LIST_POLL_MS)).toBe(false);
  });
});
