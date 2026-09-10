// The task list: the app shell (brand, primary nav, theme control, log out) above the list itself.
// The throwaway user the runner registers owns nothing, so this is also the empty state.
export const route = "/tasks";

export async function ready(page) {
  await page.getByRole("heading", { name: "Tasks", level: 1 }).waitFor({ timeout: 15_000 });
  await page.getByRole("textbox", { name: "Task title" }).waitFor({ timeout: 15_000 });
  await page.getByText("No tasks yet", { exact: false }).waitFor({ timeout: 15_000 });
}
