import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

let server: Server | undefined;

// spawnSync would block this process's event loop for the child's whole lifetime, starving the
// http.createServer fixture below (it lives in this same process) of any chance to respond to the
// child's polling requests. An async spawn keeps the event loop free so the fixture can answer
// while the script under test runs.
function run(args: string[]): Promise<{ status: number | null; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn("bash", args);
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.on("close", (status) => resolve({ status, stdout }));
  });
}

function serve(commit: string): Promise<string> {
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      if (req.url === "/version.json") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ commit, builtAt: "2026-09-08T00:00:00.000Z" }));
      } else {
        res.statusCode = 404;
        res.end();
      }
    }).listen(0, "127.0.0.1", () => {
      const address = server!.address();
      resolve(`http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`);
    });
  });
}

describe("scripts/wait-for-version.sh", () => {
  afterEach(() => server?.close());

  it("exits 0 when the served commit matches", async () => {
    const url = await serve("abc123");
    const result = await run(["scripts/wait-for-version.sh", url, "abc123", "5", "1"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("staging serves abc123");
  });

  it("exits 1 with an error annotation after the timeout", async () => {
    const url = await serve("old999");
    const result = await run(["scripts/wait-for-version.sh", url, "abc123", "2", "1"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("::error::");
    expect(result.stdout).toContain("old999");
  });
});
