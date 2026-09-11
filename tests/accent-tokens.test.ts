import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The accent is one CSS variable, `--brand`, and every accent token derives from it (issue #19).
// Vitest runs with `css: false`, so these assertions read the source files as text, the way
// tests/product-map.test.ts reads router.tsx.

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const css = read("src/styles/globals.css");

/** The declarations inside the top-level `<selector> {` block. Neither block nests braces. */
function block(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`no ${selector} block in globals.css`);
  const open = css.indexOf("{", start);
  return css.slice(open + 1, css.indexOf("}", open));
}

function token(selector: string, name: string): string {
  const match = block(selector).match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`no --${name} in ${selector}`);
  return match[1].trim();
}

/** oklch → sRGB hex, the same conversion Lightning CSS applies when it lowers the literal. */
function oklchToHex(L: number, C: number, h: number): string {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channel = (x: number) => {
    const clamped = Math.max(0, Math.min(1, x));
    const gamma = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(gamma * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return (
    "#" +
    channel(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) +
    channel(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) +
    channel(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  );
}

const ACCENT_TOKENS = ["primary", "accent", "accent-foreground", "ring"];
const DERIVED = /^(var\(--brand\)|oklch\(from var\(--brand\) [\d.]+ calc\(c \* [\d.]+\) h\))$/;

describe("accent tokens", () => {
  it("declares the brand accent once, as oxblood", () => {
    expect(token(":root", "brand")).toBe("oklch(0.42 0.13 30)");
    expect(css.match(/--brand:/g)).toHaveLength(1);
  });

  it("derives every accent token in both themes from the brand", () => {
    for (const name of ACCENT_TOKENS) {
      expect(token(":root", name), `:root --${name}`).toMatch(DERIVED);
      expect(token(".dark", name), `.dark --${name}`).toMatch(DERIVED);
    }
    expect(token(".dark", "primary-foreground")).toMatch(DERIVED);
    expect(token(":root", "primary-foreground")).toBe("oklch(0.99 0 0)");
  });

  it("keeps the indigo hue out of the accent and leaves the neutrals and the destructive red alone", () => {
    for (const selector of [":root", ".dark"]) {
      for (const name of [...ACCENT_TOKENS, "primary-foreground"]) {
        expect(token(selector, name), `${selector} --${name}`).not.toMatch(/ 272\)/);
      }
    }
    expect(token(":root", "background")).toBe("oklch(0.985 0.005 95)");
    expect(token(":root", "foreground")).toBe("oklch(0.2 0.02 270)");
    expect(token(".dark", "background")).toBe("oklch(0.19 0.02 270)");
    expect(token(":root", "destructive")).toBe("oklch(0.55 0.2 27)");
    expect(token(".dark", "destructive")).toBe("oklch(0.68 0.19 27)");
  });

  it("paints the primary button, the checked checkbox, links and the focus ring with the tokens", () => {
    const button = read("src/components/ui/button.tsx");
    expect(button).toMatch(/default: "bg-primary text-primary-foreground/);
    expect(button).toMatch(/link: "text-primary/);
    expect(read("src/components/ui/checkbox.tsx")).toContain("data-[state=checked]:bg-primary");
    expect(css).toMatch(/:focus-visible \{\s*outline: 3px solid var\(--ring\);/);
    // The 404's and the task detail's ways back are Buttons (painted through button.tsx above),
    // not text links, and the auth screens' cross links are link Buttons, painted by the link
    // variant above.
    for (const page of ["src/features/auth/LoginPage.tsx", "src/features/auth/RegisterPage.tsx"]) {
      expect(read(page), page).toContain('variant="link"');
    }
  });

  it("hard-codes no blue anywhere under src", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|css|html)$/.test(entry)) files.push(path);
      }
    };
    walk(join(ROOT, "src"));
    files.push(join(ROOT, "index.html"));
    const skipped = [join(ROOT, "src/api/"), join(ROOT, "src/lib/tag-palette")];
    for (const file of files) {
      if (skipped.some((prefix) => file.startsWith(prefix))) continue;
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/\b(blue|indigo|sky)-\d{2,3}\b/);
      expect(text.toLowerCase().includes("#4744b8"), `${file} carries the old indigo hex`).toBe(
        false,
      );
    }
  });

  it("carries the brand as hex in the browser theme-color and the favicon", () => {
    const match = token(":root", "brand").match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/);
    if (!match) throw new Error("--brand is not a literal oklch(L C h)");
    const hex = oklchToHex(Number(match[1]), Number(match[2]), Number(match[3]));
    expect(hex).toBe("#86281d");
    expect(read("index.html")).toContain(`<meta name="theme-color" content="${hex}" />`);
    expect(read("public/favicon.svg")).toContain(`fill="${hex}"`);
  });
});
