import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Two projector rules from docs/ui-conventions.md that live in shared files rather than in any one
// screen: copy a user must read is 18px (`text-base` against the 18px root) and every control has a
// 44px hit area. Vitest runs with `css: false`, so, like tests/accent-tokens.test.ts, these read the
// sources as text: a shadcn primitive re-added with `--overwrite` would silently bring `text-sm` back.

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
      expect(read(page), page).not.toMatch(/<Alert(Description)?[^>]*className="[^"]*text-base/);
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
});
