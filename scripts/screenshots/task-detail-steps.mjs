// The steps section after a round of review: one suggestion accepted (its "AI" chip, progress
// 0/1), two still suggested with their pill, Accept and row menu, one dismissed inside the open
// "1 dismissed" disclosure with its Dismissed chip and Undo, and the Add step form.
import { bringUnderHeader, openNewTask, parkPointer } from "./lib/task.mjs";

export const route = "/tasks";
export { readyOnList as ready } from "./lib/task.mjs";

export async function act(page) {
  await openNewTask(page, "Plan the team offsite agenda");
  // exact: "Accept all" in the suggestions bar would otherwise match first.
  const accept = page.getByRole("button", { name: "Accept", exact: true }).first();
  await accept.waitFor({ timeout: 20_000 });
  await accept.click();
  await page.getByLabel("Suggested by AI, accepted").waitFor({ timeout: 10_000 });
  await page
    .getByRole("button", { name: /^More actions for / })
    .last()
    .click();
  await page.getByRole("menuitem", { name: "Dismiss", exact: true }).click();
  const disclosure = page.getByRole("button", { name: "1 dismissed" });
  await disclosure.waitFor({ timeout: 10_000 });
  await disclosure.click();
  await page.getByRole("list", { name: "Dismissed steps" }).waitFor({ timeout: 5_000 });
  await bringUnderHeader(page, page.getByRole("heading", { name: "Steps", level: 2 }));
  await parkPointer(page);
}
