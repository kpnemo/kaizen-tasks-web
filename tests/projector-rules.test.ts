import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Rules from docs/ui-conventions.md that live in shared files rather than in any one screen: copy a
// user must read is 18px (`text-base` against the 18px root), every control has a 44px hit area, and
// card.tsx stays the CLI's (the Surfaces rule). Vitest runs with `css: false`, so, like
// tests/accent-tokens.test.ts, these read the sources as text: a shadcn primitive re-added with
// `--overwrite` would silently bring `text-sm` back, and a local `asChild` would be lost the same way.

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("projector rules", () => {
  it("keeps the primitives that carry user-read copy at the 18px floor with no call-site override", () => {
    // Alert and Badge are the two primitives whose base scale shadcn ships at text-sm and whose
    // text a user must read (an error message, a status). Their base is raised once, here, so no
    // page passes `className="text-base"` to compensate.
    for (const file of ["src/components/ui/alert.tsx", "src/components/ui/badge.tsx"]) {
      const source = read(file);
      expect(source, file).toContain("text-base");
      expect(source, file).not.toMatch(/\btext-sm\b/);
    }
    for (const page of ["src/features/auth/LoginPage.tsx", "src/features/auth/RegisterPage.tsx"]) {
      expect(read(page), page).not.toMatch(
        /<(Alert|Card)(Description)?[^>]*className="[^"]*text-base/,
      );
    }
  });

  it("gives an anchor dressed as a Button the same 44px hit area as a button", () => {
    // globals.css applies min-height 2.75rem to `button`, the inputs and `a[data-nav]`. A
    // `<Button asChild><Link>` renders an anchor with `data-slot="button"` and no `data-nav`, so
    // the rule has to name it too, or the auth cross links and every link Button fall back to h-9.
    const css = read("src/styles/globals.css");
    const rule = css.match(/\n {2}button[^{]*\{\s*min-height: 2\.75rem;/);
    expect(rule, "the 44px hit-area rule in globals.css").not.toBeNull();
    const selectors = rule![0].split("{")[0];
    expect(selectors).toContain("a[data-nav]");
    expect(selectors).toContain('a[data-slot="button"]');
  });

  it("keeps card.tsx the CLI's, with a contract heading as a real h1 inside CardTitle", () => {
    // The Surfaces rule: card.tsx has no asChild and gets none, because a local Slot would be lost
    // to the next `npx shadcn@latest add card --overwrite`. A heading the selector contract pins
    // is `<CardTitle><h1>…</h1></CardTitle>`, with no className on either: the h1 takes the
    // page-heading type globals.css gives every h1, and CardTitle only places it.
    const card = read("src/components/ui/card.tsx");
    expect(card).not.toContain("asChild");
    expect(card).not.toContain("Slot");
    for (const page of ["src/features/auth/LoginPage.tsx", "src/features/auth/RegisterPage.tsx"]) {
      expect(read(page), page).toMatch(/<CardTitle>\s*<h1>/);
    }
  });
});
