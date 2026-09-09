import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

const TMP = "tests/.tmp-format-file.ts";

function runHook(filePath: string) {
  return spawnSync("bash", ["scripts/format-file.sh"], {
    input: JSON.stringify({ tool_name: "Write", tool_input: { file_path: filePath } }),
    encoding: "utf8",
  });
}

describe("scripts/format-file.sh", () => {
  afterEach(() => rmSync(TMP, { force: true }));

  it("formats a file inside the repo with prettier", () => {
    writeFileSync(TMP, "const a={b:1}\n");
    expect(runHook(`${process.cwd()}/${TMP}`).status).toBe(0);
    expect(readFileSync(TMP, "utf8")).toBe("const a = { b: 1 };\n");
  });

  it("leaves generated files and files outside the repo alone", () => {
    const before = statSync("src/api/types.ts").mtimeMs;
    expect(runHook(`${process.cwd()}/src/api/types.ts`).status).toBe(0);
    expect(statSync("src/api/types.ts").mtimeMs).toBe(before);
    expect(runHook("/tmp/definitely-not-in-repo.ts").status).toBe(0);
  });

  it("exits 0 on malformed input", () => {
    const result = spawnSync("bash", ["scripts/format-file.sh"], {
      input: "not json",
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
  });
});
