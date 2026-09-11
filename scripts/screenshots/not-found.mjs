// The 404 for a signed-in user: the Empty with its way back, inside the shell (ADR 0009).
export const route = "/nowhere";

export async function ready(page) {
  await page
    .getByRole("heading", { name: "Page not found", level: 1 })
    .waitFor({ timeout: 15_000 });
  await page.getByRole("link", { name: "Go to your tasks" }).waitFor({ timeout: 15_000 });
}
