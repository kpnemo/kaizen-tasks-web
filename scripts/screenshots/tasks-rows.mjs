// The task list with rows in it: a task with a tag, one accepted step and suggestions still to
// review (progress and the "N suggestions" chip in one rail), one whose suggestions were all
// accepted (progress only), and one too short to break down (the skipped chip). The throwaway user
// the runner registers owns nothing, so ready() creates them through the API on the first pass and
// finds them on the second, and both themes show the same rows.
export const route = "/tasks";

const DECK = "Prepare the quarterly business review deck";
const OFFSITE = "Book the venue for the team offsite";
const MILK = "Buy milk";

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

/** The fake provider answers within a second; the real one takes longer. */
async function settled(page, token, id) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const task = await api(page, `/tasks/${id}`, { token });
    if (task.aiStatus !== "pending" && task.aiStatus !== "running") return task;
    await page.waitForTimeout(500);
  }
  throw new Error(`the breakdown of ${id} did not settle`);
}

/** Creates the rows once. The access token lives in the app's memory, so a fresh one comes from
 *  the refresh cookie the browser context already holds; the app's own token stays valid. */
async function seed(page) {
  const { accessToken: token } = await api(page, "/auth/refresh", { method: "POST" });
  const rows = await api(page, "/tasks", { token });
  if (rows.some((row) => row.title === DECK)) return false;

  const tag = await api(page, "/tags", {
    method: "POST",
    token,
    body: { name: "work", color: "#3B3FBF" },
  });
  // Newest first on screen, so the deck goes in last.
  await api(page, "/tasks", { method: "POST", token, body: { title: MILK } });
  const offsite = await api(page, "/tasks", {
    method: "POST",
    token,
    body: {
      title: OFFSITE,
      description: "Forty people, two days in October, within an hour of the office.",
    },
  });
  const deck = await api(page, "/tasks", {
    method: "POST",
    token,
    body: {
      title: DECK,
      description: "Slides, the numbers from finance, and a dry run with the team before Thursday.",
      tagIds: [tag.id],
    },
  });
  await settled(page, token, offsite.id);
  await api(page, `/tasks/${offsite.id}/suggestions/accept-all`, { method: "POST", token });
  const detail = await settled(page, token, deck.id);
  const first = detail.children.find((child) => child.suggestionState === "suggested");
  if (first) {
    await api(page, `/tasks/${first.id}`, {
      method: "PATCH",
      token,
      body: { suggestionState: "accepted" },
    });
  }
  return true;
}

async function shellReady(page) {
  await page.getByRole("heading", { name: "Tasks", level: 1 }).waitFor({ timeout: 15_000 });
  // The account is on screen only once GET /auth/me answered, which is after the app used the
  // refresh cookie: seeding before that would rotate the cookie out from under it.
  await page.getByText("Screenshot", { exact: true }).waitFor({ timeout: 15_000 });
}

export async function ready(page) {
  await shellReady(page);
  if (await seed(page)) {
    // The list loaded before the rows existed and nothing is pending, so it would not poll.
    await page.reload({ waitUntil: "domcontentloaded" });
    await shellReady(page);
  }
  const deck = page.getByRole("listitem", { name: DECK });
  await deck.getByText(/^\d+ suggestions?$/).waitFor({ timeout: 15_000 });
  await deck.getByRole("progressbar", { name: "Steps done" }).waitFor({ timeout: 15_000 });
  await page
    .getByRole("listitem", { name: OFFSITE })
    .getByText(/^0\/\d+$/)
    .waitFor({ timeout: 15_000 });
  await page
    .getByRole("listitem", { name: MILK })
    .getByText("Too short to break down")
    .waitFor({ timeout: 15_000 });
  await page
    .getByRole("group", { name: "Tag" })
    .getByRole("button", { name: "work" })
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
