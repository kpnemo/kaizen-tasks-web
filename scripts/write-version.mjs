#!/usr/bin/env node
// Writes <outDir>/version.json after `vite build` so the promote workflow and the smoke
// package can tell which commit a web deployment is serving. Never cached (see Caddyfile).
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function resolveCommit() {
  const fromRailway = process.env.RAILWAY_GIT_COMMIT_SHA;
  if (fromRailway && fromRailway.trim()) return fromRailway.trim();
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    console.error(
      "write-version: no commit available: set RAILWAY_GIT_COMMIT_SHA or run inside a git checkout",
    );
    process.exit(1);
  }
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(scriptDir, "..", "package.json"), "utf8"));

const outDir = process.env.VERSION_OUT_DIR || "dist";
const version = {
  commit: resolveCommit(),
  builtAt: new Date().toISOString(),
  version: pkg.version,
};
mkdirSync(outDir, { recursive: true });
const file = join(outDir, "version.json");
writeFileSync(file, `${JSON.stringify(version)}\n`);
console.log(`${file} -> ${version.commit}`);
