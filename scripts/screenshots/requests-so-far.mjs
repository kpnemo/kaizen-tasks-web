// The "Requests so far" table under the Request page (issue #22): every request filed to the real
// harness repository, read through the API, so the dev API needs GITHUB_TOKEN and GITHUB_REPO set
// (see CLAUDE.md, Screenshots). The table sits below the interview on a projector viewport, so the
// capture scrolls it to the top, under the sticky header.
export const route = "/request-feature";

export async function ready(page) {
  await page
    .getByRole("heading", { name: "Requests so far", level: 2 })
    .waitFor({ timeout: 15_000 });
  await page.getByRole("table").waitFor({ timeout: 20_000 });
  await page
    .getByRole("row")
    .filter({ has: page.getByRole("link") })
    .first()
    .waitFor({ timeout: 20_000 });
}

export async function act(page) {
  await page.evaluate(() => {
    document.getElementById("requests-so-far")?.scrollIntoView({ block: "start" });
    window.scrollBy(0, -88);
  });
  await page.waitForTimeout(300);
}
