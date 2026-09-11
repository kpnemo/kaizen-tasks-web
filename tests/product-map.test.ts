import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tmpDirs: string[] = [];
const MARKER = "<!-- product-map:generated -->";
const MAP = "docs/product-map.md";

function makeRoot(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "kaizen-product-map-"));
  tmpDirs.push(dir);
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(join(dir, dirname(file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
  return dir;
}

/** Runs the generator from the repo root (as npm and docs-check do) against a scratch tree. */
function generate(root: string, extra: string[] = []) {
  const out = join(root, "generated.md");
  const result = spawnSync(
    "node",
    ["scripts/product-map.mjs", "--root", root, "--out", out, ...extra],
    {
      encoding: "utf8",
    },
  );
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    text: existsSync(out) ? readFileSync(out, "utf8") : "",
  };
}

/** A table row as trimmed cells, so the assertions do not depend on Prettier's column padding. */
function row(text: string, firstCell: string): string[] | undefined {
  return text
    .split("\n")
    .filter((line) => line.trimStart().startsWith("|"))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    )
    .find((cells) => cells[0] === firstCell);
}

/** 1-based line of the first line containing `needle`, so exit-1 assertions do not hard-code it. */
function lineOf(source: string, needle: string): number {
  return source.split("\n").findIndex((line) => line.includes(needle)) + 1;
}

const FIXTURE_ROUTER = `import { Navigate, Route, Routes } from "react-router";
import { ThingPage } from "@/features/thing/ThingPage";
import { NestedPage } from "./NestedPage";
import { AppShell } from "./layout";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/things" element={<ThingPage />} />
        <Route path="/things/:id" element={<NestedPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/things" replace />} />
      <Route path="*" element={<NestedPage />} />
    </Routes>
  );
}
`;

// Aliased Route and Navigate, a namespace-imported page, a default import, a root index route and
// a relative nested path: the shapes a scanner that matches tag text would get wrong.
const FIXTURE_ROUTER_ALIASED = `import { Navigate as GoTo, Route as R, Routes as Switch } from "react-router";
import * as ThingModule from "@/features/thing/ThingPage";
import Nested from "./NestedPage";

export function AppRoutes() {
  return (
    <Switch>
      <R index element={<Nested />} />
      <R path="things" element={<ThingModule.ThingPage />}>
        <R path=":id" element={<Nested />} />
      </R>
      <R path="/gone" element={<GoTo to="/things" replace />} />
    </Switch>
  );
}
`;

const FIXTURE_LAYOUT = `import { Bell } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { Button } from "@/components/ui/button";
import { ThingToggle } from "@/features/thing/ThingToggle";

export function AppShell() {
  return (
    <div>
      <header>
        <NavLink to="/things">Things</NavLink>
        <ThingToggle />
        <Button variant="outline">
          <Bell aria-hidden="true" />
          Ring
        </Button>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
`;

const FIXTURE_SPEC = JSON.stringify({
  openapi: "3.1.0",
  paths: {
    "/things": {
      get: { summary: "List the things", tags: ["things"], operationId: "listThings" },
      post: { summary: "Create a thing", tags: ["things"], operationId: "createThing" },
    },
    "/health": { get: { summary: "Health check", tags: ["system"], operationId: "health" } },
    // A tag that sorts first with a path that sorts last, and a summary past the column's cut.
    "/zebras": {
      get: {
        summary: "List every zebra on the savannah with its stripes counted",
        tags: ["alpha"],
        operationId: "listZebras",
      },
    },
  },
});

const LONG_BULLET = `A released bullet that runs well past the limit ${"x".repeat(120)} and keeps going`;

const FIXTURE_CHANGELOG = `# Changelog

## [Unreleased]

### Added

- An unreleased bullet ${"y".repeat(140)} that runs past two hundred characters and is cut like a released one, ${"z".repeat(80)} to the very end.

## [1.2.0] - 2026-09-10

### Added

- ${LONG_BULLET}
- Second released bullet.
- Third released bullet, dropped.

## [1.1.0] - 2026-09-09

### Fixed

- Older bullet.

## [1.0.0] - 2026-09-08

### Added

- Oldest bullet.

## [0.9.0] - 2026-09-07

### Added

- Ancient bullet, dropped with its heading.
`;

