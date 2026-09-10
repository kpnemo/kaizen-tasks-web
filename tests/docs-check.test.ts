import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const GIT_ENV = {
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
};

// Rule D always regenerates the product map and compares it with the committed one. The scratch
// repos stand in a stub generator for scripts/product-map.mjs (the real one has its own tests in
// tests/product-map.test.ts and would need this repo's sources): it echoes MAP-SOURCE.md, which
// lets a test make the map stale, make the generator fail, or leave it fresh.
const MAP_STUB = `import { readFileSync, writeFileSync } from "node:fs";
if (process.argv.includes("--sources")) {
  process.stdout.write("src/api/openapi.json\\nCHANGELOG.md\\n");
  process.exit(0);
}
const body = readFileSync("MAP-SOURCE.md", "utf8");
if (body.startsWith("BOOM")) {
  process.stderr.write("product-map: src/app/router.tsx:12: a route it cannot read\\n");
  process.exit(1);
}
writeFileSync(process.argv[process.argv.indexOf("--out") + 1], body);
`;

// Rule B's scratch repo below symlinks this repo's real node_modules into the scratch tree so
// the openapi-typescript binary resolves there. rmSync(dir, { recursive, force }) removes a
// symlink it encounters by unlinking it (lstat, not stat), never traversing into or deleting the
// link's target — verified locally against Node 24 before relying on it here.
const tmpDirs: string[] = [];

function makeRepo(options: { withGenerator?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "kaizen-docs-check-"));
  tmpDirs.push(dir);
  const run = (cmd: string, args: string[], env: Record<string, string> = {}) =>
    spawnSync(cmd, args, {
      cwd: dir,
      env: { ...process.env, ...GIT_ENV, ...env },
      encoding: "utf8",
    });
  run("git", ["init", "-q", "-b", "develop"]);
  for (const d of ["scripts", "src/api", "docs/adr", ".claude"])
    mkdirSync(join(dir, d), { recursive: true });
  copyFileSync("scripts/docs-check.sh", join(dir, "scripts/docs-check.sh"));
  const write = (file: string, content: string) => writeFileSync(join(dir, file), content);
  write("src/app.ts", "export const a = 1;\n");
  write("src/api/client.ts", "export const c = 1;\n");
  write("src/api/openapi.json", '{"openapi":"3.1.0","paths":{}}\n');
  write("CHANGELOG.md", "# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-09-01\n\n- first\n");
  write("docs/architectural-files.txt", "src/api/**\nCaddyfile\n");
  write("docs/adr/0001-first.md", "# ADR 0001\n");
  write("scripts/product-map.mjs", MAP_STUB);
  write("MAP-SOURCE.md", "# Product map\n\ngenerated part\n");
  write("docs/product-map.md", "# Product map\n\ngenerated part\n");
  if (options.withGenerator) {
    // Symlink this repo's node_modules (never copied) so the real openapi-typescript binary
    // resolves inside the scratch repo, and copy package.json so `npm run api:types` works there.
    symlinkSync(join(process.cwd(), "node_modules"), join(dir, "node_modules"), "dir");
    copyFileSync(join(process.cwd(), "package.json"), join(dir, "package.json"));
  }
  run("git", ["add", "-A"]);
  run("git", ["commit", "-q", "-m", "base"]);
  const check = (mode: "--hook" | "--ci", env: Record<string, string> = {}) =>
    run("bash", ["scripts/docs-check.sh", mode], env);
  const commit = (message: string) => {
    run("git", ["add", "-A"]);
    run("git", ["commit", "-q", "-m", message]);
    return run("git", ["rev-parse", "HEAD"]).stdout.trim();
  };
  return {
    dir,
    run,
    write,
    check,
    commit,
    remove: (file: string) => unlinkSync(join(dir, file)),
    exists: (f: string) => existsSync(join(dir, f)),
  };
}

