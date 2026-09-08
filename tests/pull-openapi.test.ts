import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DEST = "src/api/openapi.json";

function tmpFile(content: string) {
  const dir = mkdtempSync(join(tmpdir(), "kaizen-openapi-"));
  const file = join(dir, "openapi.json");
  writeFileSync(file, content);
  return file;
}

describe("scripts/pull-openapi.sh --check", () => {
  it("reports a match without writing", () => {
    const same = tmpFile(readFileSync(DEST, "utf8"));
    const out = execFileSync("bash", [
      "scripts/pull-openapi.sh",
      "--local",
      same,
      "--check",
    ]).toString();
    expect(out).toContain("matches");
  });

  it("prints a warning annotation when the copy is behind, and still exits 0", () => {
    const changed = tmpFile(JSON.stringify({ openapi: "3.1.0", paths: {} }));
    const result = spawnSync("bash", ["scripts/pull-openapi.sh", "--local", changed, "--check"]);
    expect(result.status).toBe(0);
    expect(result.stdout.toString()).toContain("::warning::");
    expect(readFileSync(DEST, "utf8")).not.toContain('"paths":{}');
  });

  it("fails loudly outside check mode when the local file is missing", () => {
    const result = spawnSync("bash", [
      "scripts/pull-openapi.sh",
      "--local",
      "/nonexistent/openapi.json",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr.toString()).toContain("no file at");
  });
});
