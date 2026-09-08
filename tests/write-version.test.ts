import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function run(env: Record<string, string>) {
  const outDir = mkdtempSync(join(tmpdir(), "kaizen-version-"));
  execFileSync("node", ["scripts/write-version.mjs"], {
    env: { ...process.env, VERSION_OUT_DIR: outDir, ...env },
  });
  return JSON.parse(readFileSync(join(outDir, "version.json"), "utf8")) as {
    commit: string;
    builtAt: string;
  };
}

describe("scripts/write-version.mjs", () => {
  it("prefers RAILWAY_GIT_COMMIT_SHA", () => {
    const v = run({ RAILWAY_GIT_COMMIT_SHA: "abc123" });
    expect(v.commit).toBe("abc123");
    expect(new Date(v.builtAt).toISOString()).toBe(v.builtAt);
  });

  it("falls back to git rev-parse HEAD", () => {
    const head = execFileSync("git", ["rev-parse", "HEAD"]).toString().trim();
    const v = run({ RAILWAY_GIT_COMMIT_SHA: "" });
    expect(v.commit).toBe(head);
  });
});
