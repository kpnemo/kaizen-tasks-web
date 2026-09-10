#!/usr/bin/env node
// Captures one screen of the running app in both themes, for a pull request that changes something
// visible.
//
//   node scripts/screenshot.mjs <scenario>          docs/screenshots/<scenario>-{light,dark}.png
//
// Scenarios live in scripts/screenshots/<name>.mjs and export { route, ready, act }. This script
// runs against the local dev stack (the API on its port, `npm run dev` here), registers a throwaway
// user through the API, logs in through the UI, and sets the account's theme through
// PATCH /auth/me for each capture, because the account preference wins over the per-device cache.
// Before every shot it asserts the route and that <html> carries the `dark` class exactly when the
// dark theme was asked for, so a screenshot can never claim a theme it is not showing.
//
// Chrome: playwright-core drives the Chrome installed on this machine (`channel: "chrome"`); it
// downloads no browser of its own. Set CHROME_PATH to point at another binary.
//
// Every failure is bounded: the script prints one line and exits 2, and the pull request then
// carries `Screenshot unavailable: <reason>` instead of the images.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WEB_URL = (process.env.WEB_URL ?? "http://localhost:5173").replace(/\/$/, "");
const API_BASE = `${WEB_URL}/api/v1`;
const OUT_DIR = process.env.SCREENSHOT_DIR ?? join(ROOT, "docs", "screenshots");
const VIEWPORT = { width: 1024, height: 640 };
const SCALE = 1.25; // 1024x640 at 125% is the 1280x800 the room sees on the projector
const DEADLINE_MS = 60_000;
const SETTLE_MS = 300;
const THEMES = ["light", "dark"];

class Bounded extends Error {}
const bail = (reason) => {
  throw new Bounded(reason);
};

async function api(path, { method = "GET", token, body } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    bail(`no dev stack on ${WEB_URL} (start the API, then \`npm run dev\` here, or set WEB_URL)`);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message ?? `HTTP ${response.status}`;
    bail(`${method} ${path} failed: ${message}`);
  }
  return payload.data;
}

async function loadScenario(name) {
  if (!name || name.startsWith("-")) bail("usage: node scripts/screenshot.mjs <scenario>");
  const file = join(ROOT, "scripts", "screenshots", `${name}.mjs`);
  let module;
  try {
    module = await import(pathToFileURL(file).href);
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") {
      bail(`unknown scenario "${name}" (expected scripts/screenshots/${name}.mjs)`);
    }
    throw error;
  }
  const scenario = module.default ?? module;
  if (typeof scenario.route !== "string" || typeof scenario.ready !== "function") {
    bail(`scenario "${name}" must export { route, ready, act? }`);
  }
  return scenario;
}

async function launch() {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    bail("playwright-core is not installed (run npm ci)");
  }
  try {
    return await chromium.launch(
      process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" },
    );
  } catch (error) {
    const message = String(error?.message ?? error);
    if (/executable doesn't exist|Chromium distribution|ENOENT/i.test(message)) {
      bail(
        "Google Chrome is not installed (playwright-core uses the system Chrome; install it from https://google.com/chrome or set CHROME_PATH)",
      );
    }
    bail(`could not start Chrome: ${message.split("\n")[0]}`);
  }
}

async function signIn(page, credentials) {
  try {
    await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email").fill(credentials.email);
    await page.getByLabel("Password").fill(credentials.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(`${WEB_URL}/tasks`, { timeout: 15_000 });
  } catch (error) {
    bail(`login failed: ${String(error?.message ?? error).split("\n")[0]}`);
  }
}

async function capture(page, scenario, name, theme, token) {
  await api("/auth/me", { method: "PATCH", token, body: { theme } });
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(`${WEB_URL}${scenario.route}`, { waitUntil: "domcontentloaded" });
  try {
    await scenario.ready(page);
  } catch (error) {
    bail(`${name}: the screen was not ready: ${String(error?.message ?? error).split("\n")[0]}`);
  }

  const pathname = new URL(page.url()).pathname;
  if (pathname !== scenario.route)
    bail(`${name}: expected ${scenario.route}, the app is on ${pathname}`);
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  if (isDark !== (theme === "dark")) {
    bail(
      `${name}: asked for the ${theme} theme but <html> ${isDark ? "has" : "lacks"} the dark class`,
    );
  }

  if (scenario.act) await scenario.act(page);
  // Let the web fonts land and the primitives' transitions finish, so the two themes are compared
  // in their settled state rather than mid-fade.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(SETTLE_MS);
  const file = join(OUT_DIR, `${name}-${theme}.png`);
  await page.screenshot({ path: file });
  process.stdout.write(`${file.replace(`${ROOT}`, "")}\n`);
}

async function run(name) {
  const scenario = await loadScenario(name);
  mkdirSync(OUT_DIR, { recursive: true });

  const credentials = {
    email: `screenshot-${Date.now()}@example.test`,
    password: "screenshot-pass-2026",
    displayName: "Screenshot",
  };
  const { accessToken } = await api("/auth/register", { method: "POST", body: credentials });

  const browser = await launch();
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: SCALE,
      colorScheme: "light",
    });
    const page = await context.newPage();
    await signIn(page, credentials);
    for (const theme of THEMES) await capture(page, scenario, name, theme, accessToken);
  } finally {
    await browser.close();
  }
}

const timer = setTimeout(() => {
  process.stderr.write(`screenshot: timed out after ${DEADLINE_MS / 1000} s\n`);
  process.stdout.write(`Screenshot unavailable: timed out after ${DEADLINE_MS / 1000} s\n`);
  process.exit(2);
}, DEADLINE_MS);

try {
  await run(process.argv[2]);
  clearTimeout(timer);
} catch (error) {
  clearTimeout(timer);
  const reason = error instanceof Bounded ? error.message : String(error?.stack ?? error);
  process.stderr.write(`screenshot: ${reason}\n`);
  process.stdout.write(
    `Screenshot unavailable: ${error instanceof Bounded ? reason : "the capture crashed, see the output above"}\n`,
  );
  process.exit(2);
}
