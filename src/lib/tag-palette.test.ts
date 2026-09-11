import { describe, expect, it } from "vitest";
import { nextPaletteColor, paletteName, TAG_PALETTE } from "./tag-palette";

describe("tag palette", () => {
  it("has eight distinct hex colors", () => {
    expect(TAG_PALETTE).toHaveLength(8);
    expect(new Set(TAG_PALETTE.map((c) => c.value)).size).toBe(8);
    for (const c of TAG_PALETTE) expect(c.value).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("picks the first unused color, then cycles", () => {
    expect(nextPaletteColor([])).toBe(TAG_PALETTE[0].value);
    expect(nextPaletteColor([{ color: TAG_PALETTE[0].value }])).toBe(TAG_PALETTE[1].value);
    expect(nextPaletteColor(TAG_PALETTE.map((c) => ({ color: c.value })))).toBe(
      TAG_PALETTE[0].value,
    );
  });

  it("names a palette color whatever its case, and shows the hex for one outside the palette", () => {
    expect(paletteName("#2F7D4F")).toBe("Forest");
    expect(paletteName("#2f7d4f")).toBe("Forest");
    expect(paletteName("#123456")).toBe("#123456");
  });
});
