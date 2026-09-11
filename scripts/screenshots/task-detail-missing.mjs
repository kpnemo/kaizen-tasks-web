// The task detail's error state: a task id that does not exist, so the page shows the destructive
// "This task does not exist." alert and the outline "Back to tasks" button (a Button-styled link,
// full 44px hit area through `data-nav`). The id is a well-formed UUID the API has never minted.
export const route = "/tasks/00000000-0000-4000-8000-000000000000";

export async function ready(page) {
  await page.getByRole("alert").filter({ hasText: "This task does not exist." }).waitFor({
    timeout: 15_000,
  });
  await page.getByRole("link", { name: "Back to tasks" }).waitFor({ timeout: 5_000 });
}
