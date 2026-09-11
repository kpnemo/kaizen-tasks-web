// The Tags page: the create card (name, the palette as a radio group, Create tag) above the table
// of the account's tags, each row with its swatch button, palette name, editable name and delete
// button. The throwaway user the runner registers owns nothing, so ready() creates two tags through
// the form the first time it runs and finds them already there for the second theme.
export const route = "/tags";

const TAGS = ["work", "reading"];

export async function ready(page) {
  await page.getByRole("heading", { name: "Tags", level: 1 }).waitFor({ timeout: 15_000 });
  await page.getByRole("form", { name: "Create tag" }).waitFor({ timeout: 15_000 });
  // The list has settled once either the table or the empty state is on screen.
  await page
    .getByRole("table", { name: "Your tags" })
    .or(page.getByText("No tags yet", { exact: false }))
    .first()
    .waitFor({ timeout: 15_000 });
  for (const name of TAGS) {
    if ((await page.getByRole("row", { name, exact: true }).count()) > 0) continue;
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Create tag" }).click();
    await page.getByRole("row", { name, exact: true }).waitFor({ timeout: 15_000 });
  }
  await page.getByRole("table", { name: "Your tags" }).waitFor({ timeout: 15_000 });
}

/** On the projector viewport the table sits under the fold: bring its last row to the bottom edge,
 *  so the palette, the Create tag button and the rows share one frame. */
export async function act(page) {
  // The form click in ready() leaves the pointer over a row; park it so no row wears its hover tint.
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    document
      .querySelector('table[aria-label="Your tags"]')
      ?.scrollIntoView({ block: "end", behavior: "instant" });
  });
  await page.waitForTimeout(300);
}
