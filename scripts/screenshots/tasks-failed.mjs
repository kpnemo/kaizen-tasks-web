// The task list with a failed breakdown: the row the room sees if the live provider fails during
// the demo (a destructive "Breakdown failed" chip in the rail, the API's message in an Alert on the
// row's second line, Retry beside it). The dev API's fake provider never fails, so the scenario
// creates two real tasks through the API and, on this page only, rewrites one of them in the list
// response (a Playwright route on GET /tasks) to aiStatus "failed" with the message the API writes
// when the model is unavailable. Everything else on the screen is real.
export const route = "/tasks";

const DECK = "Prepare the quarterly business review deck";
const MILK = "Buy milk";
const AI_ERROR = "The assistant is unavailable, try again"; // AI_ERROR_MESSAGES.unavailable in the API

/** The same origin the page is on, so the call goes through the dev server's proxy like the app's. */
async function api(page, path, { method = "GET", token, body } = {}) {
  const origin = new URL(page.url()).origin;
  const response = await page.request.fetch(`${origin}/api/v1${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    data: body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok()) {
    throw new Error(`${method} ${path} failed: ${payload?.error?.message ?? response.status()}`);
  }
  return payload.data;
}

/** Creates the rows once. The access token lives in the app's memory, so a fresh one comes from
 *  the refresh cookie the browser context already holds; the app's own token stays valid. */
async function seed(page) {
  const { accessToken: token } = await api(page, "/auth/refresh", { method: "POST" });
  const rows = await api(page, "/tasks", { token });
  if (rows.some((row) => row.title === DECK)) return;
  // Newest first on screen, so the deck goes in last.
  await api(page, "/tasks", { method: "POST", token, body: { title: MILK } });
  await api(page, "/tasks", {
    method: "POST",
    token,
    body: {
      title: DECK,
      description: "Slides, the numbers from finance, and a dry run with the team before Thursday.",
    },
  });
}

const isTaskList = (url) => url.pathname.endsWith("/api/v1/tasks");

/** GET /tasks answers with the deck's breakdown failed; every other request passes through. */
async function failTheDeck(page) {
  await page.unroute(isTaskList);
  await page.route(isTaskList, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const payload = await response.json();
    payload.data = payload.data.map((row) =>
      row.title === DECK
        ? {
            ...row,
            aiStatus: "failed",
            aiError: AI_ERROR,
            suggestionCount: 0,
            // A breakdown that failed produced no steps, so the row shows no progress bar; the fake
            // provider, which did answer, would otherwise leave its count beside the failure.
            progress: { done: 0, total: 0 },
          }
        : row,
    );
    await route.fulfill({ response, json: payload });
  });
}

async function shellReady(page) {
  await page.getByRole("heading", { name: "Tasks", level: 1 }).waitFor({ timeout: 15_000 });
  // The account is on screen only once GET /auth/me answered, which is after the app used the
  // refresh cookie: seeding before that would rotate the cookie out from under it.
  await page.getByText("Screenshot", { exact: true }).waitFor({ timeout: 15_000 });
}

export async function ready(page) {
  await shellReady(page);
  await seed(page);
  await failTheDeck(page);
  // The list loaded before the route was in place (and, the first time, before the rows existed).
  await page.reload({ waitUntil: "domcontentloaded" });
  await shellReady(page);
  const deck = page.getByRole("listitem", { name: DECK });
  await deck.getByRole("alert").getByText(AI_ERROR).waitFor({ timeout: 15_000 });
  await deck.getByRole("button", { name: "Retry" }).waitFor({ timeout: 15_000 });
  await page
    .getByRole("listitem", { name: MILK })
    .getByText("Too short to break down")
    .waitFor({ timeout: 15_000 });
}

/** The create card fills the top of a projector viewport: bring the filters and the rows up under
 *  the sticky header. */
export async function act(page) {
  await page.evaluate(() => {
    document.querySelector("fieldset")?.scrollIntoView({ block: "start" });
    window.scrollBy(0, -96);
  });
  await page.waitForTimeout(300);
}