function fixtureFiles(overrides: Record<string, string> = {}) {
  return {
    "src/app/router.tsx": FIXTURE_ROUTER,
    "src/app/layout.tsx": FIXTURE_LAYOUT,
    "src/app/NestedPage.tsx": "export function NestedPage() {}\n",
    "src/features/thing/ThingPage.tsx": "export function ThingPage() {}\n",
    "src/features/thing/ThingToggle.tsx": "export function ThingToggle() {}\n",
    "src/features/thing/hooks.ts": "export const useThing = () => 1;\n",
    "src/components/ui/button.tsx": "export function Button() {}\n",
    "src/api/openapi.json": FIXTURE_SPEC,
    "CHANGELOG.md": FIXTURE_CHANGELOG,
    "docs/adr/0001-first-decision.md": "# ADR 0001: The first decision\n",
    "docs/adr/0002-second-decision.md": "# ADR 0002: The second decision\n",
    [MAP]: `# Product map: fixture\n\nHand-written prose that must survive.\n\n${MARKER}\n\nstale generated part\n`,
    ...overrides,
  };
}

describe("scripts/product-map.mjs (fixtures)", () => {
  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("keeps the hand-written header and replaces everything below the marker", () => {
    const result = generate(makeRoot(fixtureFiles()));
    expect(result.status).toBe(0);
    expect(result.text).toContain("Hand-written prose that must survive.");
    expect(result.text).not.toContain("stale generated part");
    expect(result.text.indexOf(MARKER)).toBeGreaterThan(0);
    expect(result.text.split(MARKER)).toHaveLength(2);
  });

  it("lists every path-bearing route, resolves the page's source, and skips pathless wrappers", () => {
    const { text } = generate(makeRoot(fixtureFiles()));
    expect(row(text, "`/things`")).toEqual([
      "`/things`",
      "`ThingPage`",
      "`src/features/thing/ThingPage.tsx`",
    ]);
    expect(row(text, "`/things/:id`")).toEqual([
      "`/things/:id`",
      "`NestedPage`",
      "`src/app/NestedPage.tsx`",
    ]);
    expect(row(text, "`*`")?.[1]).toBe("`NestedPage`");
    expect(row(text, "`AppShell`")).toBeUndefined();
  });

  it("marks a Navigate element as a redirect, not a page", () => {
    const { text } = generate(makeRoot(fixtureFiles()));
    expect(row(text, "`/`")?.[1]).toBe("redirect to `/things`");
    expect(text).not.toContain("`Navigate`");
  });

  it("exits 1 with the file and line for a route path it cannot read", () => {
    const bad = FIXTURE_ROUTER.replace('path="/things"', "path={THINGS}");
    const result = generate(makeRoot(fixtureFiles({ "src/app/router.tsx": bad })));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`src/app/router.tsx:${lineOf(bad, "path={THINGS}")}`);
    expect(result.stderr).toMatch(/path/);
  });

  it("exits 1 with the file and line for a route element it cannot read", () => {
    const bad = FIXTURE_ROUTER.replace("element={<ThingPage />}", "element={renderThing()}");
    const result = generate(makeRoot(fixtureFiles({ "src/app/router.tsx": bad })));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`src/app/router.tsx:${lineOf(bad, "renderThing()")}`);
  });

  it("exits 1 for a route element that is neither imported nor declared here", () => {
    const bad = FIXTURE_ROUTER.replace("element={<ThingPage />}", "element={<Mystery />}");
    const result = generate(makeRoot(fixtureFiles({ "src/app/router.tsx": bad })));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`src/app/router.tsx:${lineOf(bad, "<Mystery />")}`);
    expect(result.stderr).toMatch(/cannot be resolved/);
  });

  it("reads aliased and namespaced JSX names, not the letters in the tag", () => {
    const { text, status } = generate(
      makeRoot(fixtureFiles({ "src/app/router.tsx": FIXTURE_ROUTER_ALIASED })),
    );
    expect(status).toBe(0);
    // `Route as R` is still a route, `Navigate as GoTo` is still a redirect, and a namespaced page
    // belongs to its own module, not to router.tsx.
    expect(row(text, "`/things`")).toEqual([
      "`/things`",
      "`ThingPage`",
      "`src/features/thing/ThingPage.tsx`",
    ]);
    expect(row(text, "`/gone`")?.[1]).toBe("redirect to `/things`");
    expect(row(text, "`/ (index)`")?.[2]).toBe("`src/app/NestedPage.tsx`");
    expect(text).not.toContain("`GoTo`");
  });

  it("joins a relative nested path onto its parent and roots an index route at /", () => {
    const { text } = generate(
      makeRoot(fixtureFiles({ "src/app/router.tsx": FIXTURE_ROUTER_ALIASED })),
    );
    expect(row(text, "`/ (index)`")?.[1]).toBe("`Nested`");
    expect(row(text, "`/things/:id`")?.[1]).toBe("`Nested`");
    expect(row(text, "`things`")).toBeUndefined();
  });

  it("inventories the shell's header controls with their words and their source paths", () => {
    const { text } = generate(makeRoot(fixtureFiles()));
    expect(row(text, "`ThingToggle`")).toEqual([
      "`ThingToggle`",
      "header",
      "`src/features/thing/ThingToggle.tsx`",
    ]);
    expect(row(text, '`Button` "Ring"')).toEqual([
      '`Button` "Ring"',
      "header",
      "`src/components/ui/button.tsx`",
    ]);
    expect(row(text, '`NavLink` "Things" → /things')?.[2]).toBe("`react-router`");
    expect(row(text, "`Outlet`")?.[1]).toBe("shell");
    // The lucide icon inside the button is how the button is labelled, not a control of its own.
    expect(row(text, "`Bell`")).toBeUndefined();
    expect(text).not.toContain("lucide-react");
  });

  it("lists a control once, however often the same one is rendered", () => {
    const twice = FIXTURE_LAYOUT.replace(
      "<ThingToggle />",
      "<ThingToggle />\n        <ThingToggle />",
    );
    const { text } = generate(makeRoot(fixtureFiles({ "src/app/layout.tsx": twice })));
    const rows = text
      .split("\n")
      .filter((line) => line.startsWith("|") && line.includes("`ThingToggle`"));
    expect(rows).toHaveLength(1);
  });

  it("tables the contract's endpoints by path, summaries cut at 40 characters", () => {
    const { text } = generate(makeRoot(fixtureFiles()));
    // Three cells: the tag is the path's first segment, so it earns no column of its own.
    expect(row(text, "GET")?.slice(1)).toEqual(["`/health`", "Health check"]);
    expect(row(text, "POST")?.slice(1)).toEqual(["`/things`", "Create a thing"]);
    // Sorted by path, not by tag: "alpha" would otherwise put /zebras first.
    const paths = text
      .split("\n")
      .filter((line) => /^\| (GET|POST|PUT|PATCH|DELETE) /.test(line))
      .map((line) => line.split("|")[2].trim());
    expect(paths).toEqual(["`/health`", "`/things`", "`/things`", "`/zebras`"]);
    const zebras = text.split("\n").find((line) => line.includes("`/zebras`"));
    expect(zebras).toContain("List every zebra on the savannah with i…");
    expect(zebras).not.toContain("stripes");
  });

  it("cuts unreleased bullets at 200 characters and released ones to one per release at 100", () => {
    const { text } = generate(makeRoot(fixtureFiles()));
    expect(text).toContain("Recent releases (history, not current behavior)");
    const unreleased = text.split("\n").find((line) => line.includes("An unreleased bullet"));
    expect(unreleased).toBeDefined();
    expect(unreleased).toContain("…");
    expect(unreleased).not.toContain("to the very end.");
    // 200 characters of bullet, plus the "- **Added** — " a list item carries.
    expect(unreleased!.length).toBeLessThan(230);
    expect(unreleased!.length).toBeGreaterThan(200);
    expect(text).toContain("1.2.0");
    expect(text).toContain("1.0.0");
    expect(text).not.toContain("0.9.0");
    // One bullet per release: the second and third are history the changelog keeps, not the map.
    expect(text).not.toContain("Second released bullet");
    expect(text).not.toContain("Third released bullet");
    const cut = text.split("\n").find((line) => line.includes("A released bullet that runs"));
    expect(cut).toBeDefined();
    expect(cut).toContain("…");
    expect(cut!.length).toBeLessThan(160);
    expect(cut).not.toContain("and keeps going");
  });

  it("lists the feature folders and the ADRs", () => {
    const { text } = generate(makeRoot(fixtureFiles()));
    expect(text).toContain("`src/features/thing/`");
    expect(text).toContain("`ThingPage`");
    expect(text).toContain("ADR 0001: The first decision");
    expect(text).toContain("ADR 0002: The second decision");
  });

  it("is byte-identical when run twice on an unchanged tree", () => {
    const root = makeRoot(fixtureFiles());
    expect(generate(root).text).toBe(generate(root).text);
  });
});

