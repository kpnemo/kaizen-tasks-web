// A task the assistant skipped ("Buy milk" is too short to break down): the status banner named
// "Assistant" with the reason and an outline Regenerate, then the Empty steps state and Add step.
// The header above the banner is what task-detail shows, so the banner is brought to the top.
import { bringUnderHeader, openNewTask, parkPointer } from "./lib/task.mjs";

export const route = "/tasks";
export { readyOnList as ready } from "./lib/task.mjs";

export async function act(page) {
  await openNewTask(page, "Buy milk");
  await page.getByRole("status", { name: "Assistant" }).waitFor({ timeout: 20_000 });
  await page.getByText("Too short to break down").waitFor({ timeout: 5_000 });
  await page.getByText("No steps yet.").waitFor({ timeout: 5_000 });
  await bringUnderHeader(page, page.getByRole("status", { name: "Assistant" }));
  await parkPointer(page);
}
