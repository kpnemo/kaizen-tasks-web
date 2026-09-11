// The Request page (interview mode) with the "Requests so far" list under it (issue #22). The list
// reads the real harness repository through the API, so the dev API needs GITHUB_TOKEN and
// GITHUB_REPO set (see the pull request or CLAUDE.md, Screenshots).
export const route = "/request-feature";

export async function ready(page) {
  await page
    .getByRole("heading", { name: "Request a feature", level: 1 })
    .waitFor({ timeout: 15_000 });
  await page
    .getByRole("heading", { name: "Requests so far", level: 2 })
    .waitFor({ timeout: 15_000 });
  await page.getByRole("listitem").first().waitFor({ timeout: 20_000 });
}

/** The list is below the fold on a projector viewport: bring it to the top, under the sticky header. */
export async function act(page) {
  await page.evaluate(() => {
    document.getElementById("requests-so-far")?.scrollIntoView({ block: "start" });
    window.scrollBy(0, -88);
  });
  await page.waitForTimeout(300);
}
