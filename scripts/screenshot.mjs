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
// The account's theme reaches the document only once GET /auth/me answers, so the runner waits for
// the session to restore, polls for the `dark` class to match, and asserts it again immediately
// before the shutter: a screenshot can never claim a theme it is not showing.
//
// Chrome: playwright-core drives the Chrome installed on this machine (`channel: "chrome"`); it
// downloads no browser of its own. Set CHROME_PATH to point at another binary.
//
// Every failure is bounded and looks the same: exactly one line on stderr,
// `Screenshot unavailable: <reason>`, and exit 2. The pull request carries that line instead of the
// images.
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
const SESSION_MS = 15_000;
const THEME_MS = 10_000;
const THEMES = ["light", "dark"];

class Bounded extends Error {}
const bail = (reason) => {
  throw new Bounded(reason);
};

/** One line, always: no newlines, no control characters, no stack, nothing unbounded. */
function oneLine(text) {
  return String(text ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** The only way this script reports a failure: one line on stderr, exit 2. */
function unavailable(reason) {
  process.stderr.write(`Screenshot unavailable: ${oneLine(reason)}\n`);
  process.exit(2);
}

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
  if (!name || name.startsWith("-")) {
    bail("no scenario given (usage: node scripts/screenshot.mjs <scenario>)");
  }
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
        process.env.CHROME_PATH
          ? `no browser at CHROME_PATH (${process.env.CHROME_PATH})`
          : "Google Chrome is not installed (playwright-core uses the system Chrome; install it from https://google.com/chrome or set CHROME_PATH)",
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
    await page.waitForURL(`${WEB_URL}/tasks`, { timeout: SESSION_MS });
  } catch (error) {
    bail(`login failed: ${oneLine(error?.message ?? error)}`);
  }
  // The shell renders as soon as the token is in memory, before GET /auth/me answers, and the theme
  // on the page until then is the device's cached one. Wait for the account itself to be on screen.
  try {
    await page.getByText(credentials.displayName, { exact: true }).waitFor({ timeout: SESSION_MS });
  } catch {
    bail("the session did not restore after login (GET /auth/me did not reach the header)");
  }
}

/** The account's theme reaches the document a moment after the page loads: give it that moment. */
async function waitForTheme(page, theme, name) {
  const expected = theme === "dark";
  try {
    await page.waitForFunction(
      (want) => document.documentElement.classList.contains("dark") === want,
      expected,
      { timeout: THEME_MS },
    );
  } catch {
    bail(
      `${name}: asked for the ${theme} theme but <html> ${expected ? "never gained" : "still had"} the dark class after ${THEME_MS / 1000} s`,
    );
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
  await waitForTheme(page, theme, name);

  if (scenario.act) await scenario.act(page);
  // Let the web fonts land and the primitives' transitions finish, so the two themes are compared
  // in their settled state rather than mid-fade.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(SETTLE_MS);

  // The last thing before the shutter: what the file is about to show is what was asked for.
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  if (isDark !== (theme === "dark")) {
    bail(
      `${name}: asked for the ${theme} theme but <html> ${isDark ? "has" : "lacks"} the dark class`,
    );
  }
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

const timer = setTimeout(() => unavailable(`timed out after ${DEADLINE_MS / 1000} s`), DEADLINE_MS);

try {
  await run(process.argv[2]);
  clearTimeout(timer);
} catch (error) {
  clearTimeout(timer);
  unavailable(
    error instanceof Bounded
      ? error.message
      : `the capture failed: ${oneLine(error?.message ?? error)}`,
  );
}
