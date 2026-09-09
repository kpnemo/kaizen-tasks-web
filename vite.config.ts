import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

// Resolves the same way scripts/write-version.mjs does (RAILWAY_GIT_COMMIT_SHA, else
// `git rev-parse HEAD`, else "local"), but this one must never fail the config: a checkout with
// no commit available (no git, no env var) still needs to build and run tests.
function resolveCommit(): string {
  const fromRailway = process.env.RAILWAY_GIT_COMMIT_SHA;
  if (fromRailway && fromRailway.trim()) return fromRailway.trim();
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "local";
  }
}

const commit = resolveCommit();

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const proxyTarget = env.VITE_PROXY_TARGET || "http://localhost:4010";
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      proxy: {
        "/api": { target: proxyTarget, changeOrigin: false },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_COMMIT__: JSON.stringify(commit.slice(0, 7)),
    },
  };
});
