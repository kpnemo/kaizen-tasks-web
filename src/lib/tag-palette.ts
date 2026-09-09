/** The fixed palette for tags (spec 4.5): eight colors that read on a projector. */
export const TAG_PALETTE = [
  { name: "Indigo", value: "#3B3FBF" },
  { name: "Forest", value: "#2F7D4F" },
  { name: "Amber", value: "#C77D1A" },
  { name: "Plum", value: "#7A3E9D" },
  { name: "Teal", value: "#1F7A8C" },
  { name: "Rust", value: "#B23A48" },
  { name: "Olive", value: "#6B7A2E" },
  { name: "Slate", value: "#4A5568" },
] as const;

export function nextPaletteColor(existing: { color: string }[]): string {
  const used = new Set(existing.map((t) => t.color.toUpperCase()));
  const free = TAG_PALETTE.find((c) => !used.has(c.value));
  return (free ?? TAG_PALETTE[existing.length % TAG_PALETTE.length]).value;
}