describe("scripts/product-map.mjs (this checkout)", () => {
  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  const committed = () => readFileSync(MAP, "utf8");

  function regenerate() {
    const dir = mkdtempSync(join(tmpdir(), "kaizen-product-map-real-"));
    tmpDirs.push(dir);
    const out = join(dir, "product-map.md");
    const result = spawnSync("node", ["scripts/product-map.mjs", "--out", out], {
      encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    return readFileSync(out, "utf8");
  }

  it("has every path-bearing route of src/app/router.tsx, redirects distinguished", () => {
    const text = committed();
    const router = readFileSync("src/app/router.tsx", "utf8");
    const paths = [...router.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(4);
    for (const path of paths) expect(row(text, `\`${path}\``)).toBeDefined();
    expect(row(text, "`/tasks`")?.[1]).toBe("`TaskListPage`");
    expect(row(text, "`/`")?.[1]).toBe("redirect to `/tasks`");
  });

  it("has the layout's header controls with their source paths", () => {
    const text = committed();
    expect(row(text, "`ThemeToggle`")).toEqual([
      "`ThemeToggle`",
      "header",
      "`src/features/theme/ThemeToggle.tsx`",
    ]);
    expect(row(text, '`Button` "Log out"')?.[2]).toBe("`src/components/ui/button.tsx`");
    expect(row(text, "`FeatureRequestLink`")?.[2]).toBe(
      "`src/features/feature-request/FeatureRequestLink.tsx`",
    );
    expect(row(text, "`KaizenMark`")?.[2]).toBe("`src/components/kaizen-mark.tsx`");
  });

  it("points at the UI conventions and carries the reviewed line in the header", () => {
    const header = committed().split(MARKER)[0];
    const lines = header.split("\n").filter((line) => line.trim() !== "");
    expect(lines.length).toBeGreaterThanOrEqual(8);
    expect(lines.length).toBeLessThanOrEqual(15);
    expect(header).toContain("docs/ui-conventions.md");
    expect(lines.at(-1)).toMatch(/^Reviewed: \d{4}-\d{2}-\d{2} against \S+ sections /);
  });

  it("regenerates byte-identically twice, and the committed map is fresh", () => {
    const first = regenerate();
    expect(regenerate()).toBe(first);
    expect(first).toBe(committed());
  });

  it("is formatted with the repo's Prettier", () => {
    const result = spawnSync("node_modules/.bin/prettier", ["--check", MAP], { encoding: "utf8" });
    expect(result.stdout + result.stderr).not.toMatch(/Code style issues/);
    expect(result.status).toBe(0);
  });

  it("stays under 12 KB and 250 lines", () => {
    const text = committed();
    expect(Buffer.byteLength(text, "utf8")).toBeLessThan(12 * 1024);
    expect(text.split("\n").length).toBeLessThanOrEqual(250);
  });

  it("stays under budget with a release worth of long unreleased bullets", () => {
    // The bullets in this repo's changelog run to a thousand characters. Eight of them under
    // [Unreleased] is more than any single release has carried, and the map must still fit.
    const changelog = readFileSync("CHANGELOG.md", "utf8");
    const bullets = Array.from({ length: 8 }, (_, i) => `- Bullet ${i} ${"w".repeat(1200)}`);
    const fat =
      `## [Unreleased]\n\n### Added\n\n${bullets.join("\n")}\n\n` +
      changelog.slice(changelog.indexOf("## [1."));
    const dir = mkdtempSync(join(tmpdir(), "kaizen-product-map-budget-"));
    tmpDirs.push(dir);
    cpSync("src", join(dir, "src"), { recursive: true });
    cpSync("docs/adr", join(dir, "docs/adr"), { recursive: true });
    copyFileSync(MAP, join(dir, MAP));
    writeFileSync(join(dir, "CHANGELOG.md"), fat);

    const { status, text } = generate(dir);
    expect(status).toBe(0);
    expect(text).toContain("Bullet 0");
    expect(Buffer.byteLength(text, "utf8")).toBeLessThan(12 * 1024);
    expect(text.split("\n").length).toBeLessThanOrEqual(250);

    // Twice as many again cannot push it over: the section has a ceiling, and what does not fit is
    // counted rather than dropped in silence.
    writeFileSync(
      join(dir, "CHANGELOG.md"),
      fat.replace(bullets.join("\n"), [...bullets, ...bullets].join("\n")),
    );
    const bigger = generate(dir);
    expect(Buffer.byteLength(bigger.text, "utf8")).toBeLessThan(12 * 1024);
    expect(bigger.text).toMatch(/…and \d+ more under \[Unreleased\] in CHANGELOG\.md/);
  });

  it("--sources prints the files it reads, one existing relative path per line", () => {
    const run = () =>
      spawnSync("node", ["scripts/product-map.mjs", "--sources"], { encoding: "utf8" });
    const first = run();
    expect(first.status).toBe(0);
    const lines = first.stdout.trim().split("\n");
    expect(lines).toContain("src/app/router.tsx");
    expect(lines).toContain("src/app/layout.tsx");
    expect(lines).toContain("src/api/openapi.json");
    expect(lines).toContain("CHANGELOG.md");
    expect(lines.some((line) => line.startsWith("docs/adr/"))).toBe(true);
    // Everything a feature contributes to the map, not only its pages: a component or a hooks file
    // changes the generated part too, and Rule D's message names the source that changed.
    expect(lines).toContain("src/features/tasks/TaskListPage.tsx");
    expect(lines).toContain("src/features/tasks/components/AiChip.tsx");
    expect(lines).toContain("src/features/tasks/hooks.ts");
    for (const line of lines) expect(existsSync(line)).toBe(true);
    expect(run().stdout).toBe(first.stdout);
  });
});
