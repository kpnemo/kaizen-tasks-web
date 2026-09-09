import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import pkg from "../package.json";

const tmpDirs: string[] = [];

function makeTmpDir() {
  const dir = mkdtempSync(join(tmpdir(), "kaizen-version-"));
  tmpDirs.push(dir);
  return dir;
}

function run(env: Record<string, string>) {
  const outDir = makeTmpDir();
  execFileSync("node", ["scripts/write-version.mjs"], {
    env: { ...process.env, VERSION_OUT_DIR: outDir, ...env },
  });
  return JSON.parse(readFileSync(join(outDir, "version.json"), "utf8")) as {
    commit: string;
    builtAt: string;
    version: string;
  };
}

describe("scripts/write-version.mjs", () => {
  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("prefers RAILWAY_GIT_COMMIT_SHA", () => {
    const v = run({ RAILWAY_GIT_COMMIT_SHA: "abc123" });
    expect(v.commit).toBe("abc123");
    expect(new Date(v.builtAt).toISOString()).toBe(v.builtAt);
  });

  it("writes the package.json version", () => {
    const v = run({ RAILWAY_GIT_COMMIT_SHA: "abc123" });
    expect(v.version).toBe(pkg.version);
  });

  it("falls back to git rev-parse HEAD", () => {
    const head = execFileSync("git", ["rev-parse", "HEAD"]).toString().trim();
    const v = run({ RAILWAY_GIT_COMMIT_SHA: "" });
    expect(v.commit).toBe(head);
  });

  it("prefers RAILWAY_GIT_COMMIT_SHA even when git rev-parse would fail", () => {
    const outDir = makeTmpDir();
    const scriptPath = join(process.cwd(), "scripts/write-version.mjs");
    execFileSync("node", [scriptPath], {
      cwd: outDir,
      env: {
        ...process.env,
        VERSION_OUT_DIR: outDir,
        RAILWAY_GIT_COMMIT_SHA: "def456",
        GIT_CEILING_DIRECTORIES: outDir,
      },
    });
    const v = JSON.parse(readFileSync(join(outDir, "version.json"), "utf8")) as {
      commit: string;
      builtAt: string;
    };
    expect(v.commit).toBe("def456");
  });

  it("fails loudly when no commit is available", () => {
    const outDir = makeTmpDir();
    const scriptPath = join(process.cwd(), "scripts/write-version.mjs");
    let error: { status: number | null; stderr: Buffer } | undefined;
    try {
      execFileSync("node", [scriptPath], {
        cwd: outDir,
        env: {
          ...process.env,
          VERSION_OUT_DIR: outDir,
          RAILWAY_GIT_COMMIT_SHA: "",
          GIT_CEILING_DIRECTORIES: outDir,
        },
      });
    } catch (err) {
      error = err as { status: number | null; stderr: Buffer };
    }
    expect(error).toBeDefined();
    expect(error?.status).toBe(1);
    expect(error?.stderr.toString()).toContain(
      "write-version: no commit available: set RAILWAY_GIT_COMMIT_SHA or run inside a git checkout",
    );
  });
});
