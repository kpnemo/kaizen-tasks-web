// Shared by the task-detail scenarios. The runner navigates to a scenario's static `route` and
// asserts it before `act`, and a detail page's id is minted by the API, so the detail is reached
// inside `act`: create the task through the create bar on /tasks, follow its link, wait for the
// assistant. Each theme pass creates its own task; the newest matching link is the one to follow.

export async function readyOnList(page) {
  await page.getByRole("heading", { name: "Tasks", level: 1 }).waitFor({ timeout: 15_000 });
  await page.getByRole("textbox", { name: "Task title" }).waitFor({ timeout: 15_000 });
}

export async function openNewTask(page, title) {
  const links = page.getByRole("link", { name: title, exact: true });
  const before = await links.count();
  const input = page.getByRole("textbox", { name: "Task title" });
  await input.fill(title);
  await input.press("Enter");
  // The new row lands at the top once the API answers; until then the first link is an older one.
  await links.nth(before).waitFor({ timeout: 15_000 });
  await links.first().click();
  await page
    .getByRole("heading", { name: title, level: 1, exact: true })
    .waitFor({ timeout: 15_000 });
}

/** Clicks leave the pointer over a control, whose hover look would otherwise pass for its resting
 *  look in the capture: park it in the corner. */
export async function parkPointer(page) {
  await page.mouse.move(0, 0);
}

/** A detail page is taller than the projector: put `locator` just under the sticky header. */
export async function bringUnderHeader(page, locator) {
  await locator.evaluate((element) => {
    element.scrollIntoView({ block: "start" });
    window.scrollBy(0, -88);
  });
  await page.waitForTimeout(300);
}
