import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tmpDirs: string[] = [];

function build(env: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "kaizen-mock-"));
  tmpDirs.push(dir);
  const out = join(dir, "openapi.json");
  execFileSync("node", ["scripts/build-mock-spec.mjs"], {
    env: { ...process.env, MOCK_OUT: out, ...env },
  });
  return JSON.parse(readFileSync(out, "utf8"));
}

describe("scripts/build-mock-spec.mjs", () => {
  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("injects curated examples into a copy of the contract", () => {
    const doc = build();
    const list =
      doc.paths["/api/v1/tasks"].get.responses["200"].content["application/json"].example;
    expect(list.data.map((t: { title: string }) => t.title)).toEqual([
      "Prepare the quarterly business review deck",
      "Renew the passport before the trip",
      "Buy milk",
      "Plan the team offsite agenda",
    ]);
    const detail =
      doc.paths["/api/v1/tasks/{id}"].get.responses["200"].content["application/json"].example;
    expect(detail.data.children).toHaveLength(4);
    expect(detail.data.children[0].rationale).toBeTruthy();
    // The shared TaskDetail schema component (referenced by every task-detail response via
    // $ref, since this contract inlines response bodies rather than $ref'ing a shared response
    // object) is untouched: examples are attached per-operation, never to the schema itself.
    expect(doc.components.schemas.TaskDetail.example).toBeUndefined();
    // Prism ignores `servers[].url` when routing, so the mock artifact folds the contract's base
    // path into its own path keys and drops `servers`, mounting the bare-path operations at
    // "/api/v1/..." instead.
    expect(doc.paths["/tasks"]).toBeUndefined();
    expect(doc.servers).toBeUndefined();
    // The committed contract is untouched: bare paths, its own `servers` entry.
    const contract = JSON.parse(readFileSync("src/api/openapi.json", "utf8"));
    expect(
      contract.paths["/tasks"].get.responses["200"].content["application/json"].example,
    ).toBeUndefined();
    expect(contract.paths["/tasks"]).toBeDefined();
    expect(contract.servers).toBeDefined();
  });

  it("fails when an example names an operation the contract lacks", () => {
    const result = spawnSync("node", ["scripts/build-mock-spec.mjs"], {
      env: {
        ...process.env,
        MOCK_OUT: "/dev/null",
        MOCK_EXAMPLES: "tests/fixtures/bad-examples.json",
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr.toString()).toContain("GET /nope");
  });
});
