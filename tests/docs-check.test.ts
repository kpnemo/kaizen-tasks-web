import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GIT_ENV = {
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
};

function makeRepo(options: { withGenerator?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "kaizen-docs-check-"));
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
  return { dir, run, write, check, commit, exists: (f: string) => existsSync(join(dir, f)) };
}

describe("scripts/docs-check.sh", () => {
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
  });

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