describe("scripts/docs-check.sh", () => {
  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("passes with no changes", () => {
    const repo = makeRepo();
    expect(repo.check("--hook").status).toBe(0);
  });

  it("Rule A: blocks a code change without a changelog bullet, then passes with one", () => {
    const repo = makeRepo();
    repo.write("src/app.ts", "export const a = 2;\n");
    const blocked = repo.check("--hook");
    expect(blocked.status).toBe(2);
    expect(blocked.stdout).toContain("Rule A");
    expect(blocked.stdout).toContain("add a bullet under [Unreleased]");
    expect(blocked.stderr).toContain("Rule A");
    repo.write(
      "CHANGELOG.md",
      "# Changelog\n\n## [Unreleased]\n\n- Changed a\n\n## [0.1.0] - 2026-09-01\n\n- first\n",
    );
    expect(repo.check("--hook").status).toBe(0);
    expect(repo.exists(".claude/.docs-check-blocks")).toBe(false);
  });

  it("Rule A: a release cut that adds a dated version heading satisfies it in --hook and --ci", () => {
    const repo = makeRepo();
    repo.write("src/app.ts", "export const a = 5;\n");
    repo.write(
      "CHANGELOG.md",
      "# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-09-09\n\n- Changed a\n\n## [0.1.0] - 2026-09-01\n\n- first\n",
    );
    const hooked = repo.check("--hook");
    expect(hooked.status).toBe(0);
    expect(hooked.stdout).toContain("docs-check: OK");
    repo.commit("release 0.2.0");
    const base = repo.run("git", ["rev-parse", "HEAD~1"]).stdout.trim();
    const ci = repo.check("--ci", { BASE_SHA: base });
    expect(ci.status).toBe(0);
    expect(ci.stdout).toContain("docs-check: OK");
  });

  it("counts an untracked file as a change", () => {
    const repo = makeRepo();
    repo.write("src/new.ts", "export const n = 1;\n");
    expect(repo.check("--hook").status).toBe(2);
  });

  it("Rule C: an architectural change needs an ADR even when the changelog is fine", () => {
    const repo = makeRepo();
    repo.write("src/api/client.ts", "export const c = 2;\n");
    repo.write(
      "CHANGELOG.md",
      "# Changelog\n\n## [Unreleased]\n\n- Client change\n\n## [0.1.0] - 2026-09-01\n\n- first\n",
    );
    const blocked = repo.check("--hook");
    expect(blocked.status).toBe(2);
    expect(blocked.stdout).toContain("Rule C");
    expect(blocked.stdout).toContain("src/api/client.ts");
    repo.write("docs/adr/0002-client.md", "# ADR 0002\n");
    expect(repo.check("--hook").status).toBe(0);
  });

  it("Rule B: a contract change needs regenerated types, and passes once they are regenerated", () => {
    const repo = makeRepo({ withGenerator: true });
    repo.write("src/api/openapi.json", '{"openapi":"3.1.0","paths":{"/x":{}}}\n');
    repo.write(
      "CHANGELOG.md",
      "# Changelog\n\n## [Unreleased]\n\n- Contract\n\n## [0.1.0] - 2026-09-01\n\n- first\n",
    );
    repo.write("docs/adr/0002-contract.md", "# ADR 0002\n");
    const blocked = repo.check("--hook");
    expect(blocked.status).toBe(2);
    expect(blocked.stdout).toContain("Rule B");
    expect(blocked.stdout).toContain("npm run api:types");
    expect(blocked.stdout).toContain("not regenerated");

    const gen = repo.run("npm", ["run", "--silent", "api:types"]);
    expect(gen.status).toBe(0);
    expect(repo.check("--hook").status).toBe(0);
  }, 30_000);

  it("escape hatch: after four blocked stops it stops blocking but never reports success", () => {
    const repo = makeRepo();
    repo.write("src/app.ts", "export const a = 3;\n");
    expect(repo.check("--hook").status).toBe(2);
    expect(repo.check("--hook").status).toBe(2);
    expect(repo.check("--hook").status).toBe(2);
    const fourth = repo.check("--hook");
    expect(fourth.status).toBe(1);
    expect(fourth.stdout).toContain("DOCS CHECK FAILED, human intervention required");
    expect(repo.exists(".claude/DOCS-CHECK-FAILED")).toBe(true);
    // CI mode still fails the same tree.
    const sha = repo.commit("undocumented");
    const base = repo.run("git", ["rev-parse", "HEAD~1"]).stdout.trim();
    const ci = repo.check("--ci", { BASE_SHA: base });
    expect(ci.status).toBe(1);
    expect(ci.stdout).toContain("Rule A");
    expect(sha).not.toBe(base);
    // A fix clears the counter and the marker.
    repo.write(
      "CHANGELOG.md",
      "# Changelog\n\n## [Unreleased]\n\n- Fixed\n\n## [0.1.0] - 2026-09-01\n\n- first\n",
    );
    expect(repo.check("--hook").status).toBe(0);
    expect(repo.exists(".claude/DOCS-CHECK-FAILED")).toBe(false);
    expect(repo.exists(".claude/.docs-check-blocks")).toBe(false);
  }, 30_000);

  it("Rule D: blocks a stale product map and names the map source that changed", () => {
    const repo = makeRepo();
    repo.write("MAP-SOURCE.md", "# Product map\n\nregenerated part\n");
    repo.write("CHANGELOG.md", "# Changelog\n\n## [Unreleased]\n\n- Added\n");
    const blocked = repo.check("--hook");
    expect(blocked.status).toBe(2);
    expect(blocked.stdout).toContain("Rule D: CHANGELOG.md changed but docs/product-map.md");
    expect(blocked.stdout).toContain("npm run product-map");
    repo.write("docs/product-map.md", "# Product map\n\nregenerated part\n");
    expect(repo.check("--hook").status).toBe(0);
  });

  it("Rule D: runs before the early return, so a stale map fails with no code change at all", () => {
    const repo = makeRepo();
    repo.write("MAP-SOURCE.md", "# Product map\n\ndrifted\n");
    repo.commit("stale map, no code change");
    const ci = repo.check("--ci", {
      BASE_SHA: repo.run("git", ["rev-parse", "HEAD"]).stdout.trim(),
    });
    expect(ci.status).toBe(1);
    expect(ci.stdout).toContain("Rule D");
  });

  it("Rule D: a missing map or a failing generator fails the check", () => {
    const missing = makeRepo();
    missing.remove("docs/product-map.md");
    const blocked = missing.check("--hook");
    expect(blocked.status).toBe(2);
    expect(blocked.stdout).toContain("Rule D: docs/product-map.md is missing");

    const broken = makeRepo();
    broken.write("MAP-SOURCE.md", "BOOM\n");
    const failed = broken.check("--ci", { BASE_SHA: "" });
    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain("Rule D: the product map generator failed");
    expect(failed.stdout).toContain("src/app/router.tsx:12");
  });

  it("CI mode falls back to HEAD~1 when BASE_SHA is missing or all zeros", () => {
    const repo = makeRepo();
    repo.write("src/app.ts", "export const a = 4;\n");
    repo.commit("undocumented");
    expect(
      repo.check("--ci", { BASE_SHA: "0000000000000000000000000000000000000000" }).status,
    ).toBe(1);
    expect(repo.check("--ci", { BASE_SHA: "" }).status).toBe(1);
  });
});
