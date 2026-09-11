// The Request page in form mode with the "Requests so far" list under it (issue #22). The list
// reads the real harness repository through the API, so the dev API needs GITHUB_TOKEN and
// GITHUB_REPO set (see the pull request or CLAUDE.md, Screenshots).
export const route = "/request-feature?mode=form";

export async function ready(page) {
  await page
    .getByRole("heading", { name: "Request a feature", level: 1 })
    .waitFor({ timeout: 15_000 });
  await page
    .getByRole("heading", { name: "Requests so far", level: 2 })
    .waitFor({ timeout: 15_000 });
  await page.getByRole("listitem").first().waitFor({ timeout: 20_000 });
}
