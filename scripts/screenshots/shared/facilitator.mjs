// Shared by the two facilitator captures: swap the runner's throwaway viewer for the facilitator
// account, keep the theme the runner asked for, and land on /pipeline with the buttons showing.
//
// The account is facilitator@kaizen.test (FACILITATOR_EMAILS on the local API), registered once
// through the API before the run; its password is FACILITATOR_PASSWORD (default below). The runner
// set the theme on the throwaway account, so the theme is read off the document before logging out
// and the facilitator is kept on "System" so the runner's colour-scheme emulation decides it.
import { serveFixture } from "./pipeline-snapshot.mjs";

export const FACILITATOR = {
  email: process.env.FACILITATOR_EMAIL ?? "facilitator@kaizen.test",
  password: process.env.FACILITATOR_PASSWORD ?? "facilitator-pass-2026",
  displayName: "Facilitator",
};

export async function waitForPipeline(page) {
  await page.getByRole("heading", { name: "Pipeline", level: 1 }).waitFor({ timeout: 15_000 });
  await page.getByRole("img", { name: "How it flows" }).waitFor({ timeout: 15_000 });
  await page.getByRole("table", { name: "Issues" }).waitFor({ timeout: 30_000 });
  await page.getByText(/^as of \d\d:\d\d:\d\d$/).waitFor({ timeout: 30_000 });
}

export async function signInAsFacilitator(page) {
  const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  const origin = new URL(page.url()).origin;
  const header = page.getByRole("banner");

  // The runner reuses one page for both themes: the second pass finds the facilitator signed in.
  const signedIn = await header
    .getByText(FACILITATOR.displayName, { exact: true })
    .isVisible()
    .catch(() => false);
  if (!signedIn) {
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL(`${origin}/login`, { timeout: 15_000 });
    await page.getByLabel("Email").fill(FACILITATOR.email);
    await page.getByLabel("Password").fill(FACILITATOR.password);
    await page.getByRole("button", { name: "Log in" }).click();
    // Login returns to where the log-out happened (/pipeline), so the proof of the session is the
    // account's name in the header, not a URL.
    await header.getByText(FACILITATOR.displayName, { exact: true }).waitFor({ timeout: 15_000 });
  }

  // The account preference wins over the device (ADR 0006), and the runner drives the theme by
  // emulating prefers-color-scheme for the account it registered. Keeping the facilitator on
  // "System" hands that emulation the decision, in this pass and in the next one.
  await page.getByRole("button", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name: "System" }).click();
  await page.waitForFunction(
    (want) => document.documentElement.classList.contains("dark") === want,
    dark,
    { timeout: 10_000 },
  );

  if (process.env.PIPELINE_LIVE !== "1" && !page.__pipelineFixture) {
    await serveFixture(page);
    page.__pipelineFixture = true;
  }
  await page.goto(`${origin}/pipeline`, { waitUntil: "domcontentloaded" });
  await waitForPipeline(page);
  await page
    .getByRole("button", { name: /^Deploy/ })
    .first()
    .waitFor({ timeout: 30_000 });
}

/** Brings a section's heading to the top, under the sticky header. */
export async function scrollTo(page, id) {
  await page.evaluate((target) => {
    document.getElementById(target)?.scrollIntoView({ block: "start" });
    window.scrollBy(0, -88);
  }, id);
  await page.waitForTimeout(300);
}
