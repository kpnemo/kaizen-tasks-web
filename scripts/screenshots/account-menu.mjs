// The header's account menu, open: the display name button reveals Request a feature, Pipeline,
// and Log out, so their icons and order can be compared in both themes; it also shows the icon-only
// theme control beside it and the whole header (brand, primary nav, truncated display name).
// Replaces theme-open, whose dropdown-menu the theme control no longer is.
export const route = "/tasks";

export async function ready(page) {
  await page.getByRole("heading", { name: "Tasks", level: 1 }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Screenshot" }).waitFor({ timeout: 15_000 });
}

export async function act(page) {
  await page.getByRole("button", { name: "Screenshot" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).waitFor({ timeout: 5_000 });
}
