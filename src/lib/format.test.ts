import { describe, expect, it } from "vitest";
import { formatTime, pluralize, skipReasonLabel } from "./format";

describe("format", () => {
  it("labels every skip reason in words", () => {
    expect(skipReasonLabel("too_short")).toBe("Too short to break down");
    expect(skipReasonLabel("rate_limited")).toBe("Hourly limit reached");
    expect(skipReasonLabel("ai_disabled")).toBe("Assistant paused");
    expect(skipReasonLabel(null)).toBe("Skipped");
  });

  it("formats a reset time and survives garbage", () => {
    expect(formatTime("2026-09-22T10:30:00.000Z")).toMatch(/\d{1,2}:\d{2}/);
    expect(formatTime("garbage")).toBe("garbage");
  });

  it("pluralizes", () => {
    expect(pluralize(1, "suggestion")).toBe("1 suggestion");
    expect(pluralize(3, "suggestion")).toBe("3 suggestions");
  });
});
