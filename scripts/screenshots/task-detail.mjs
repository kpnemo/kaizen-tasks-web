// The task detail as it opens once the assistant has answered: the ghost "All tasks" link, the
// title, the status group with the current status pressed, progress and Regenerate, the
// description, the tag row with its "Add tag" menu trigger, the "Suggested tags" chips, the
// "N suggestions to review" group and the first suggested step row (tint, "Suggested by AI" pill,
// Accept, row menu). The rest of the steps are task-detail-steps.
import { openNewTask, parkPointer } from "./lib/task.mjs";

export const route = "/tasks";
export { readyOnList as ready } from "./lib/task.mjs";

export async function act(page) {
  await openNewTask(page, "Prepare the quarterly business review deck");
  await page
    .getByRole("button", { name: "Accept", exact: true })
    .first()
    .waitFor({ timeout: 20_000 });
  await page.getByRole("group", { name: "Suggestions" }).waitFor({ timeout: 5_000 });
  // A description, so the header shows text rather than its placeholder.
  await page.getByRole("button", { name: "Add a description" }).click();
  await page
    .getByRole("textbox", { name: "Description" })
    .fill("For the leadership team on the 30th.");
  await page.keyboard.press("ControlOrMeta+Enter");
  await page
    .getByRole("button", { name: "For the leadership team on the 30th." })
    .waitFor({ timeout: 10_000 });
  await parkPointer(page);
}
