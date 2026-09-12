// A task the assistant judged small enough to do as it is: the "Assistant" status banner with
// "Small enough to do as is", an outline Regenerate, then the Empty steps state. The API's fake
// model always answers with steps, so the task detail response is rewritten to the skipped state.
import { bringUnderHeader, openNewTask, parkPointer } from "./lib/task.mjs";

export const route = "/tasks";
export { readyOnList as ready } from "./lib/task.mjs";

export async function act(page) {
  await page.route(/\/api\/v1\/tasks\/[0-9a-f-]{36}$/, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    body.data = {
      ...body.data,
      aiStatus: "skipped",
      aiSkipReason: "no_steps_needed",
      children: [],
    };
    await route.fulfill({ response, json: body });
  });
  await openNewTask(page, "Water the office plants");
  await page.getByText("Small enough to do as is").waitFor({ timeout: 20_000 });
  await page.getByText("No steps yet.").waitFor({ timeout: 5_000 });
  await bringUnderHeader(page, page.getByRole("status", { name: "Assistant" }));
  await parkPointer(page);
}
